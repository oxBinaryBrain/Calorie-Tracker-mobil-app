/** Local-time YYYY-MM-DD key for a Date (defaults to now). */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, days: number): string {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** First day of the month containing a YYYY-MM-DD key, as YYYY-MM-01. */
export function monthKeyOf(key: string): string {
  return `${key.slice(0, 4)}-${key.slice(5, 7)}-01`;
}

export function formatDateLong(key: string): string {
  return dateFromKey(key).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatKcal(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatGrams(n?: number | null): string | null {
  if (n == null || Number.isNaN(n)) return null;
  return `${Math.round(n)} g`;
}

export function formatMl(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')} L` : `${Math.round(n)} ml`;
}

export function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : undefined;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Pluralized duration label from minutes ("45 min", "1 h 20 min"). */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';

/** Which meal a time-of-day falls in. 23:00–04:59 counts as a snack. */
export function mealSlot(loggedAt: string): MealSlot {
  const h = new Date(loggedAt).getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 15 && h < 18) return 'snack';
  if (h >= 18 && h < 23) return 'dinner';
  return 'snack';
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
