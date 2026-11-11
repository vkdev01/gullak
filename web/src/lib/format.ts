/** Money and date formatting. Money is always integer paise in, string out. */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const money = (paise: number) => INR.format(paise / 100);

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { month: "long" });
}
