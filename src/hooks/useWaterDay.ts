import * as React from 'react';
import { useAddWater, useDayTracker, useProfile, useUpsertTracker } from './queries';
import { usePrefs } from '../stores';
import { effectiveWaterGoalMl, waterGoalMet } from '../services/targets';
import { tickLight } from '../services/haptics';
import { dateKey } from '../utils';

/**
 * The daily water goal, both as shown (a user-set value wins) and as derived
 * from the profile alone. Goals & targets shows the derived one as the
 * fallback it is offering, so the two live here together.
 */
export function useWaterGoal() {
  const profile = useProfile();
  const goalPref = usePrefs((s) => s.waterGoalMl);
  const weightKg = profile.data?.weightKg;
  const activityLevel = profile.data?.activityLevel;
  return {
    /** Goal the rest of the UI shows: custom preference, else profile-derived. */
    goalMl: effectiveWaterGoalMl(goalPref, weightKg, activityLevel),
    /** Profile-derived goal, ignoring any custom preference. */
    autoGoalMl: effectiveWaterGoalMl(undefined, weightKg, activityLevel),
    isCustomGoal: goalPref != null,
  };
}

/**
 * Water for one day: the goal, how much is logged, and the two writes the UI
 * needs. Both writes read the stored value at write time rather than the
 * rendered total, so quick-adds that land before a re-render accumulate
 * instead of overwriting each other. Home, Trackers and the Water screen all
 * share this, so the goal derivation and the progress math stay in one place.
 */
export function useWaterDay(date: string = dateKey()) {
  const tracker = useDayTracker(date);
  const addWater = useAddWater();
  const upsert = useUpsertTracker();
  const { goalMl, isCustomGoal } = useWaterGoal();

  const loggedMl = tracker.data?.waterMl ?? 0;
  const percent = Math.min(100, Math.round((loggedMl / goalMl) * 100));
  const leftMl = Math.max(0, goalMl - loggedMl);

  const add = React.useCallback(
    (ml: number) => {
      tickLight();
      addWater.mutate({ date, ml });
    },
    [addWater, date],
  );

  const setWaterMl = React.useCallback(
    (ml: number) => {
      upsert.mutate({ date, waterMl: Math.max(0, ml) });
    },
    [upsert, date],
  );

  return {
    goalMl,
    loggedMl,
    leftMl,
    percent,
    met: waterGoalMet(loggedMl, goalMl),
    isCustomGoal,
    add,
    setWaterMl,
  };
}
