import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart } from 'react-native-gifted-charts';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEntriesRange, useTargets, useTrackerRange, useProfile, weekRange } from '../../hooks/queries';
import { addDays, formatKcal, formatMl } from '../../utils';
import { LargeTitleScreen, StatTile, SectionTitle, EmptyState } from '../../components/ui';
import { semantic, fontFamilies } from '../../theme';
import type { RootTabParams } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const MIN_LOGGED_DAYS = 4;
/** Suggested target = TDEE estimate ± goal-rate delta. Conservative band. */
const ADJUST_STEP = 50;
const MAX_SHIFT_PCT = 0.1;
/** How far back the multi-week trend chart looks (8 full weeks + this one). */
const TREND_WEEKS = 8;

function prevWeekRange() {
  return weekRange(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
}

function weekStartKey(anchor: Date): string {
  const d = new Date(anchor);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Round an axis ceiling up to a clean 500-step so labels read 500/1000/1500… */
function niceAxis(maxValue: number): { maxValue: number; noOfSections: number } {
  const max = Math.max(1000, Math.ceil(maxValue / 500) * 500);
  return { maxValue: max, noOfSections: max / 500 };
}

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

  // Multi-week window for "Trends beyond the week": TREND_WEEKS full weeks
  // before this one, plus the current week (fetched separately above).
  const trendFrom = weekStartKey(new Date(Date.now() - TREND_WEEKS * 7 * 24 * 60 * 60 * 1000));
  const longEntries = useEntriesRange(trendFrom, to);
  const longTrackers = useTrackerRange(trendFrom, to);

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

  // ---- Day chart: 14 bars, this week after last week, target line on top ----
  const trendData = React.useMemo(() => {
    const bar = (d: { date: string; calories: number }, isPrev: boolean) => ({
      value: Math.round(d.calories),
      label: new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' }),
      frontColor: isPrev ? s.chartGrid : s.ringProgress,
      spacing: isPrev && d.date === prev.to ? 16 : undefined,
    });
    return [...prevDayTotals.map((d) => bar(d, true)), ...dayTotals.map((d) => bar(d, false))];
  }, [prevDayTotals, dayTotals, s.chartGrid, s.ringProgress, prev.to]);
  const hasWeekData = loggedDays.length > 0 || prevLoggedDays.length > 0;

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

  const waterLoggedDays = (trackers.data ?? []).filter((t) => t.waterMl > 0).length;
  const waterTotalMl = (trackers.data ?? []).reduce((sum, t) => sum + t.waterMl, 0);

  // ---- Nutrition averages (this week, logged food days only) ----------------
  const macroAvgs = React.useMemo(() => {
    const foodDays = new Map<string, { carbs: number; protein: number; fat: number }>();
    for (const e of entries.data ?? []) {
      if (e.type !== 'food') continue;
      const k = e.loggedAt.slice(0, 10);
      const cur = foodDays.get(k) ?? { carbs: 0, protein: 0, fat: 0 };
      cur.carbs += e.carbs ?? 0;
      cur.protein += e.protein ?? 0;
      cur.fat += e.fat ?? 0;
      foodDays.set(k, cur);
    }
    const foodDayList = [...foodDays.values()];
    if (foodDayList.length === 0) return null;
    const sum = foodDayList.reduce(
      (acc, d) => ({ carbs: acc.carbs + d.carbs, protein: acc.protein + d.protein, fat: acc.fat + d.fat }),
      { carbs: 0, protein: 0, fat: 0 },
    );
    return {
      days: foodDayList.length,
      carbs: Math.round(sum.carbs / foodDayList.length),
      protein: Math.round(sum.protein / foodDayList.length),
      fat: Math.round(sum.fat / foodDayList.length),
    };
  }, [entries.data]);

  // ---- Long-window trend: weekly average calories per logged day ------------
  const weeklyTrend = React.useMemo(() => {
    const kcalByDay = new Map<string, number>();
    for (const e of longEntries.data ?? []) {
      if (e.type !== 'food') continue;
      const k = e.loggedAt.slice(0, 10);
      kcalByDay.set(k, (kcalByDay.get(k) ?? 0) + e.calories);
    }
    // Bucket days into Monday-anchored weeks from trendFrom through today.
    const buckets = new Map<string, { sum: number; logged: number; label: string }>();
    let cursor = trendFrom;
    let weekNo = 0;
    while (cursor <= to) {
      const key = weekStartKey(new Date(cursor));
      if (!buckets.has(key)) {
        weekNo += 1;
        buckets.set(key, {
          sum: 0,
          logged: 0,
          label: weekNo === TREND_WEEKS + 1 ? 'This' : new Date(key).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        });
      }
      const bucket = buckets.get(key)!;
      const kcal = kcalByDay.get(cursor) ?? 0;
      if (kcal > 0) {
        bucket.sum += kcal;
        bucket.logged += 1;
      }
      cursor = addDays(cursor, 1);
    }
    return [...buckets.entries()].map(([key, b]) => ({
      key,
      label: b.label,
      avg: b.logged > 0 ? Math.round(b.sum / b.logged) : 0,
      logged: b.logged,
    }));
  }, [longEntries.data, trendFrom, to]);
  const trendWithData = weeklyTrend.filter((w) => w.logged > 0);

  // ---- Longer-window weight movement (for the insights section) -------------
  const longWeights = (longTrackers.data ?? [])
    .filter((t) => t.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const longWeightDelta =
    longWeights.length >= 2
      ? (longWeights[longWeights.length - 1].weightKg as number) - (longWeights[0].weightKg as number)
      : null;

  // ---- Solutions: calm, data-derived options (never prescriptive) ----------
  const solutions = React.useMemo(() => {
    const out: Array<{ title: string; detail: string }> = [];
    if (macroAvgs && targetKcal && loggedDays.length >= MIN_LOGGED_DAYS) {
      const proteinTarget = targets.data?.proteinGrams ?? 0;
      if (proteinTarget > 0 && macroAvgs.protein < proteinTarget * 0.75) {
        out.push({
          title: 'Add a protein source at one meal',
          detail: `Protein averaged ${macroAvgs.protein} g on logged days against a ${proteinTarget} g target.`,
        });
      }
    }
    if (loggedDays.length >= MIN_LOGGED_DAYS && daysOnTarget < Math.ceil(loggedDays.length / 2) && targetKcal) {
      out.push({
        title: 'Anchor one meal to your target',
        detail: `${daysOnTarget} of ${loggedDays.length} logged days landed within 10% of ${formatKcal(targetKcal)} kcal. Steadying one regular meal is often the easiest lever.`,
      });
    }
    if (waterLoggedDays > 0 && waterLoggedDays < loggedDays.length) {
      out.push({
        title: 'Note water on more days',
        detail: `Water was recorded on ${waterLoggedDays} of ${loggedDays.length} logged days this week.`,
      });
    }
    return out.slice(0, 3);
  }, [macroAvgs, targetKcal, loggedDays.length, daysOnTarget, waterLoggedDays, targets.data?.proteinGrams]);

  const dayAxis = niceAxis(Math.max(targetKcal, ...trendData.map((d) => d.value)));
  const trendAxis = niceAxis(Math.max(targetKcal, ...weeklyTrend.map((w) => w.avg)));
  const thisWeekKey = weekStartKey(new Date());

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

      {/* ---- Hero: week average against target, day chart inside ---- */}
      <View
        style={[styles.heroCard, { backgroundColor: s.calorieTint }]}
        accessibilityRole="text"
        accessibilityLabel={
          loggedDays.length
            ? `Weekly average ${formatKcal(avgCalories)} kcal across ${loggedDays.length} logged days`
            : 'No days logged this week yet'
        }
      >
        <Text style={[styles.heroEyebrow, { color: s.mutedText }]}>Weekly average</Text>
        <Text style={[styles.heroValue, { color: theme.colors.onBackground }]}>
          {loggedDays.length ? `${formatKcal(avgCalories)} kcal` : '—'}
        </Text>
        <Text style={[styles.heroMeta, { color: s.mutedText }]}>
          {[
            targetKcal > 0 ? `target ${formatKcal(targetKcal)}` : null,
            loggedDays.length > 0 ? `${loggedDays.length} of 7 days logged` : 'nothing logged yet',
            targetKcal > 0 && loggedDays.length > 0 ? `${daysOnTarget} near target` : null,
            burned > 0 ? `${formatKcal(burned)} burned` : null,
          ]
            .filter((b): b is string => b != null)
            .join(' · ')}
        </Text>
        {hasWeekData ? (
          <View
            accessibilityRole="image"
            accessibilityLabel={`Calories by day, last week and this week, against a ${targetKcal > 0 ? `${formatKcal(targetKcal)} kcal target` : 'your target'}`}
          >
            <BarChart
              data={trendData}
              width={300}
              height={150}
              barWidth={13}
              spacing={8}
              roundedTop
              noOfSections={dayAxis.noOfSections}
              maxValue={dayAxis.maxValue}
              rulesColor={s.chartGrid}
              yAxisLabelWidth={30}
              yAxisTextStyle={{ color: s.mutedText, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: s.mutedText, fontSize: 10 }}
              showLine={targetKcal > 0}
              lineData={targetKcal > 0 ? trendData.map(() => ({ value: targetKcal, label: '', hideDataPoint: true })) : []}
              lineConfig={{
                color: theme.colors.outline,
                thickness: 1,
                curved: false,
                hideDataPoints: true,
                strokeDashArray: [5, 5],
              }}
            />
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: s.chartGrid }]} />
                <Text style={[styles.legendText, { color: s.mutedText }]}>
                  Last · {prevLoggedDays.length ? formatKcal(prevAvgCalories) : '—'}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: s.ringProgress }]} />
                <Text style={[styles.legendText, { color: s.mutedText }]}>
                  This week · {loggedDays.length ? formatKcal(avgCalories) : '—'}
                </Text>
              </View>
              {targetKcal > 0 ? (
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, styles.legendDash, { borderColor: theme.colors.outline }]} />
                  <Text style={[styles.legendText, { color: s.mutedText }]}>Target</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : (
          <EmptyState icon="chart-bar" title="Nothing logged yet" message="Bars fill in for each day you log meals." />
        )}
      </View>

      {/* ---- Nutrition: macro averages per logged day ----------------------- */}
      <SectionTitle text="Nutrition" style={styles.sectionGap} />
      {macroAvgs ? (
        <View style={styles.tiles}>
          <StatTile
            icon="food-drumstick-outline"
            iconColor={s.macroProtein}
            style={{ backgroundColor: s.proteinTint }}
            label="Protein"
            value={`${macroAvgs.protein} g`}
            hint="avg / day"
          />
          <StatTile
            icon="barley"
            iconColor={s.macroCarbs}
            style={{ backgroundColor: s.carbsTint }}
            label="Carbs"
            value={`${macroAvgs.carbs} g`}
            hint="avg / day"
          />
          <StatTile
            icon="food-apple-outline"
            iconColor={s.macroFat}
            style={{ backgroundColor: s.fatTint }}
            label="Fat"
            value={`${macroAvgs.fat} g`}
            hint="avg / day"
          />
        </View>
      ) : (
        <Text style={[styles.chartNote, { color: s.mutedText, textAlign: 'left', marginBottom: 8 }]}>
          Macro averages appear once food is logged on at least one day.
        </Text>
      )}

      {/* ---- Body: weight, sleep, water ------------------------------------ */}
      <SectionTitle text="Body" style={styles.sectionGap} />
      <View style={styles.tiles}>
        <StatTile
          icon="scale-bathroom"
          iconColor={theme.colors.onSurfaceVariant}
          style={{ backgroundColor: s.weightTint }}
          label="Weight"
          value={weightChange != null ? `${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg` : '—'}
          hint={weights.length >= 2 ? `${weights[0].date.slice(5)} → ${weights[weights.length - 1].date.slice(5)}` : 'this week'}
        />
        <StatTile
          icon="moon-waning-crescent"
          iconColor={theme.colors.tertiary}
          style={{ backgroundColor: s.sleepTint }}
          label="Sleep"
          value={avgSleep != null ? `${avgSleep.toFixed(1)} h` : '—'}
          hint={sleeps.length ? `avg · ${sleeps.length} ${sleeps.length === 1 ? 'night' : 'nights'}` : 'not logged'}
        />
        <StatTile
          icon="water-outline"
          style={{ backgroundColor: s.waterTint }}
          label="Water"
          value={formatMl(waterTotalMl)}
          hint={waterLoggedDays > 0 ? `${waterLoggedDays} ${waterLoggedDays === 1 ? 'day' : 'days'}` : 'not logged'}
        />
      </View>

      {/* ---- Longer trend: weekly averages --------------------------------- */}
      <SectionTitle text="Trends" style={styles.sectionGap} />
      {trendWithData.length >= 2 ? (
        <>
          <Card
            mode="contained"
            style={styles.chartCard}
            accessibilityRole="image"
            accessibilityLabel={`Weekly average calories for the last ${weeklyTrend.length} weeks`}
          >
            <View style={styles.chartPad}>
              <BarChart
                data={weeklyTrend.map((w) => ({
                  value: w.avg,
                  label: w.label,
                  frontColor: w.key === thisWeekKey ? s.ringProgress : s.chartGrid,
                }))}
                width={300}
                height={160}
                barWidth={18}
                spacing={10}
                roundedTop
                roundedBottom
                noOfSections={trendAxis.noOfSections}
                maxValue={trendAxis.maxValue}
                rulesColor={s.chartGrid}
                yAxisLabelWidth={30}
                yAxisTextStyle={{ color: s.mutedText, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: s.mutedText, fontSize: 10 }}
              />
            </View>
          </Card>
          <Text style={[styles.chartNote, { color: s.mutedText }]}>
            Average calories per logged day, week by week. Weeks with no logs show as empty.
          </Text>
        </>
      ) : (
        <EmptyState
          icon="chart-bar"
          title="Not enough history yet"
          message="Log across a couple of weeks and the longer trend fills in here."
        />
      )}
      {longWeightDelta != null ? (
        <Text style={[styles.chartNote, { color: s.mutedText, marginBottom: 8 }]}>
          Weight over the same window: {longWeightDelta > 0 ? '+' : ''}
          {longWeightDelta.toFixed(1)} kg across {longWeights.length} weigh-ins.
        </Text>
      ) : null}

      {/* ---- Solutions ----------------------------------------------------- */}
      <SectionTitle text="Solutions" style={styles.sectionGap} />
      {solutions.length > 0 ? (
        solutions.map((sol) => (
          <View key={sol.title} style={[styles.solutionCard, { backgroundColor: theme.colors.surface }]}>
            <View style={[styles.solutionIcon, { backgroundColor: s.calorieTint }]}>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={18}
                color={theme.colors.primary}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            </View>
            <View style={styles.solutionBody}>
              <Text style={[styles.solutionTitle, { color: theme.colors.onSurface }]}>{sol.title}</Text>
              <Text style={[styles.solutionDetail, { color: theme.colors.onSurfaceVariant }]}>{sol.detail}</Text>
            </View>
          </View>
        ))
      ) : (
        <EmptyState
          icon="lightbulb-on-outline"
          title="No suggestions yet"
          message={
            loggedDays.length >= MIN_LOGGED_DAYS
              ? 'Nothing stands out as off-pattern this week. Keep logging as usual.'
              : 'Patterns show up here after a few logged days.'
          }
        />
      )}

      {/* Adaptive target — offered under Solutions, never applied silently. */}
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
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View style={styles.suggestBody}>
            <Text style={[styles.suggestTitle, { color: theme.colors.onPrimaryContainer }]}>
              Suggested target: {formatKcal(suggestion.suggestedTarget)} kcal/day
            </Text>
            <Text style={[styles.suggestReason, { color: theme.colors.onPrimaryContainer }]}>
              {suggestion.reason} Based on {suggestion.evidence}.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={theme.colors.onPrimaryContainer}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Pressable>
      ) : null}
    </LargeTitleScreen>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 13.5, marginBottom: 10 },
  sectionGap: { marginTop: 16 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chartCard: { borderRadius: 16, marginTop: 6 },
  chartPad: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 10, alignItems: 'center' },
  chartNote: { fontSize: 12, textAlign: 'center', marginTop: 6 },
  heroCard: { borderRadius: 22, marginTop: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, alignItems: 'center', gap: 2 },
  heroEyebrow: { fontSize: 11, letterSpacing: 1.2, fontFamily: fontFamilies.semibold, textTransform: 'uppercase' },
  heroValue: { fontSize: 30, letterSpacing: -0.5, fontFamily: fontFamilies.semibold },
  heroMeta: { fontSize: 12.5, textAlign: 'center', marginBottom: 10, fontFamily: fontFamilies.regular },
  legendDash: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed' },
  solutionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, padding: 14, marginBottom: 8 },
  solutionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  solutionBody: { flex: 1, gap: 4 },
  solutionTitle: { fontSize: 14, fontFamily: fontFamilies.semibold },
  solutionDetail: { fontSize: 12.5, lineHeight: 18, fontFamily: fontFamilies.regular },
  suggestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  suggestBody: { flex: 1, gap: 2 },
  suggestTitle: { fontSize: 14, fontFamily: fontFamilies.semibold },
  suggestReason: { fontSize: 11.5, lineHeight: 16, fontFamily: fontFamilies.regular },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 11.5, fontFamily: fontFamilies.medium },
});
