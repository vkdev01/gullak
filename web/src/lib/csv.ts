/**
 * Statement CSV parsing, browser side.
 *
 * This is the demo transport's copy of api/app/services/csv_import.py. The
 * shapes and rules are the same — header detection, tolerant dates and
 * amounts, dedupe on account + date + amount + descriptor — so the static
 * build behaves like the server. It is not a second source of truth: when
 * NEXT_PUBLIC_API_URL is set, none of this runs.
 */

export type Direction = "debit" | "credit";

export type ParsedRow = {
  lineNo: number;
  occurredAt: string; // YYYY-MM-DD
  description: string;
  amount: number; // paise, positive
  direction: Direction;
};

export type Mapping = Record<string, string>;

const DATE_KEYS = ["date", "txn date", "transaction date", "value date", "posting date", "tran date"];
const DESC_KEYS = ["description", "narration", "particulars", "details", "remarks", "narrative"];
const AMOUNT_KEYS = ["amount", "transaction amount", "amt"];
const DEBIT_KEYS = ["debit", "withdrawal", "withdrawal amt", "withdrawal amt.", "dr", "debit amount"];
const CREDIT_KEYS = ["credit", "deposit", "deposit amt", "deposit amt.", "cr", "credit amount"];
const BALANCE_KEYS = ["balance", "closing balance", "running balance"];

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Split a CSV line, honouring double quotes. Statements are simple enough for this. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cell);
      cell = "";
    } else cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

export function readCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/);

  // Statements often carry a few lines of account metadata before the header.
  let start = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const low = lines[i].toLowerCase();
    if (DATE_KEYS.some((k) => low.includes(k)) && DESC_KEYS.some((k) => low.includes(k))) {
      start = i;
      break;
    }
  }

  const table = lines
    .slice(start)
    .filter((line) => line.trim().length > 0)
    .map(splitLine);

  if (table.length === 0) return { headers: [], rows: [] };
  return { headers: table[0], rows: table.slice(1) };
}

export function detectMapping(headers: string[]): Mapping {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));

  const pick = (keys: string[]): string | undefined => {
    for (const key of keys) if (byNorm.has(key)) return byNorm.get(key);
    for (const key of keys) {
      for (const [low, original] of byNorm) if (low.includes(key)) return original;
    }
    return undefined;
  };

  const mapping: Mapping = {};
  const date = pick(DATE_KEYS);
  const description = pick(DESC_KEYS);
  if (date) mapping.date = date;
  if (description) mapping.description = description;

  const amount = pick(AMOUNT_KEYS);
  const debit = pick(DEBIT_KEYS);
  const credit = pick(CREDIT_KEYS);
  if (debit && credit) {
    mapping.debit = debit;
    mapping.credit = credit;
  } else if (amount) {
    mapping.amount = amount;
  }

  const balance = pick(BALANCE_KEYS);
  if (balance) mapping.balance = balance;
  return mapping;
}

export function parseAmount(value: string): number | null {
  const text = String(value ?? "").replace(/[₹,\s]/g, "");
  if (!text || text === "-" || text === "--") return null;
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-");
  const cleaned = text.replace(/^[(-]+/, "").replace(/[)]+$/, "");
  const value2 = Number.parseFloat(cleaned);
  if (Number.isNaN(value2)) return null;
  const paise = Math.round(value2 * 100);
  return negative ? -paise : paise;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDate(value: string): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  // dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  // 01 Nov 2026 / 01-Nov-26
  m = text.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2,4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month >= 0) {
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${year}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  return null;
}

/** FNV-1a. Collision-resistant enough for a demo store; the API uses SHA-256. */
export function dedupeHash(accountId: string, date: string, amount: number, description: string): string {
  const payload = `${accountId}|${date}|${amount}|${description.trim().toLowerCase().slice(0, 40)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv${h.toString(16).padStart(8, "0")}${payload.length.toString(16)}`;
}

export function buildCandidates(
  text: string,
  accountId: string,
  mapping?: Mapping,
): { mapping: Mapping; rows: ParsedRow[]; warnings: string[] } {
  const { headers, rows } = readCsv(text);
  const used = mapping ?? detectMapping(headers);
  const warnings: string[] = [];

  if (!used.date || !used.description) {
    throw new Error("Could not find a date and a description column. Map them manually.");
  }
  if (!((used.debit && used.credit) || used.amount)) {
    throw new Error("Could not find amount columns. Map debit/credit or a single amount column.");
  }

  const index = new Map(headers.map((h, i) => [h, i]));
  const cell = (row: string[], field: string) => {
    const name = used[field];
    if (!name) return "";
    const i = index.get(name);
    return i === undefined ? "" : row[i] ?? "";
  };

  const parsed: ParsedRow[] = [];
  rows.forEach((row, n) => {
    const lineNo = n + 2;
    const occurredAt = parseDate(cell(row, "date"));
    const description = cell(row, "description").trim();
    if (!occurredAt || !description) {
      if (description || row.some((c) => c.trim())) warnings.push(`line ${lineNo}: skipped, no readable date or description`);
      return;
    }

    if (used.amount) {
      const amount = parseAmount(cell(row, "amount"));
      if (!amount) {
        warnings.push(`line ${lineNo}: skipped, amount not readable`);
        return;
      }
      parsed.push({
        lineNo,
        occurredAt,
        description,
        amount: Math.abs(amount),
        direction: amount < 0 ? "credit" : "debit",
      });
      return;
    }

    const debit = parseAmount(cell(row, "debit")) ?? 0;
    const credit = parseAmount(cell(row, "credit")) ?? 0;
    if (!debit && !credit) {
      warnings.push(`line ${lineNo}: skipped, no debit or credit value`);
      return;
    }
    parsed.push({
      lineNo,
      occurredAt,
      description,
      amount: Math.abs(debit || credit),
      direction: debit ? "debit" : "credit",
    });
  });

  return { mapping: used, rows: parsed, warnings };
}
