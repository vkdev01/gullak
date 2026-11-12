/**
 * Period maths and plan arithmetic, browser side.
 *
 * The demo transport needs the same numbers the API computes, so this mirrors
 * api/app/services/periods.py and the budget/goal parts of plan.py. It is a
 * port, not a second opinion: when NEXT_PUBLIC_API_URL is set none of it runs.
 */

export const toISO = (d: Date) => d.toISOString().slice(0, 10);

export function addMonths(day: Date, months: number): Date {
  const d = new Date(day.getTime());
  const targetMonth = d.getMonth() + months;
  const result = new Date(d.getFullYear(), targetMonth, 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(d.getDate(), lastDay));
  return result;
}

export function periodBounds(anchorDay: number, on: Date): { start: string; end: string } {
  const anchor = Math.max(1, Math.min(anchorDay, 28));
  const thisMonth = new Date(on.getFullYear(), on.getMonth(), anchor);
  let start: Date;
  let end: Date;
  if (on >= thisMonth) {
    start = thisMonth;
    end = new Date(addMonths(thisMonth, 1).getTime() - 86400000);
  } else {
    start = addMonths(thisMonth, -1);
    end = new Date(thisMonth.getTime() - 86400000);
  }
  return { start: toISO(start), end: toISO(end) };
}

export function previousPeriod(anchorDay: number, startISO: string): { start: string; end: string } {
  const start = new Date(`${startISO}T00:00:00`);
  const prevStart = addMonths(start, -1);
  const end = new Date(start.getTime() - 86400000);
  return { start: toISO(prevStart), end: toISO(end) };
}

export function elapsedFraction(startISO: string, endISO: string, today: Date): number {
  const start = new Date(`${startISO}T00:00:00`).getTime();
  const end = new Date(`${endISO}T00:00:00`).getTime();
  const now = Math.min(today.getTime(), end);
  const total = Math.round((end - start) / 86400000) + 1;
  const done = Math.round((now - start) / 86400000) + 1;
  return Math.max(0, Math.min(1, done / total));
}

export function periodLabel(startISO: string, endISO: string): string {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  const fmt = (d: Date, withYear = false) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}) });
  if (start.getMonth() === end.getMonth()) {
    return start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  return `${fmt(start)} – ${fmt(end, true)}`;
}

export function daysBetween(aISO: string, bISO: string): number {
  return Math.round((new Date(`${bISO}T00:00:00`).getTime() - new Date(`${aISO}T00:00:00`).getTime()) / 86400000);
}
