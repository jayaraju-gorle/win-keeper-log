/** All dates are local-calendar "YYYY-MM-DD" strings; never UTC-sliced ISO strings. */

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return toDateKey(parseDateKey(v)) === v;
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** Monday of the ISO week containing `key`. */
/** Whole calendar days from `a` to `b` (DST-safe). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDateKey(a),
    pb = parseDateKey(b);
  return Math.round(
    (Date.UTC(pb.getFullYear(), pb.getMonth(), pb.getDate()) -
      Date.UTC(pa.getFullYear(), pa.getMonth(), pa.getDate())) /
      86_400_000,
  );
}

export function startOfWeek(key: string): string {
  const d = parseDateKey(key);
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(key, -offset);
}

export function startOfMonth(key: string): string {
  return key.slice(0, 8) + "01";
}

export function addMonths(key: string, n: number): string {
  const d = parseDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

export function dayOfWeek(key: string): number {
  return parseDateKey(key).getDay();
}

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Display order, Monday first. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
