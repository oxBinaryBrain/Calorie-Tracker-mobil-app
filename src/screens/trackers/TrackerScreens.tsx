import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, SegmentedButtons, TextInput, useTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrackersTabParams } from '../../navigation/types';
import type { SleepQuality } from '../../types';
import { useDayTracker, useTrackerRange, useUpsertTracker, useProfile } from '../../hooks/queries';
import { addDays, dateKey, formatMl } from '../../utils';
import { waterGoalMl } from '../../services/targets';
import { tickLight } from '../../services/haptics';
import { QuickChip, Screen, SectionTitle, EmptyState } from '../../components/ui';

type WaterProps = NativeStackScreenProps<TrackersTabParams, 'Water'>;
type WeightProps = NativeStackScreenProps<TrackersTabParams, 'Weight'>;
type SleepProps = NativeStackScreenProps<TrackersTabParams, 'Sleep'>;

const WATER_CHIPS = [100, 250, 330, 500, 750];

export function WaterScreen({ route }: WaterProps) {
  const theme = useTheme();
  const date = route.params?.date ?? dateKey();
  const tracker = useDayTracker(date);
  const upsert = useUpsertTracker();
  const profile = useProfile();
  const current = tracker.data;
  const goalMl = waterGoalMl(profile.data?.weightKg, profile.data?.activityLevel);
  const history = useTrackerRange(addDays(date, -6), date);
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
    <Screen scroll title="Water today">
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
        {formatMl(current?.waterMl ?? 0)} · about {pct}% of your {formatMl(goalMl)} day
      </Text>
      <Text style={[styles.goalNote, { color: theme.colors.onSurfaceVariant }]}>
        Your goal follows your weight and typical activity. A guide, not a rule.
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
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
        <Text style={[styles.histNote, { color: theme.colors.onSurfaceVariant }]}>
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
    <View style={styles.histStrip}>
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
  const history = useTrackerRange(addDays(date, -90), date);
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    setText(tracker.data?.weightKg != null ? String(tracker.data.weightKg) : '');
  }, [tracker.data?.weightKg]);

  const points = (history.data ?? [])
    .filter((t) => t.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => ({ value: t.weightKg as number, label: t.date.slice(5) }));

  const save = (raw: string) => {
    setText(raw);
    const n = Number(raw.replace(',', '.'));
    if (raw === '') return;
    if (Number.isFinite(n)) {
      upsert.mutate({
        date,
        waterMl: tracker.data?.waterMl ?? 0,
        weightKg: n,
        sleepHours: tracker.data?.sleepHours,
        sleepQuality: tracker.data?.sleepQuality,
      });
    }
  };

  return (
    <Screen scroll title="Weight">
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>A quiet trend, no judgments.</Text>

      <TextInput
        label="Weight today (kg)"
        mode="outlined"
        keyboardType="decimal-pad"
        value={text}
        onChangeText={save}
        style={styles.field}
      />

      <SectionTitle text="Last 90 days" />
      {points.length >= 2 ? (
        <Card mode="contained" style={styles.chartCard}>
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
  const [text, setText] = React.useState('');

  React.useEffect(() => {
    setText(current?.sleepHours != null ? String(current.sleepHours) : '');
  }, [current?.sleepHours]);

  const setHours = (raw: string) => {
    setText(raw);
    const n = Number(raw.replace(',', '.'));
    upsert.mutate({
      date,
      waterMl: current?.waterMl ?? 0,
      weightKg: current?.weightKg,
      sleepHours: raw === '' ? undefined : Number.isFinite(n) ? n : undefined,
      sleepQuality: current?.sleepQuality,
    });
  };

  const setQuality = (q: SleepQuality) => {
    upsert.mutate({
      date,
      waterMl: current?.waterMl ?? 0,
      weightKg: current?.weightKg,
      sleepHours: current?.sleepHours,
      sleepQuality: q,
    });
  };

  return (
    <Screen scroll title="Sleep">
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>Hours last night, and how it felt.</Text>

      <TextInput
        label="Hours of sleep"
        mode="outlined"
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setHours}
        style={styles.field}
      />

      <SectionTitle text="How did it feel?" />
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
  field: { marginTop: 6, marginBottom: 14 },
  chartCard: { borderRadius: 16 },
});
