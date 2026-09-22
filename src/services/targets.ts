import type { ActivityLevel, Goal, OnboardingPayload, UserTargets } from '../types';

/**
 * Mifflin-St Jeor BMR (client-side PREVIEW ONLY).
 * The value shown while POST /onboarding is in flight; the server response is
 * the source of truth and overwrites this once it lands.
 *
 *   BMR (male)   = 10·kg + 6.25·cm − 5·age + 5
 *   BMR (female) = 10·kg + 6.25·cm − 5·age − 161
 *   BMR (other)  = average of the two formulas
 *
 * Reference implementation: https://github.com/derfmilo/fitness-macros-calculator
 */
export function bmrMifflinStJeor(weightKg: number, heightCm: number, age: number, sex: 'female' | 'male' | 'other'): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // average of +5 and -161
}

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const GOAL_DELTA_KCAL: Record<Goal, number> = {
  lose: -450,
  maintain: 0,
  gain: 350,
};

export function previewTargets(profile: OnboardingPayload): UserTargets {
  const bmr = bmrMifflinStJeor(profile.weightKg, profile.heightCm, profile.age, profile.sex);
  const tdee = bmr * ACTIVITY_FACTORS[profile.activityLevel];
  const dailyCalories = Math.max(1200, Math.round(tdee + GOAL_DELTA_KCAL[profile.goal]));

  // Macro split by goal — modest, sustainable defaults.
  const proteinPerKg = profile.goal === 'lose' ? 1.8 : profile.goal === 'gain' ? 1.7 : 1.6;
  const proteinGrams = Math.round(profile.weightKg * proteinPerKg);
  const fatCalShare = profile.goal === 'lose' ? 0.28 : 0.3;
  const fatGrams = Math.round((dailyCalories * fatCalShare) / 9);
  const carbsGrams = Math.max(50, Math.round((dailyCalories - proteinGrams * 4 - fatGrams * 9) / 4));

  return { dailyCalories, carbsGrams, proteinGrams, fatGrams };
}

/**
 * Personalized daily water goal. ~30 ml per kg of body weight (the commonly
 * used adequate-intake rule of thumb), plus a modest allowance for the
 * typical activity level. Clamped to 1.5-4 L and rounded to 50 ml so the
 * number stays readable. Falls back to a plain 2 L when the profile is
 * incomplete — a starting point, never a prescription.
 */
const ACTIVITY_WATER_ML: Record<ActivityLevel, number> = {
  sedentary: 0,
  light: 250,
  moderate: 500,
  active: 750,
  athlete: 1000,
};

export function waterGoalMl(weightKg?: number, activityLevel?: ActivityLevel): number {
  const base = weightKg != null && weightKg > 0 ? weightKg * 30 : 2000;
  const extra = activityLevel ? ACTIVITY_WATER_ML[activityLevel] : 250;
  return Math.round(Math.min(4000, Math.max(1500, base + extra)) / 50) * 50;
}

/**
 * Water goal actually shown in the UI: a user-set value from prefs when
 * present (rounded to 50 ml), otherwise the profile-derived default.
 */
export function effectiveWaterGoalMl(
  customMl: number | null | undefined,
  weightKg?: number,
  activityLevel?: ActivityLevel,
): number {
  if (customMl != null && customMl > 0) return Math.round(customMl / 50) * 50;
  return waterGoalMl(weightKg, activityLevel);
}
