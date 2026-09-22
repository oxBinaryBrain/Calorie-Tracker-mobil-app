import { describe, expect, it } from 'vitest';
import { bmrMifflinStJeor, previewTargets, waterGoalMl } from '../src/services/targets';
import type { OnboardingPayload } from '../src/types';

const profile = (over: Partial<OnboardingPayload> = {}): OnboardingPayload => ({
  heightCm: 175,
  weightKg: 70,
  age: 30,
  sex: 'male',
  activityLevel: 'moderate',
  goal: 'maintain',
  ...over,
});

describe('bmrMifflinStJeor', () => {
  it('computes the male formula (10·kg + 6.25·cm − 5·age + 5)', () => {
    // 700 + 1093.75 - 150 + 5
    expect(bmrMifflinStJeor(70, 175, 30, 'male')).toBeCloseTo(1648.75, 2);
  });

  it('computes the female formula (−161)', () => {
    expect(bmrMifflinStJeor(70, 175, 30, 'female')).toBeCloseTo(1482.75, 2);
  });

  it('averages the two formulas for "other" (−78)', () => {
    // base 1643.75, so other = 1643.75 − 78
    expect(bmrMifflinStJeor(70, 175, 30, 'other')).toBeCloseTo(1565.75, 2);
  });
});

describe('previewTargets', () => {
  // Live cross-check: the demo profile (moderate + gain) renders 2,906 kcal,
  // 119 g protein, 97 g fat, 389 g carbs in the running app.
  it('matches the app-rendered demo numbers (moderate, gain)', () => {
    const t = previewTargets(profile({ goal: 'gain' }));
    // BMR 1648.75 × 1.55 = 2555.5625 + 350 → round → 2906
    expect(t.dailyCalories).toBe(2906);
    expect(t.proteinGrams).toBe(119); // 70 kg × 1.7
    expect(t.fatGrams).toBe(97); // 2906 × 0.30 / 9
    expect(t.carbsGrams).toBe(389); // (2906 − 119·4 − 97·9) / 4
  });

  it('applies the lose deficit (−450) and higher protein per kg', () => {
    const t = previewTargets(profile({ goal: 'lose' }));
    expect(t.dailyCalories).toBe(2106); // round(2555.5625 − 450)
    expect(t.proteinGrams).toBe(126); // 70 kg × 1.8
  });

  it('never goes below the 1200 kcal floor', () => {
    const t = previewTargets(profile({ weightKg: 40, heightCm: 120, age: 80, sex: 'female', activityLevel: 'sedentary', goal: 'lose' }));
    expect(t.dailyCalories).toBe(1200);
  });

  it('keeps macros consistent with the calorie target', () => {
    const t = previewTargets(profile({ goal: 'maintain' }));
    const kcalFromMacros = t.proteinGrams * 4 + t.carbsGrams * 4 + t.fatGrams * 9;
    // Carb remainder is rounded and floored at 50 g, so allow slack.
    expect(kcalFromMacros).toBeGreaterThanOrEqual(t.dailyCalories - 40);
    expect(kcalFromMacros).toBeLessThanOrEqual(t.dailyCalories + 250);
  });
});

describe('waterGoalMl', () => {
  it('uses ~30 ml per kg plus the activity allowance', () => {
    expect(waterGoalMl(70, 'moderate')).toBe(2600); // 2100 + 500 — matches the app's 2.6 L
  });

  it('falls back to ~2 L when the profile is incomplete', () => {
    expect(waterGoalMl(undefined, undefined)).toBe(2250); // 2000 + 250 default allowance
    expect(waterGoalMl(0, 'active')).toBe(2750); // fallback base + active 750
  });

  it('clamps to 1.5–4 L and rounds to 50 ml', () => {
    expect(waterGoalMl(45, 'sedentary')).toBe(1500); // 1350 → floor clamp
    expect(waterGoalMl(200, 'athlete')).toBe(4000); // 7000 → ceiling clamp
    expect(waterGoalMl(61.4, 'light')).toBe(2100); // 1842 + 250 = 2092 → 2100
  });
});
