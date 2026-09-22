import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart } from 'react-native-gifted-charts';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEntriesRange, useTargets, useTrackerRange, useProfile, weekRange } from '../../hooks/queries';
import { formatKcal, formatMl } from '../../utils';
import { LargeTitleScreen, StatTile, SectionTitle, EmptyState } from '../../components/ui';
import { semantic, fontFamilies } from '../../theme';
import type { RootTabParams } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/** Previous calendar week (Mon–Sun), computed the same way as weekRange. */
function prevWeekRange() {
  return weekRange(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
}

const MIN_LOGGED_DAYS = 4;
/** Suggested target = TDEE estimate ± goal-rate delta. Conservative band. */
const ADJUST_STEP = 50;
const MAX_SHIFT_PCT = 0.1;

export default function WeeklySummaryScreen({ navigation }: { navigation?: NativeStackNavigationProp<RootTabParams> }) {
  const theme = useTheme();
  const s = semantic(theme);
  const qc = useQueryClient();
  const { from, to, days } = weekRange();
  const prev = prevWeekRange();

  const entries = useEntriesRange(from, to);
  const trackers = useTrackerRange(from, to);
  const prevEntries = useEntriesRange(prev.from, prev.to);
  const prevTrackers = useTrackerRange(prev.from, prev.to);
  const targets = useTargets();
  const profile = useProfile();

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['entries'] });
    await qc.invalidateQueries({ queryKey: ['trackers'] });
    await qc.invalidateQueries({ queryKey: ['targets'] });
    setRefreshing(false);
  }, [qc]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const day of days) map.set(day, 0);
    for (const e of entries.data ?? []) {
      const k = e.loggedAt.slice(0, 10);
      if (e.type === 'food') map.set(k, (map.get(k) ?? 0) + e.calories);
    }
    return map;
  }, [entries.data, days]);

  const dayTotals = days.map((d) => ({ date: d, calories: byDay.get(d) ?? 0 }));

  const loggedDays = dayTotals.filter((d) => d.calories > 0);
  const avgCalories = loggedDays.length > 0 ? loggedDays.reduce((sum, d) => sum + d.calories, 0) / loggedDays.length : 0;
  const targetKcal = targets.data?.dailyCalories ?? 0;
  const daysOnTarget = targetKcal > 0 ? loggedDays.filter((d) => Math.abs(d.calories - targetKcal) <= targetKcal * 0.1).length : 0;

  // ---- Last week, for the trend + adaptive suggestion ------------------------
  const prevByDay = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const e of prevEntries.data ?? []) {
      const k = e.loggedAt.slice(0, 10);
      if (e.type === 'food') map.set(k, (map.get(k) ?? 0) + e.calories);
    }
    return map;
  }, [prevEntries.data]);

  const prevDayTotals = prev.days.map((d) => ({ date: d, calories: prevByDay.get(d) ?? 0 }));
  const prevLoggedDays = prevDayTotals.filter((d) => d.calories > 0);
  const prevAvgCalories = prevLoggedDays.length > 0 ? prevLoggedDays.reduce((sum, d) => sum + d.calories, 0) / prevLoggedDays.length : 0;

  const prevWeights = (prevTrackers.data ?? []).filter((t) => t.weightKg != null).sort((a, b) => a.date.localeCompare(b.date));
  const thisWeights = (trackers.data ?? []).filter((t) => t.weightKg != null).sort((a, b) => a.date.localeCompare(b.date));
  const firstWeight = thisWeights[0]?.weightKg ?? prevWeights[prevWeights.length - 1]?.weightKg ?? null;
  const lastWeight = thisWeights[thisWeights.length - 1]?.weightKg ?? null;
  const weekWeightDelta = firstWeight != null && lastWeight != null ? lastWeight - firstWeight : null;

  // ---- Trend chart: 14 bars, this week after last week ----------------------
  const trendData = React.useMemo(() => {
    const bar = (d: { date: string; calories: number }, isPrev: boolean) => ({
      value: Math.round(d.calories),
      label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }),
      frontColor: isPrev ? s.chartGrid : s.ringProgress,
      spacing: isPrev && d.date === prev.to ? 22 : undefined,
    });
    return [...prevDayTotals.map((d) => bar(d, true)), ...dayTotals.map((d) => bar(d, false))];
  }, [prevDayTotals, dayTotals, s.chartGrid, s.ringProgress, prev.to]);
  const hasAnyTrendData = loggedDays.length > 0 || prevLoggedDays.length > 0;

  // ---- Adaptive target suggestion -------------------------------------------
  // Conservative rules: enough data, a real weight signal, and the current
  // target is never silently changed — the suggestion is only offered here.
  const suggestion = React.useMemo(() => {
    if (!targetKcal) return null;
    if (loggedDays.length < MIN_LOGGED_DAYS || prevLoggedDays.length < MIN_LOGGED_DAYS) return null;
    if (weekWeightDelta == null || Math.abs(weekWeightDelta) < 0.2) return null;

    const goal = profile.data?.goal;
    const wantsLower = goal === 'lose';
    const wantsHigher = goal === 'gain';
    const avgDelta = avgCalories - prevAvgCalories; // positive = eating more than last week
    const weightRate = weekWeightDelta; // kg this week

    // Expected weekly change at the current target, roughly (7700 kcal ≈ 1 kg).
    const expectedWeeklyKg = wantsLower ? -0.5 : wantsHigher ? 0.5 : 0;
    const offRate = weightRate - expectedWeeklyKg; // positive = moving slower than planned

    let adjusted = targetKcal;
    // Losing/gaining slower than planned (or gaining while losing): nudge down a bit.
    if (wantsLower && offRate > 0.15) adjusted = targetKcal - ADJUST_STEP;
    // Moving faster than planned (or too fast): ease off for sustainability.
    else if (wantsLower && offRate < -0.3) adjusted = targetKcal + ADJUST_STEP;
    else if (wantsHigher && offRate < -0.15) adjusted = targetKcal + ADJUST_STEP;
    else if (wantsHigher && offRate > 0.3) adjusted = targetKcal - ADJUST_STEP;
    // Maintain: keep intake near the 4-week average instead of the target.
    else if (goal === 'maintain' && Math.abs(avgDelta) >= 150) adjusted = Math.round((avgCalories + prevAvgCalories) / 2 / ADJUST_STEP) * ADJUST_STEP;

    const shift = adjusted - targetKcal;
    if (shift === 0) return null;
    const capped = Math.max(-Math.round(targetKcal * MAX_SHIFT_PCT / ADJUST_STEP) * ADJUST_STEP, Math.min(Math.round(targetKcal * MAX_SHIFT_PCT / ADJUST_STEP) * ADJUST_STEP, shift));
    if (capped === 0) return null;
    return {
      direction: capped < 0 ? ('down' as const) : ('up' as const),
      suggestedTarget: targetKcal + capped,
      reason:
        wantsLower && capped < 0
          ? 'Weight is moving slower than your plan.'
          : wantsLower && capped > 0
            ? 'Loss was fast this week — easing off keeps it sustainable.'
            : wantsHigher && capped > 0
              ? 'Weight is moving slower than your plan.'
              : wantsHigher && capped < 0
                ? 'Gain was fast this week — easing off keeps it sustainable.'
                : 'Intake has drifted from your target; recent average is a steadier anchor.',
      evidence: `${loggedDays.length + prevLoggedDays.length} logged days · ${weekWeightDelta > 0 ? '+' : ''}${weekWeightDelta.toFixed(1)} kg over two weeks`,
    };
  }, [targetKcal, profile.data?.goal, loggedDays.length, prevLoggedDays.length, avgCalories, prevAvgCalories, weekWeightDelta]);

  const burned = (entries.data ?? []).reduce((sum, e) => sum + (e.type === 'exercise' ? e.caloriesBurned ?? 0 : 0), 0);

  const weights = (trackers.data ?? []).filter((t) => t.weightKg != null).sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = weights.length >= 2 ? (weights[weights.length - 1].weightKg as number) - (weights[0].weightKg as number) : undefined;

  const sleeps = (trackers.data ?? []).filter((t) => t.sleepHours != null);
  const avgSleep = sleeps.length > 0 ? sleeps.reduce((sum, t) => sum + (t.sleepHours as number), 0) / sleeps.length : undefined;

  const chartData = dayTotals.map((d) => ({
    value: Math.round(d.calories),
    label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }),
    frontColor: s.ringProgress,
  }));
  const hasData = loggedDays.length > 0;

  return (
    <LargeTitleScreen
      title="This week"
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      contentContainerStyle={{ paddingHorizontal: 16 }}
    >
      <Text style={[styles.sub, { color: theme.colors.onSurfaceVariant }]}>
        {from.slice(5)} to {to.slice(5)} · a look back, not a report card
      </Text>

      {/* Adaptive target suggestion — offered, never applied silently. */}
      {suggestion ? (
        <Pressable
          // Cross-tab navigation: nested tab param lists are intentionally loose here.
          onPress={() => (navigation as { navigate: (dest: string, params?: object) => void } | null)?.navigate('AccountTab', { screen: 'Goals' })}
          style={({ pressed }) => [
            styles.suggestCard,
            { backgroundColor: theme.colors.primaryContainer, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Suggested target ${formatKcal(suggestion.suggestedTarget)} kcal. Opens Goals to apply.`}
        >
          <MaterialCommunityIcons
            name={suggestion.direction === 'down' ? 'tune-vertical' : 'tune-vertical-variant'}
            size={20}
            color={theme.colors.onPrimaryContainer}
          />
          <View style={styles.suggestBody}>
            <Text style={[styles.suggestTitle, { color: theme.colors.onPrimaryContainer }]}>
              Suggested target: {formatKcal(suggestion.suggestedTarget)} kcal/day
            </Text>
            <Text style={[styles.suggestReason, { color: theme.colors.onPrimaryContainer }]}>
              {suggestion.reason} Based on {suggestion.evidence}.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.onPrimaryContainer} />
        </Pressable>
      ) : null}

      <View style={styles.tiles}>
        <StatTile label="Avg calories" value={loggedDays.length ? `${formatKcal(avgCalories)} kcal` : '—'} hint={loggedDays.length ? `across ${loggedDays.length} logged ${loggedDays.length === 1 ? 'day' : 'days'}` : undefined} />
        <StatTile label="Days near target" value={targetKcal ? String(daysOnTarget) : '—'} hint={targetKcal ? `within 10% of ${formatKcal(targetKcal)}` : undefined} />
      </View>
      <View style={styles.tiles}>
        <StatTile label="Calories burned" value={burned > 0 ? `${formatKcal(burned)} kcal` : '—'} hint="from logged movement" />
        <StatTile
          label="Weight change"
          value={weightChange != null ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : '—'}
          hint={weights.length >= 2 ? `${weights[0].date.slice(5)} → ${weights[weights.length - 1].date.slice(5)}` : undefined}
        />
      </View>
      <View style={[styles.tiles, { marginBottom: 4 }]}>
        <StatTile label="Avg sleep" value={avgSleep != null ? `${avgSleep.toFixed(1)} h` : '—'} hint={sleeps.length ? `across ${sleeps.length} ${sleeps.length === 1 ? 'night' : 'nights'}` : undefined} />
        <StatTile label="Water logged" value={`${formatMl(trackers.data?.reduce((sum, t) => sum + t.waterMl, 0) ?? 0)}`} hint="across the week" />
      </View>

      <SectionTitle text="Calories by day" />
      {hasData ? (
        <>
        <View style={styles.chartWrap}>
          <BarChart
            data={chartData}
            width={330}
            height={180}
            barWidth={26}
            spacing={16}
            roundedTop
            roundedBottom
            noOfSections={4}
            maxValue={Math.max(targetKcal * 1.2, ...chartData.map((d) => d.value), 500)}
            rulesColor={s.chartGrid}
            yAxisTextStyle={{ color: s.mutedText, fontSize: 10 }}
            hideRules
            showLine
            lineConfig={{
              color: s.mutedText,
              thickness: 1,
              curved: false,
              dataPointsColor: s.mutedText,
            }}
            lineData={days.map((d) => ({ value: targetKcal, label: '' , hideDataPoint: true }))}
          />
        </View>
        <Text style={[styles.chartNote, { color: s.mutedText }]}>
          The faint line marks {formatKcal(targetKcal)} kcal — a reference, not a ceiling.
        </Text>
        </>
      ) : (
        <EmptyState icon="chart-bar" title="Nothing logged this week" message="Your week will fill in here as you log." />
      )}

      {hasAnyTrendData ? (
        <>
          <SectionTitle text="This week vs last week" />
          <View style={styles.chartWrap}>
            <BarChart
              data={trendData}
              width={330}
              height={170}
              barWidth={14}
              spacing={10}
              roundedTop
              noOfSections={4}
              maxValue={Math.max(targetKcal * 1.2, ...trendData.map((d) => d.value), 500)}
              rulesColor={s.chartGrid}
              yAxisTextStyle={{ color: s.mutedText, fontSize: 10 }}
              hideRules
            />
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: s.chartGrid }]} />
              <Text style={[styles.legendText, { color: s.mutedText }]}>Last week · avg {prevLoggedDays.length ? formatKcal(prevAvgCalories) : '—'}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: s.ringProgress }]} />
              <Text style={[styles.legendText, { color: s.mutedText }]}>This week · avg {loggedDays.length ? formatKcal(avgCalories) : '—'}</Text>
            </View>
          </View>
        </>
      ) : null}
    </LargeTitleScreen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13.5, marginBottom: 10 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chartWrap: { alignItems: 'center', marginTop: 6 },
  chartNote: { fontSize: 12, textAlign: 'center', marginTop: 6 },
  suggestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  suggestBody: { flex: 1, gap: 2 },
  suggestTitle: { fontSize: 14, fontFamily: fontFamilies.semibold },
  suggestReason: { fontSize: 11.5, lineHeight: 16, fontFamily: fontFamilies.regular },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11.5, fontFamily: fontFamilies.medium },
});
