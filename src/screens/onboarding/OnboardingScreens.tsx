import * as React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Controller, useForm } from 'react-hook-form';
import { Button, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParams } from '../../navigation/types';
import type { ActivityLevel, Goal, OnboardingPayload, Sex, UserTargets } from '../../types';
import { api } from '../../api/client';
import { useSession, useToasts } from '../../stores';
import { previewTargets } from '../../services/targets';
import { useSetProfile, useSetTargets } from '../../hooks/queries';
import { ChoiceGroup, NumberField, PrimaryButton } from '../../components/inputs';
import { AppHeader, CalorieRing, MacroBars } from '../../components/ui';
import { fontFamilies } from '../../theme';

type OnboardingForm = {
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

const STEP_COUNT = 3;

// One place for everything that changes per step: heading, subline that sets
// expectations, and the small icon that anchors the step visually.
const STEP_META: Array<{ title: string; sub: string; icon: string }> = [
  { title: 'A few basics', sub: 'Just numbers — height, weight, age.', icon: 'ruler' },
  { title: 'About you', sub: 'This shapes your daily estimate.', icon: 'account-outline' },
  { title: 'Your goal', sub: 'Where would you like to head?', icon: 'flag-outline' },
];

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Mostly sitting',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  athlete: 'Athlete',
};

const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose',
  maintain: 'Maintain',
  gain: 'Gain',
};

/** Cross-fade + slight rise between steps; a settled variant on native, where
 * the stack already animates, mirrors ScreenEntrance's convention. */
function StepFade({ stepKey, children }: { stepKey: number; children: React.ReactNode }) {
  const animated = Platform.OS !== 'web';
  const fade = React.useRef(new Animated.Value(animated ? 1 : 0)).current;
  const rise = React.useRef(new Animated.Value(animated ? 0 : 10)).current;
  React.useEffect(() => {
    fade.setValue(animated ? 1 : 0);
    rise.setValue(animated ? 0 : 10);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [stepKey, fade, rise, animated]);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>{children}</Animated.View>;
}

export function OnboardingScreen({ navigation }: NativeStackScreenProps<OnboardingStackParams, 'Onboarding'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const show = useToasts((s) => s.show);
  const setProfile = useSetProfile();
  const [step, setStep] = React.useState(0);
  const { control, watch, getValues, formState } = useForm<OnboardingForm>();
  const values = watch();
  const submitting = formState.isSubmitting;

  const canContinue = (() => {
    if (step === 0) return values.heightCm != null && values.weightKg != null && values.age != null;
    if (step === 1) return values.sex != null && values.activityLevel != null;
    return values.goal != null;
  })();

  const submit = async () => {
    const v = getValues();
    if (v.heightCm == null || v.weightKg == null || v.age == null || v.sex == null || v.activityLevel == null || v.goal == null) {
      return;
    }
    const profile: OnboardingPayload = {
      heightCm: v.heightCm,
      weightKg: v.weightKg,
      age: v.age,
      sex: v.sex,
      activityLevel: v.activityLevel,
      goal: v.goal,
      targetWeightKg: v.targetWeightKg,
    };
    // Instant client-side preview (Mifflin-St Jeor); the server response in
    // TargetReveal is the source of truth and replaces this.
    const preview = previewTargets(profile);
    setProfile.mutate(profile);
    navigation.replace('TargetReveal', { targets: preview, profile });
  };

  const meta = STEP_META[step];

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        {step > 0 ? <AppHeader onBack={() => setStep(step - 1)} hairline={false} /> : <View style={{ height: 48 }} />}
        <View style={styles.progressTrack}>
          <View style={[styles.progressRail, { backgroundColor: theme.colors.outlineVariant }]} />
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.colors.primary,
                width: `${((step + 1) / STEP_COUNT) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.stepCount, { color: theme.colors.onSurfaceVariant }]}>
          Step {step + 1} of {STEP_COUNT}
        </Text>
      </View>

      <StepFade stepKey={step}>
        <View style={styles.stepHeading}>
          <View style={[styles.stepIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name={meta.icon as any} size={22} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text style={[styles.stepTitle, { color: theme.colors.onBackground }]}>{meta.title}</Text>
          <Text style={[styles.stepSub, { color: theme.colors.onSurfaceVariant }]}>{meta.sub}</Text>
        </View>
      </StepFade>

      <StepFade stepKey={step + 10}>
        <View style={styles.stepBody}>
          {step === 0 && (
            <>
              <Controller
                control={control}
                name="heightCm"
                render={({ field: { onChange } }) => (
                  <NumberField label="Height" suffix="cm" value={values.heightCm} onChange={onChange} autoFocus />
                )}
              />
              <Controller
                control={control}
                name="weightKg"
                render={({ field: { onChange } }) => (
                  <NumberField label="Weight" suffix="kg" value={values.weightKg} onChange={onChange} />
                )}
              />
              <Controller
                control={control}
                name="age"
                render={({ field: { onChange } }) => (
                  <NumberField label="Age" suffix="years" value={values.age} onChange={onChange} />
                )}
              />
            </>
          )}

          {step === 1 && (
            <>
              <Controller
                control={control}
                name="sex"
                render={({ field: { onChange } }) => (
                  <ChoiceGroup label="Sex" options={SEX_OPTIONS} value={values.sex} onChange={onChange} columns={3} />
                )}
              />
              <Controller
                control={control}
                name="activityLevel"
                render={({ field: { onChange } }) => (
                  <ChoiceGroup label="Typical activity" options={ACTIVITY_OPTIONS} value={values.activityLevel} onChange={onChange} columns={2} />
                )}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Controller
                control={control}
                name="goal"
                render={({ field: { onChange } }) => (
                  <ChoiceGroup label="Goal" options={GOAL_OPTIONS} value={values.goal} onChange={onChange} columns={3} />
                )}
              />
              <Controller
                control={control}
                name="targetWeightKg"
                render={({ field: { onChange } }) => (
                  <NumberField label="Target weight (optional)" suffix="kg" value={values.targetWeightKg} onChange={onChange} />
                )}
              />
              <View style={[styles.recap, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.recapText, { color: theme.colors.onSurfaceVariant }]}>
                  {[
                    values.heightCm != null && `${values.heightCm} cm`,
                    values.weightKg != null && `${values.weightKg} kg`,
                    values.age != null && `${values.age} yrs`,
                    values.activityLevel && ACTIVITY_LABELS[values.activityLevel],
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {values.goal ? ` — ${GOAL_LABELS[values.goal].toLowerCase()}` : ''}
                </Text>
              </View>
            </>
          )}
        </View>
      </StepFade>

      <View style={styles.footer}>
        {step > 0 ? <Button onPress={() => setStep(step - 1)}>Back</Button> : <View />}
        <PrimaryButton
          disabled={!canContinue}
          loading={submitting}
          onPress={() => (step < STEP_COUNT - 1 ? setStep(step + 1) : void submit())}
          style={{ flex: 1, marginLeft: step > 0 ? 8 : 0 }}
        >
          {step < STEP_COUNT - 1 ? 'Continue' : 'See my targets'}
        </PrimaryButton>
      </View>
    </View>
  );
}

export function TargetRevealScreen({ route, navigation }: NativeStackScreenProps<OnboardingStackParams, 'TargetReveal'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const show = useToasts((s) => s.show);
  const setOnboarded = useSession((s) => s.setOnboarded);
  const setTargets = useSetTargets();
  const { targets: preview, profile } = route.params;
  const [confirmed, setConfirmed] = React.useState<UserTargets | null>(null);

  // Gentle entrance for the reveal.
  const fade = React.useRef(new Animated.Value(0)).current;
  const rise = React.useRef(new Animated.Value(12)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { targets } = await api.submitOnboarding(profile);
        if (!alive) return;
        setConfirmed(targets);
        setTargets.mutate(targets);
      } catch {
        if (alive) show('Showing an offline estimate for now');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = confirmed ?? preview;

  return (
    <Animated.View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top, opacity: fade, transform: [{ translateY: rise }] }]}>
      <Text style={[styles.revealTitle, { color: theme.colors.onBackground }]}>Your daily picture</Text>
      <Text style={[styles.revealSub, { color: theme.colors.onSurfaceVariant }]}>
        A starting point you can adjust any time — it guides, it doesn't restrict.
      </Text>
      <View style={styles.ringWrap}>
        <CalorieRing consumed={0} target={shown.dailyCalories} size={200} />
      </View>
      <MacroBars
        carbs={0}
        protein={0}
        fat={0}
        targets={{ carbsGrams: shown.carbsGrams, proteinGrams: shown.proteinGrams, fatGrams: shown.fatGrams }}
      />
      {confirmed ? (
        <Text style={[styles.syncNote, { color: theme.colors.onSurfaceVariant }]}>Synced with your profile</Text>
      ) : (
        <Text style={[styles.syncNote, { color: theme.colors.onSurfaceVariant }]}>Estimated from your answers…</Text>
      )}
      <PrimaryButton onPress={() => setOnboarded(true)} style={{ marginTop: 8 }}>
        Start logging
      </PrimaryButton>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingTop: 4 },
  progressTrack: { marginTop: 2 },
  progressRail: { height: 5, borderRadius: 3, width: '100%' },
  progressFill: { height: 5, borderRadius: 3, position: 'absolute', left: 0, top: 0 },
  stepCount: { fontSize: 11.5, paddingHorizontal: 12, marginTop: 6, fontFamily: fontFamilies.medium },
  stepHeading: { paddingHorizontal: 24, paddingTop: 16, gap: 6 },
  stepIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 24, fontFamily: fontFamilies.semibold },
  stepSub: { fontSize: 14, lineHeight: 20, fontFamily: fontFamilies.regular },
  stepBody: { flex: 1, padding: 24, gap: 14 },
  recap: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2 },
  recapText: { fontSize: 12.5, fontFamily: fontFamilies.medium },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 24 },
  revealTitle: { fontSize: 26, paddingHorizontal: 24, paddingTop: 32, fontFamily: fontFamilies.semibold },
  revealSub: { fontSize: 14, paddingHorizontal: 24, marginTop: 6, lineHeight: 20, fontFamily: fontFamilies.regular },
  ringWrap: { alignItems: 'center', paddingVertical: 16 },
  syncNote: { fontSize: 12, textAlign: 'center', marginTop: 4, fontFamily: fontFamilies.regular },
});
