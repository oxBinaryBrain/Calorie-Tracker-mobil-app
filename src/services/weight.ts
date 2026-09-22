import { dateFromKey } from '../utils';

export type WeightPoint = { date: string; weightKg: number };

export type WeightGoalPlan = {
  /** Target − current (negative = still to lose, positive = still to gain). */
  remainingKg: number;
  /** Recent linear pace in kg/week (least-squares over the window). */
  paceKgPerWeek: number | null;
  /** Weeks left at that pace; null when pace is flat or points are thin. */
  weeksLeft: number | null;
  /** Calendar date the pace would reach the target; null when unknown. */
  etaDate: string | null;
  atGoal: boolean;
};

const KG_EPSILON = 0.05;
const MIN_POINTS = 3;
const MAX_WEEKS = 104; // refuse to project more than two years out

/**
 * Least-squares slope of weight over time, expressed in kg per week.
 * Needs at least three points; returns null when the fit is unusable
 * (flat, single-point, or degenerate dates).
 */
export function paceKgPerWeek(points: WeightPoint[]): number | null {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < MIN_POINTS) return null;

  const t0 = dateFromKey(sorted[0].date).getTime();
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of sorted) {
    const days = (dateFromKey(p.date).getTime() - t0) / 86_400_000;
    xs.push(days);
    ys.push(p.weightKg);
  }
  const n = xs.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const perDay = num / den;
  return perDay * 7;
}

/**
 * Project when the current weight reaches the target at the recent pace.
 * Neutral on direction: sign of remainingKg and pace must agree, otherwise
 * weeksLeft stays null (moving the other way, or not moving yet).
 */
export function planWeightGoal(
  currentKg: number,
  targetKg: number,
  points: WeightPoint[],
  now: Date = new Date(),
): WeightGoalPlan {
  const remainingKg = Math.round((targetKg - currentKg) * 10) / 10;
  const atGoal = Math.abs(remainingKg) < KG_EPSILON;
  const pace = paceKgPerWeek(points);

  if (atGoal) {
    return { remainingKg: 0, paceKgPerWeek: pace, weeksLeft: 0, etaDate: null, atGoal: true };
  }
  if (pace == null || Math.abs(pace) < KG_EPSILON) {
    return { remainingKg, paceKgPerWeek: pace, weeksLeft: null, etaDate: null, atGoal: false };
  }
  // Pace must point the same way as the gap (losing when remaining < 0, etc.).
  if (Math.sign(pace) !== Math.sign(remainingKg)) {
    return { remainingKg, paceKgPerWeek: pace, weeksLeft: null, etaDate: null, atGoal: false };
  }

  const weeksLeft = remainingKg / pace;
  if (!Number.isFinite(weeksLeft) || weeksLeft <= 0 || weeksLeft > MAX_WEEKS) {
    return { remainingKg, paceKgPerWeek: pace, weeksLeft: null, etaDate: null, atGoal: false };
  }

  const eta = new Date(now.getTime() + weeksLeft * 7 * 86_400_000);
  const etaDate = `${eta.getFullYear()}-${String(eta.getMonth() + 1).padStart(2, '0')}-${String(eta.getDate()).padStart(2, '0')}`;
  return {
    remainingKg,
    paceKgPerWeek: Math.round(pace * 100) / 100,
    weeksLeft: Math.round(weeksLeft * 10) / 10,
    etaDate,
    atGoal: false,
  };
}
