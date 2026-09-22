import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import type { ActivityLevel, Goal, Profile, Sex } from '../../types';
import { useProfile, useSetProfile } from '../../hooks/queries';
import { ChoiceGroup, PrimaryButton } from '../../components/inputs';
import { Screen, SectionTitle } from '../../components/ui';
import { useToasts } from '../../stores';

type Form = {
  displayName: string;
  heightCm: number | undefined;
  weightKg: number | undefined;
  age: number | undefined;
  sex: Sex | undefined;
  activityLevel: ActivityLevel | undefined;
  goal: Goal | undefined;
  targetWeightKg: number | undefined;
};

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: 'sedentary', label: 'Mostly sitting' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'athlete', label: 'Athlete' },
];

const GOAL_OPTIONS: Array<{ value: Goal; label: string }> = [
  { value: 'lose', label: 'Lose' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain' },
];

const AVATARS = ['🌿', '🌱', '🍀', '🍎', '🥑', '🍋', '🫐', '🐱', '🐼', '☀️'];

export default function ProfileScreen({ navigation }: NativeStackScreenProps<AccountTabParams, 'Profile'>) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const profileQuery = useProfile();
  const setProfile = useSetProfile();
  const existing = profileQuery.data;

  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<Form>({
    defaultValues: {
      displayName: '',
      heightCm: undefined,
      weightKg: undefined,
      age: undefined,
      sex: undefined,
      activityLevel: undefined,
      goal: undefined,
      targetWeightKg: undefined,
    },
  });

  React.useEffect(() => {
    if (existing) {
      reset({
        displayName: existing.displayName ?? '',
        heightCm: existing.heightCm,
        weightKg: existing.weightKg,
        age: existing.age,
        sex: existing.sex,
        activityLevel: existing.activityLevel,
        goal: existing.goal,
        targetWeightKg: existing.targetWeightKg,
      });
    }
  }, [existing, reset]);

  const [avatarValue, setAvatarValue] = React.useState('🌿');

  React.useEffect(() => {
    if (existing) setAvatarValue(existing.avatarEmoji ?? '🌿');
  }, [existing?.avatarEmoji]);

  const onSubmit = handleSubmit(async (v) => {
    if (v.heightCm == null || v.weightKg == null || v.age == null || v.sex == null || v.activityLevel == null) {
      show('Fill in the basics so targets stay sensible');
      return;
    }
    const profile: Profile = {
      heightCm: v.heightCm,
      weightKg: v.weightKg,
      age: v.age,
      sex: v.sex,
      activityLevel: v.activityLevel,
      goal: v.goal ?? 'maintain',
      targetWeightKg: v.targetWeightKg,
      displayName: v.displayName?.trim() || undefined,
      avatarEmoji: avatarValue,
    };
    await setProfile.mutateAsync(profile);
    show('Profile saved');
    navigation.goBack();
  });

  return (
    <Screen scroll title="Profile">

      <SectionTitle text="Avatar" />
      <View style={styles.avatars}>
        {AVATARS.map((a) => (
          <Pressable
            key={a}
            onPress={() => setAvatarValue(a)}
            style={[
              styles.avatarOption,
              { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant },
              a === avatarValue && { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary },
            ]}
          >
            <Text style={{ fontSize: 22 }}>{a}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle text="Name" />
      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, value } }) => (
          <TextInput label="Display name (optional)" mode="outlined" value={value} onChangeText={onChange} placeholder="e.g. Riley" />
        )}
      />

      <SectionTitle text="Body" />
      <View style={styles.row}>
        <Controller control={control} name="heightCm" render={({ field: { onChange, value } }) => (
          <TextInput
            label="Height (cm)"
            mode="outlined"
            keyboardType="decimal-pad"
            value={value != null ? String(value) : ''}
            onChangeText={(t) => onChange(t === '' ? undefined : Number(t.replace(',', '.')))}
            style={styles.field}
          />
        )} />
        <Controller control={control} name="weightKg" render={({ field: { onChange, value } }) => (
          <TextInput
            label="Weight (kg)"
            mode="outlined"
            keyboardType="decimal-pad"
            value={value != null ? String(value) : ''}
            onChangeText={(t) => onChange(t === '' ? undefined : Number(t.replace(',', '.')))}
            style={styles.field}
          />
        )} />
      </View>
      <View style={styles.row}>
        <Controller control={control} name="age" render={({ field: { onChange, value } }) => (
          <TextInput
            label="Age"
            mode="outlined"
            keyboardType="decimal-pad"
            value={value != null ? String(value) : ''}
            onChangeText={(t) => onChange(t === '' ? undefined : Number(t.replace(',', '.')))}
            style={styles.field}
          />
        )} />
        <Controller control={control} name="targetWeightKg" render={({ field: { onChange, value } }) => (
          <TextInput
            label="Target kg (optional)"
            mode="outlined"
            keyboardType="decimal-pad"
            value={value != null ? String(value) : ''}
            onChangeText={(t) => onChange(t === '' ? undefined : Number(t.replace(',', '.')))}
            style={styles.field}
          />
        )} />
      </View>

      <Controller control={control} name="sex" render={({ field: { onChange, value } }) => (
        <ChoiceGroup label="Sex" options={SEX_OPTIONS} value={value} onChange={onChange} columns={3} />
      )} />
      <Controller control={control} name="activityLevel" render={({ field: { onChange, value } }) => (
        <ChoiceGroup label="Typical activity" options={ACTIVITY_OPTIONS} value={value} onChange={onChange} columns={2} />
      )} />
      <Controller control={control} name="goal" render={({ field: { onChange, value } }) => (
        <ChoiceGroup label="Goal" options={GOAL_OPTIONS} value={value} onChange={onChange} columns={3} />
      )} />

      <PrimaryButton onPress={() => void onSubmit()} loading={isSubmitting}>
        Save profile
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  avatarOption: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  row: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
});
