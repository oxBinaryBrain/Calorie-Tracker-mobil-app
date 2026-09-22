import { describe, expect, it } from 'vitest';
import { paceKgPerWeek, planWeightGoal, type WeightPoint } from '../src/services/weight';

const line = (startKg: number, perWeek: number, weeks: number[]): WeightPoint[] =>
  weeks.map((w) => ({
    date: new Date(2026, 0, 1 + w * 7).toISOString().slice(0, 10),
    weightKg: startKg + perWeek * w,
  }));

describe('paceKgPerWeek', () => {
  it('returns null with fewer than three points', () => {
    expect(paceKgPerWeek([])).toBeNull();
    expect(paceKgPerWeek([{ date: '2026-01-01', weightKg: 80 }])).toBeNull();
    expect(
      paceKgPerWeek([
        { date: '2026-01-01', weightKg: 80 },
        { date: '2026-01-08', weightKg: 79.5 },
      ]),
    ).toBeNull();
  });

  it('measures a steady loss in kg per week', () => {
    expect(paceKgPerWeek(line(80, -0.7, [0, 1, 2]))).toBeCloseTo(-0.7, 5);
    expect(paceKgPerWeek(line(70, 0.5, [0, 1, 2, 3]))).toBeCloseTo(0.5, 5);
  });

  it('returns 0 for a flat weight (usable, but not a direction)', () => {
    expect(paceKgPerWeek(line(80, 0, [0, 1, 2]))).toBe(0);
  });

  it('sorts out-of-order points before fitting', () => {
    const pts: WeightPoint[] = [
      { date: '2026-01-15', weightKg: 78.6 },
      { date: '2026-01-01', weightKg: 80 },
      { date: '2026-01-08', weightKg: 79.3 },
    ];
    expect(paceKgPerWeek(pts)).toBeCloseTo(-0.7, 5);
  });

  it('returns null when every point shares one date', () => {
    expect(
      paceKgPerWeek([
        { date: '2026-01-01', weightKg: 80 },
        { date: '2026-01-01', weightKg: 79 },
        { date: '2026-01-01', weightKg: 78 },
      ]),
    ).toBeNull();
  });
});

describe('planWeightGoal', () => {
  const now = new Date(2026, 8, 22, 12);

  it('reports at-goal when the gap is within 0.05 kg', () => {
    const plan = planWeightGoal(70, 70, line(70, 0, [0, 1, 2]), now);
    expect(plan.atGoal).toBe(true);
    expect(plan.remainingKg).toBe(0);
    expect(plan.weeksLeft).toBe(0);
    expect(plan.etaDate).toBeNull();
  });

  it('projects an ETA when pace points toward the target', () => {
    const plan = planWeightGoal(80, 75, line(80, -0.7, [0, 1, 2]), now);
    expect(plan.remainingKg).toBe(-5);
    expect(plan.paceKgPerWeek).toBe(-0.7);
    expect(plan.weeksLeft).toBe(7.1);
    expect(plan.etaDate).toBe('2026-11-11'); // now + 50 days
    expect(plan.atGoal).toBe(false);
  });

  it('refuses to project when pace is flat or missing', () => {
    const flat = planWeightGoal(80, 75, line(80, 0, [0, 1, 2]), now);
    expect(flat.weeksLeft).toBeNull();
    expect(flat.etaDate).toBeNull();

    const thin = planWeightGoal(80, 75, [{ date: '2026-01-01', weightKg: 80 }], now);
    expect(thin.weeksLeft).toBeNull();
  });

  it('refuses to project when pace moves away from the target', () => {
    const plan = planWeightGoal(80, 75, line(80, 0.5, [0, 1, 2]), now);
    expect(plan.paceKgPerWeek).toBeCloseTo(0.5, 5);
    expect(plan.weeksLeft).toBeNull();
    expect(plan.etaDate).toBeNull();
  });

  it('refuses to project beyond two years', () => {
    const plan = planWeightGoal(90, 70, line(90, -0.06, [0, 1, 2]), now);
    expect(plan.weeksLeft).toBeNull(); // 333 weeks > 104
    expect(plan.etaDate).toBeNull();
  });

  it('rounds the remaining gap to one decimal', () => {
    expect(planWeightGoal(80.26, 75, line(80, -0.7, [0, 1, 2]), now).remainingKg).toBe(-5.3);
  });
});
