/** Recurring detection, browser side — the port of api/app/services/recurring.py. */

import type { Txn } from "./api/types";
import { toISO } from "./plan";

export type Series = {
  merchant: string;
  cadence: "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";
  occurrences: number;
  expected_amount: number;
  last_seen: string;
  next_due: string;
  is_subscription: boolean;
  price_change: number;
};

const BANDS: Record<string, [number, number, number]> = {
  weekly: [6, 8, 7],
  fortnightly: [13, 16, 14],
  monthly: [27, 32, 30],
  quarterly: [85, 95, 91],
  yearly: [360, 370, 365],
};

const HINTS = ["NETFLIX", "HOTSTAR", "SPOTIFY", "PRIME", "YOUTUBE", "ICLOUD", "GOOGLE ONE", "AUDIBLE", "CULT"];

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const stdev = (values: number[]) => Math.sqrt(mean(values.map((v) => (v - mean(values)) ** 2)));

export function detectSeries(transactions: Txn[], today = new Date()): Series[] {
  const byMerchant = new Map<string, Txn[]>();
  for (const t of transactions) {
    if (t.direction !== "debit") continue;
    const list = byMerchant.get(t.merchant) ?? [];
    list.push(t);
    byMerchant.set(t.merchant, list);
  }

  const out: Series[] = [];
  for (const [merchant, items] of byMerchant) {
    if (items.length < 3) continue;
    const dates = items.map((i) => i.occurred_at).sort();
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const gap = Math.round((new Date(`${dates[i]}T00:00:00`).getTime() - new Date(`${dates[i - 1]}T00:00:00`).getTime()) / 86400000);
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length < 2) continue;

    const gapMedian = median(gaps);
    const cadence = (Object.keys(BANDS) as Series["cadence"][]).find(
      (name) => gapMedian >= BANDS[name][0] && gapMedian <= BANDS[name][1],
    );
    if (!cadence) continue;
    if (stdev(gaps) > gapMedian * 0.35) continue;

    const amounts = items.map((i) => i.amount);
    const meanAmount = mean(amounts);
    if (meanAmount <= 0 || stdev(amounts) / meanAmount > 0.25) continue;

    const step = BANDS[cadence][2];
    const last = new Date(`${dates[dates.length - 1]}T00:00:00`);
    const next = new Date(last.getTime() + step * 86400000);
    while (next < today) next.setDate(next.getDate() + step);

    const earlier = amounts.length > 1 ? median(amounts.slice(0, -1)) : amounts[amounts.length - 1];
    const change = amounts[amounts.length - 1] - earlier;

    out.push({
      merchant,
      cadence,
      occurrences: items.length,
      expected_amount: Math.round(meanAmount),
      last_seen: dates[dates.length - 1],
      next_due: toISO(next),
      is_subscription: HINTS.some((h) => merchant.toUpperCase().includes(h)) || (cadence === "monthly" && items.length >= 3),
      price_change: Math.abs(change) > Math.max(meanAmount * 0.05, 1000) ? Math.round(change) : 0,
    });
  }

  return out.sort((a, b) => (a.next_due < b.next_due ? -1 : 1));
}
