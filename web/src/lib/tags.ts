/** Tag rules shared with the API (api/app/services/tags.py): lowercase, a-z 0-9 - _, max 12. */

const MAX_TAGS = 12;
const MAX_LEN = 32;

export function normaliseTags(input: string[] | string): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[\s,]+/);
  const out: string[] = [];
  for (const item of raw) {
    const tag = item
      .trim()
      .replace(/^#+/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, MAX_LEN);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, MAX_TAGS);
}
