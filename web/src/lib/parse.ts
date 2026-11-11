import { addDays, todayISO } from "./format";

export type ParsedTransaction = {
  amount: number | null; // paise
  merchant: string;
  date: string;
  raw: string;
};

const DATE_WORDS: Record<string, number> = { today: 0, yesterday: -1 };

/**
 * "320 swiggy yesterday" → { amount: 32000, merchant: "swiggy", date: … }
 * Deliberately forgiving: it is a capture shortcut, not a parser to trust blindly.
 */
export function parseQuickAdd(raw: string): ParsedTransaction {
  const text = raw.trim();
  let amount: number | null = null;
  let merchant = text;
  let date = todayISO();

  const amountMatch = text.match(/(?:₹|rs\.?\s*)?(\d+(?:[.,]\d{1,2})?)\s*(k|thousand)?/i);
  if (amountMatch) {
    let value = parseFloat(amountMatch[1].replace(",", "."));
    if (amountMatch[2]) value *= 1000;
    amount = Math.round(value * 100);
    merchant = text.replace(amountMatch[0], " ").trim();
  }

  for (const [word, offset] of Object.entries(DATE_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) {
      date = addDays(todayISO(), offset);
      merchant = merchant.replace(new RegExp(word, "ig"), "").trim();
    }
  }

  const explicit = text.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (explicit) {
    const year = new Date().getFullYear();
    const iso = `${year}-${explicit[2].padStart(2, "0")}-${explicit[1].padStart(2, "0")}`;
    if (!Number.isNaN(new Date(iso).getTime())) {
      date = iso;
      merchant = merchant.replace(explicit[0], "").trim();
    }
  }

  merchant = merchant.replace(/\s+/g, " ").replace(/^(at|on|for)\s+/i, "").trim();

  return { amount, merchant: merchant || "Untitled", date, raw: text };
}
