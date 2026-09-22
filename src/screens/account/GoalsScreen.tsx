import * as React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import { useTargets, useUpdateTargets, useProfile } from '../../hooks/queries';
import { effectiveWaterGoalMl } from '../../services/targets';
import { NumberField, PrimaryButton } from '../../components/inputs';
import { Screen, SectionTitle } from '../../components/ui';
import { usePrefs, useToasts } from '../../stores';

type Form = {
  dailyCalories: number | undefined;
  carbsGrams: number | undefined;
  proteinGrams: number | undefined;
  fatGrams: number | undefined;
  /** Liters; undefined = auto-derived from profile. */
  waterLiters: number | undefined;
};

export default function GoalsScreen({ navigation }: NativeStackScreenProps<AccountTabParams, 'Goals'>) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const targetsQuery = useTargets();
  const updateTargets = useUpdateTargets();
  const profile = useProfile();
  const waterGoalPref = usePrefs((s) => s.waterGoalMl);
  const setWaterGoal = usePrefs((s) => s.setWaterGoal);
  const targets = targetsQuery.data;

  const [form, setForm] = React.useState<Form>({
    dailyCalories: undefined,
    carbsGrams: undefined,
    proteinGrams: undefined,
    fatGrams: undefined,
    waterLiters: undefined,
  });
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (targets && !loaded) {
      setForm((f) => ({
        ...f,
        dailyCalories: targets.dailyCalories,
        carbsGrams: targets.carbsGrams,
        proteinGrams: targets.proteinGrams,
        fatGrams: targets.fatGrams,
      }));
      setLoaded(true);
    }
  }, [targets, loaded]);

  React.useEffect(() => {
    if (loaded && form.waterLiters == null && waterGoalPref != null) {
      setForm((f) => (f.waterLiters == null ? { ...f, waterLiters: waterGoalPref / 1000 } : f));
    }
  }, [loaded, waterGoalPref, form.waterLiters]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (form.dailyCalories == null || form.carbsGrams == null || form.proteinGrams == null || form.fatGrams == null) {
      show('Fill in all four numbers');
      return;
    }
    // Water is a local preference; persist it before the network round-trip.
    setWaterGoal(form.waterLiters != null && form.waterLiters > 0 ? Math.round(form.waterLiters * 1000) : null);
    try {
      await updateTargets.mutateAsync({
        dailyCalories: form.dailyCalories,
        carbsGrams: form.carbsGrams,
        proteinGrams: form.proteinGrams,
        fatGrams: form.fatGrams,
      });
      show('Targets updated');
      navigation.goBack();
    } catch {
      show('Targets saved on this device; the server was unreachable');
    }
  };

  const derivedWater = effectiveWaterGoalMl(undefined, profile.data?.weightKg, profile.data?.activityLevel);

  return (
    <Screen scroll title="Goals & targets">
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
        These guide the rings and bars. Adjust freely, nothing is enforced.
      </Text>

      <SectionTitle text="Daily calories" />
      <NumberField label="Calories per day" suffix="kcal" value={form.dailyCalories} onChange={(v) => set({ dailyCalories: v })} />

      <SectionTitle text="Macros (grams per day)" />
      <NumberField label="Carbs" suffix="g" value={form.carbsGrams} onChange={(v) => set({ carbsGrams: v })} />
      <NumberField label="Protein" suffix="g" value={form.proteinGrams} onChange={(v) => set({ proteinGrams: v })} />
      <NumberField label="Fat" suffix="g" value={form.fatGrams} onChange={(v) => set({ fatGrams: v })} />

      <SectionTitle text="Water" />
      <NumberField
        label="Water per day"
        suffix="L"
        value={form.waterLiters}
        onChange={(v) => set({ waterLiters: v })}
        placeholder={(derivedWater / 1000).toFixed(1)}
      />
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant, marginTop: 6 }]}>
        Leave empty to keep the auto goal ({(derivedWater / 1000).toFixed(1)} L from your weight and activity).
      </Text>

      <PrimaryButton onPress={() => void save()} loading={updateTargets.isPending} style={{ marginTop: 12 }}>
        Save targets
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13.5, marginBottom: 8 },
});
