import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import { useTargets, useUpdateTargets } from '../../hooks/queries';
import { previewTargets } from '../../services/targets';
import { NumberField, PrimaryButton } from '../../components/inputs';
import { Screen, SectionTitle } from '../../components/ui';
import { useToasts } from '../../stores';

type Form = {
  dailyCalories: number | undefined;
  carbsGrams: number | undefined;
  proteinGrams: number | undefined;
  fatGrams: number | undefined;
};

export default function GoalsScreen({ navigation }: NativeStackScreenProps<AccountTabParams, 'Goals'>) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const targetsQuery = useTargets();
  const updateTargets = useUpdateTargets();
  const targets = targetsQuery.data;

  const [form, setForm] = React.useState<Form>({
    dailyCalories: undefined,
    carbsGrams: undefined,
    proteinGrams: undefined,
    fatGrams: undefined,
  });
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (targets && !loaded) {
      setForm({
        dailyCalories: targets.dailyCalories,
        carbsGrams: targets.carbsGrams,
        proteinGrams: targets.proteinGrams,
        fatGrams: targets.fatGrams,
      });
      setLoaded(true);
    }
  }, [targets, loaded]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (form.dailyCalories == null || form.carbsGrams == null || form.proteinGrams == null || form.fatGrams == null) {
      show('Fill in all four numbers');
      return;
    }
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
      show('Saved on this device; the server was unreachable');
    }
  };

  const suggested = null;
  void suggested;

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

      <PrimaryButton onPress={() => void save()} loading={updateTargets.isPending} style={{ marginTop: 12 }}>
        Save targets
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13.5, marginBottom: 8 },
});
