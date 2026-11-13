import { addDays, todayISO } from "./format";
import { normaliseTags } from "./tags";

export type ParsedTransaction = {
  amount: number | null; // paise
  merchant: string;
  date: string;
  note: string;
  tags: string[];
  raw: string;
};

const DATE_WORDS: Record<string, number> = { today: 0, yesterday: -1 };

/**
 * "320 swiggy yesterday" → { amount: 32000, merchant: "swiggy", date: … }
 * "450 petrol, full tank before the trip #car #trip" also carries a note and tags:
 * anything after ", " is the note, and #words are tags.
 * Deliberately forgiving: it is a capture shortcut, not a parser to trust blindly.
 */
export function parseQuickAdd(raw: string): ParsedTransaction {
  const tags = normaliseTags((raw.match(/#[\w-]+/g) ?? []).map((t) => t.slice(1)));
  const withoutTags = raw.replace(/#[\w-]+/g, " ");
  // ", " (comma then space) starts the note; a bare comma stays part of an amount like 1,200
  const split = withoutTags.search(/,\s/);
  const note = split >= 0 ? withoutTags.slice(split + 1).replace(/\s+/g, " ").trim() : "";
  const text = (split >= 0 ? withoutTags.slice(0, split) : withoutTags).trim();
  let amount: number | null = null;
  let merchant = text;
  let date = todayISO();

  // 1,200 and 1,20,000 are grouped thousands, not decimals; decimals only follow a dot
  const amountMatch = text.match(/(?:₹|rs\.?\s*)?(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d{1,2})?\s*(k|thousand)?/i);
  if (amountMatch) {
    let value = parseFloat(amountMatch[1].replace(/,/g, "") + (amountMatch[2] ?? ""));
    if (amountMatch[3]) value *= 1000;
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

  return { amount, merchant: merchant || "Untitled", date, note, tags, raw: raw.trim() };
}
