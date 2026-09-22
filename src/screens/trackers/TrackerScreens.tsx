import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, HelperText, SegmentedButtons, TextInput, useTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrackersTabParams } from '../../navigation/types';
import type { SleepQuality } from '../../types';
import { useDayTracker, useTrackerRange, useUpsertTracker, useProfile } from '../../hooks/queries';
import { addDays, dateKey, formatDateLong, formatMl } from '../../utils';
import { effectiveWaterGoalMl } from '../../services/targets';
import { planWeightGoal, type WeightPoint } from '../../services/weight';
import { tickLight } from '../../services/haptics';
import { usePrefs } from '../../stores';
import { QuickChip, Screen, SectionTitle, EmptyState } from '../../components/ui';

type WaterProps = NativeStackScreenProps<TrackersTabParams, 'Water'>;
type WeightProps = NativeStackScreenProps<TrackersTabParams, 'Weight'>;
type SleepProps = NativeStackScreenProps<TrackersTabParams, 'Sleep'>;

const WATER_CHIPS = [100, 250, 330, 500, 750];

function useRefresh() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['tracker'] }),
      qc.invalidateQueries({ queryKey: ['trackers'] }),
      qc.invalidateQueries({ queryKey: ['entries'] }),
      qc.invalidateQueries({ queryKey: ['profile'] }),
      qc.invalidateQueries({ queryKey: ['targets'] }),
    ]);
    setRefreshing(false);
  }, [qc]);
  return { refreshing, onRefresh: () => void onRefresh() };
}

export function WaterScreen({ route }: WaterProps) {
  const theme = useTheme();
  const date = route.params?.date ?? dateKey();
  const tracker = useDayTracker(date);
  const upsert = useUpsertTracker();
  const profile = useProfile();
  const waterGoalPref = usePrefs((s) => s.waterGoalMl);
  const current = tracker.data;
  const goalMl = effectiveWaterGoalMl(waterGoalPref, profile.data?.weightKg, profile.data?.activityLevel);
  const isCustomGoal = waterGoalPref != null;
  const history = useTrackerRange(addDays(date, -6), date);
  const { refreshing, onRefresh } = useRefresh();
  const historyDays = Array.from({ length: 7 }, (_, i) => addDays(date, -6 + i)).map((d) => ({
    date: d,
    ml: (history.data ?? []).find((t) => t.date === d)?.waterMl ?? 0,
  }));
  const metCount = historyDays.filter((d) => d.ml >= goalMl).length;

  const add = (ml: number) => {
    tickLight();
    upsert.mutate({ date, waterMl: (current?.waterMl ?? 0) + ml });
  };

  const pct = Math.min(100, Math.round(((current?.waterMl ?? 0) / goalMl) * 100));

  return (
    <Screen scroll title="Water today" refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
        {formatMl(current?.waterMl ?? 0)} · about {pct}% of your {formatMl(goalMl)} day
      </Text>
      <Text style={[styles.goalNote, { color: theme.colors.onSurfaceVariant }]}>
        {isCustomGoal
          ? 'Your goal, set in Goals & targets. A guide, not a rule.'
          : 'Your goal follows your weight and typical activity. A guide, not a rule.'}
      </Text>

      <View
        style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct, text: `${pct} percent of daily water goal` }}
      >
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: theme.colors.primary }]} />
      </View>

      <SectionTitle text="Quick add" />
      <View style={styles.chips}>
        {WATER_CHIPS.map((ml) => (
          <QuickChip key={ml} label={`+${ml} ml`} onPress={() => add(ml)} />
        ))}
      </View>

      <View style={styles.chips}>
        <QuickChip label="− 100 ml" onPress={() => { tickLight(); upsert.mutate({ date, waterMl: Math.max(0, (current?.waterMl ?? 0) - 100) }); }} />
        <QuickChip label="Set to 0" onPress={() => upsert.mutate({ date, waterMl: 0 })} />
      </View>

      <SectionTitle text="Last 7 days" />
      <View style={styles.histCard}>
        <WaterHistoryStrip days={historyDays} goalMl={goalMl} theme={theme} />
        <Text style={[styles.histNote, { color: theme.colors.onSurfaceVariant }]} accessibilityRole="text">
          {metCount === 0
            ? 'Full-color bars mark days the goal was met.'
            : `Goal met on ${metCount} of the last 7 days.`}
        </Text>
      </View>
    </Screen>
  );
}

/** Seven slim water bars, mirroring the week overview on Home. */
function WaterHistoryStrip({ days, goalMl, theme }: {
  days: Array<{ date: string; ml: number }>;
  goalMl: number;
  theme: MD3Theme;
}) {
  const todayKey = dateKey();
  const max = Math.max(goalMl, ...days.map((d) => d.ml), 1);
  return (
    <View
      style={styles.histStrip}
      accessibilityRole="image"
      accessibilityLabel={days
        .map((d) => `${new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}: ${formatMl(d.ml)}`)
        .join(', ')}
    >
      {days.map((d) => {
        const isToday = d.date === todayKey;
        const met = d.ml > 0 && d.ml >= goalMl;
        const barH = Math.max(4, Math.round((d.ml / max) * 40));
        return (
          <View key={d.date} style={styles.histCol}>
            <View style={styles.histSlot}>
              <View
                style={{
                  width: '64%',
                  height: barH,
                  borderRadius: 4,
                  backgroundColor:
                    d.ml === 0 ? theme.colors.surfaceVariant : met ? theme.colors.primary : theme.colors.primaryContainer,
                }}
              />
            </View>
            <Text
              style={[
                styles.histLabel,
                { color: isToday ? theme.colors.primary : theme.colors.onSurfaceVariant },
              ]}
            >
              {new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function WeightScreen({ route }: WeightProps) {
  const theme = useTheme();
  const date = route.params?.date ?? dateKey();
  const tracker = useDayTracker(date);
  const upsert = useUpsertTracker();
  const profile = useProfile();
  const history = useTrackerRange(addDays(date, -90), date);
  const { refreshing, onRefresh } = useRefresh();
  const [text, setText] = React.useState('');
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setText(tracker.data?.weightKg != null ? String(tracker.data.weightKg) : '');
    }
  }, [tracker.data?.weightKg]);

  const weighIns = (history.data ?? [])
    .filter((t) => t.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const points = weighIns.map((t) => ({ value: t.weightKg as number, label: t.date.slice(5) }));
  const weightPoints: WeightPoint[] = weighIns.map((t) => ({ date: t.date, weightKg: t.weightKg as number }));

  const targetKg = profile.data?.targetWeightKg;
  const latestKg = tracker.data?.weightKg ?? weightPoints[weightPoints.length - 1]?.weightKg;
  const plan =
    targetKg != null && latestKg != null ? planWeightGoal(latestKg, targetKg, weightPoints) : null;

  const parsed = Number(text.trim().replace(',', '.'));
  const storedText = tracker.data?.weightKg != null ? String(tracker.data.weightKg) : '';
  const dirty = text.trim() !== storedText;
  const raw = text.trim();
  const weightInvalid = raw !== '' && (!Number.isFinite(parsed) || parsed < 20 || parsed > 400);

  const commit = () => {
    if (raw === storedText) {
      focusedRef.current = false;
      return;
    }
    if (weightInvalid) return;
    focusedRef.current = false;
    if (raw === '') {
      setText(storedText);
      return;
    }
    const next = raw.replace(',', '.');
    setText(next);
    upsert.mutate({
      date,
      waterMl: tracker.data?.waterMl ?? 0,
      weightKg: Number(next),
      sleepHours: tracker.data?.sleepHours,
      sleepQuality: tracker.data?.sleepQuality,
    });
  };

  return (
    <Screen scroll title="Weight" refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>A quiet trend, no judgments.</Text>

      <TextInput
        label="Weight today (kg)"
        mode="outlined"
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setText}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
        style={styles.field}
        accessibilityLabel="Weight today in kilograms"
      />
      {weightInvalid ? (
        <HelperText type="error" visible>
          Enter a weight between 20 and 400 kg
        </HelperText>
      ) : null}
      {dirty ? (
        <Button mode="contained" compact onPress={commit} disabled={weightInvalid} style={styles.saveBtn}>
          Save weight
        </Button>
      ) : null}

      {plan ? (
        <Card mode="contained" style={styles.chartCard}>
          <Card.Content>
            <Text style={[styles.planTitle, { color: theme.colors.onSurface }]}>
              {latestKg?.toFixed(1)} kg → {targetKg} kg target
            </Text>
            {plan.atGoal ? (
              <Text style={[styles.planLine, { color: theme.colors.onSurfaceVariant }]}>
                You are at your target weight.
              </Text>
            ) : (
              <>
                <Text style={[styles.planLine, { color: theme.colors.onSurfaceVariant }]}>
                  {Math.abs(plan.remainingKg).toFixed(1)} kg {plan.remainingKg < 0 ? 'to lose' : 'to gain'} remaining
                </Text>
                {plan.paceKgPerWeek != null ? (
                  <Text style={[styles.planLine, { color: theme.colors.onSurfaceVariant }]}>
                    Recent pace: {plan.paceKgPerWeek > 0 ? '+' : ''}
                    {plan.paceKgPerWeek.toFixed(2)} kg/week
                  </Text>
                ) : null}
                {plan.weeksLeft != null && plan.etaDate ? (
                  <Text style={[styles.planLine, { color: theme.colors.onSurfaceVariant }]}>
                    At this pace: {formatDateLong(plan.etaDate)} (about {Math.max(1, Math.round(plan.weeksLeft))}{' '}
                    {Math.round(plan.weeksLeft) === 1 ? 'week' : 'weeks'})
                  </Text>
                ) : (
                  <Text style={[styles.planLine, { color: theme.colors.onSurfaceVariant }]}>
                    Not enough steady movement yet to estimate a date.
                  </Text>
                )}
              </>
            )}
          </Card.Content>
        </Card>
      ) : targetKg == null ? (
        <EmptyState
          icon="target"
          title="No target weight set"
          message="Set a target kg in your Profile to see a timeline from here."
        />
      ) : null}

      <SectionTitle text="Last 90 days" />
      {points.length >= 2 ? (
        <Card
          mode="contained"
          style={styles.chartCard}
          accessibilityRole="image"
          accessibilityLabel={`Weight trend from ${points[0].label} to ${points[points.length - 1].label}`}
        >
          <Card.Content>
            <LineChart
              data={points}
              width={340}
              height={180}
              curved
              color={theme.colors.primary}
              thickness={2.5}
              hideDataPoints
              areaChart
              startFillColor={`${theme.colors.primary}22`}
              endOpacity={0}
              rulesColor={theme.colors.outlineVariant}
              yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
              yAxisOffset={Math.floor(Math.min(...points.map((p) => p.value)) - 5)}
              disableScroll
            />
          </Card.Content>
        </Card>
      ) : (
        <EmptyState icon="chart-line" title="Not enough points yet" message="Log a few days to see the trend take shape." />
      )}
    </Screen>
  );
}

export function SleepScreen({ route }: SleepProps) {
  const theme = useTheme();
  const date = route.params?.date ?? dateKey();
  const tracker = useDayTracker(date);
  const upsert = useUpsertTracker();
  const current = tracker.data;
  const { refreshing, onRefresh } = useRefresh();
  const [text, setText] = React.useState('');
  const focusedRef = React.useRef(false);

  React.useEffect(() => {
    if (!focusedRef.current) {
      setText(current?.sleepHours != null ? String(current.sleepHours) : '');
    }
  }, [current?.sleepHours]);

  const storedText = current?.sleepHours != null ? String(current.sleepHours) : '';
  const dirty = text.trim() !== storedText;
  const raw = text.trim();
  const parsed = Number(raw.replace(',', '.'));
  const hoursInvalid = raw !== '' && (!Number.isFinite(parsed) || parsed < 0 || parsed > 24);

  const commit = () => {
    if (hoursInvalid) return;
    focusedRef.current = false;
    if (raw === storedText) return;
    if (raw !== '') setText(raw.replace(',', '.'));
    upsert.mutate({
      date,
      waterMl: current?.waterMl ?? 0,
      weightKg: current?.weightKg,
      sleepHours: raw === '' ? undefined : parsed,
      sleepQuality: current?.sleepQuality,
    });
  };

  const setQuality = (q: SleepQuality) => {
    const sleepHours = hoursInvalid ? current?.sleepHours : raw === '' ? undefined : parsed;
    if (!hoursInvalid) {
      focusedRef.current = false;
      if (raw !== '' && raw !== storedText) setText(raw.replace(',', '.'));
    }
    upsert.mutate({
      date,
      waterMl: current?.waterMl ?? 0,
      weightKg: current?.weightKg,
      sleepHours,
      sleepQuality: q,
    });
  };

  return (
    <Screen scroll title="Sleep" refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>Hours last night, and how it felt.</Text>

      <TextInput
        label="Hours of sleep"
        mode="outlined"
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setText}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
        style={styles.field}
        accessibilityLabel="Hours of sleep"
      />
      {hoursInvalid ? (
        <HelperText type="error" visible>
          Enter hours between 0 and 24
        </HelperText>
      ) : null}
      {dirty ? (
        <Button mode="contained" compact onPress={commit} disabled={hoursInvalid} style={styles.saveBtn}>
          Save sleep
        </Button>
      ) : null}

      <SectionTitle text="How did it feel?" />
      <View accessibilityRole="radiogroup" accessibilityLabel="Sleep quality">
        <SegmentedButtons
          value={current?.sleepQuality ?? ''}
          onValueChange={(v) => setQuality(v as SleepQuality)}
          buttons={[
            { value: 'poor', label: 'Rough' },
            { value: 'fair', label: 'Fair' },
            { value: 'good', label: 'Good' },
          ]}
          density="small"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13.5, marginTop: 2, marginBottom: 4 },
  goalNote: { fontSize: 12, marginBottom: 8 },
  progressTrack: { height: 10, borderRadius: 5, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  histCard: { marginTop: 6 },
  histStrip: { flexDirection: 'row', alignItems: 'flex-end' },
  histCol: { flex: 1, alignItems: 'center', gap: 4 },
  histSlot: { height: 44, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  histLabel: { fontSize: 10.5 },
  histNote: { fontSize: 12, marginTop: 8 },
  field: { marginTop: 6, marginBottom: 4 },
  saveBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  chartCard: { borderRadius: 16 },
  planTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  planLine: { fontSize: 13, lineHeight: 20 },
});
