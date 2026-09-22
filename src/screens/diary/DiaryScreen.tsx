import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import type { DateData } from 'react-native-calendars';
import { useTheme } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DiaryTabParams } from '../../navigation/types';
import { useEntriesRange, useTrackerRange } from '../../hooks/queries';
import { addDays, dateKey, monthKeyOf } from '../../utils';
import { fontFamilies } from '../../theme';
import { usePrefs } from '../../stores';
import { LargeTitleScreen } from '../../components/ui';

type Props = NativeStackScreenProps<DiaryTabParams, 'Diary'>;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function headerLabel(monthStart: string) {
  const y = Number(monthStart.slice(0, 4));
  const m = Number(monthStart.slice(5, 7)) - 1;
  const thisYear = new Date().getFullYear();
  const name = MONTH_NAMES[m] ?? monthStart;
  return y === thisYear ? name : `${name} ${y}`;
}

/** One month-summary dot: a tiny day cell (I, II, III or all logged). */
function MonthDot({ label, filled, filledColor, emptyColor, textColor, accessibilityLabel }: {
  label: string;
  filled: boolean;
  filledColor: string;
  emptyColor: string;
  textColor: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.monthDotCell} accessibilityLabel={accessibilityLabel} accessibilityRole="text">
      <View
        style={[styles.monthDot, { backgroundColor: filled ? filledColor : emptyColor }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.monthDotText, { color: textColor }]} importantForAccessibility="no">{label}</Text>
    </View>
  );
}

export default function DiaryScreen({ navigation }: Props) {
  const theme = useTheme();
  const qc = useQueryClient();
  const today = dateKey();
  const todayMonth = monthKeyOf(today);

  // The month the calendar is showing. Persisted so returning to the tab
  // (and relaunching) restores where the user was.
  const savedMonth = usePrefs((s) => s.calendarMonth);
  const hydratedPrefs = usePrefs((s) => s.hydrated);
  const setCalendarMonthPref = usePrefs((s) => s.setCalendarMonth);
  const [visibleMonth, setVisibleMonth] = React.useState<string>(
    savedMonth && /^\d{4}-\d{2}-01$/.test(savedMonth) ? savedMonth : todayMonth,
  );
  // Once prefs hydrate (possibly after this screen mounted), restore the last
  // viewed month — unless the user already navigated in this session.
  const navigatedThisSession = React.useRef(false);
  React.useEffect(() => {
    if (hydratedPrefs && !navigatedThisSession.current && savedMonth && /^\d{4}-\d{2}-01$/.test(savedMonth)) {
      setVisibleMonth(monthKeyOf(savedMonth));
    }
  }, [hydratedPrefs, savedMonth]);

  // Marks come from month-scoped queries — only the visible month is fetched,
  // and each month change swaps to a fresh bounded query.
  const from = visibleMonth;
  const to = addDays(visibleMonth, 31);
  const range = useEntriesRange(from, to);
  const trackerRange = useTrackerRange(from, to);
  const loggedDays = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of range.data ?? []) set.add(e.loggedAt.slice(0, 10));
    return set;
  }, [range.data]);

  // Month summary for the header: of the visible month's days, how many had
  // meals, workouts, or a tracker note. Computed from the same month-scoped
  // data — no extra fetching beyond the two bounded queries above.
  const summary = React.useMemo(() => {
    const mealDays = new Set<string>();
    const workoutDays = new Set<string>();
    for (const e of range.data ?? []) {
      const k = e.loggedAt.slice(0, 10);
      if (e.type === 'food') mealDays.add(k);
      else if (e.type === 'exercise') workoutDays.add(k);
    }
    const trackerDays = new Set<string>();
    for (const t of trackerRange.data ?? []) {
      if (t.waterMl != null || t.weightKg != null || t.sleepHours != null) trackerDays.add(t.date);
    }
    return { meals: mealDays.size, workouts: workoutDays.size, trackers: trackerDays.size };
  }, [range.data, trackerRange.data]);

  // The summary only changes when the underlying data or month changes; the
  // header render is pure from these memoized values.
  const summaryNode = React.useMemo(() => {
    const rows: Array<{ label: string; n: number }> = [
      { label: 'Meals', n: summary.meals },
      { label: 'Workouts', n: summary.workouts },
      { label: 'Trackers', n: summary.trackers },
    ];
    const onSurface = theme.colors.onSurfaceVariant;
    return (
      <View style={styles.monthSummary} pointerEvents="none">
        {rows.map((r) => (
          <MonthDot
            key={r.label}
            label={r.n > 0 ? `${r.label} · ${r.n}` : r.label}
            filled={r.n > 0}
            filledColor={theme.colors.primary}
            emptyColor={theme.colors.outlineVariant}
            textColor={onSurface}
            accessibilityLabel={`${r.label}: ${r.n}`}
          />
        ))}
      </View>
    );
  }, [summary, theme]);

  const marked = React.useMemo(() => {
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string; selectedTextColor?: string }> = {};
    for (const day of loggedDays) {
      marks[day] = { marked: true, dotColor: theme.colors.primary };
    }
    if (loggedDays.has(today)) {
      marks[today] = { ...marks[today], selected: true, selectedColor: theme.colors.primaryContainer, selectedTextColor: theme.colors.onPrimaryContainer };
    }
    return marks;
  }, [loggedDays, theme, today]);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['entries'] });
    await qc.invalidateQueries({ queryKey: ['trackers'] });
    setRefreshing(false);
  }, [qc]);

  return (
    <LargeTitleScreen
      title="Diary"
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      <Calendar
        initialDate={visibleMonth}
        onDayPress={(day: DateData) => navigation.navigate('DayDetail', { date: day.dateString })}
        onMonthChange={(m: DateData) => {
          const key = monthKeyOf(m.dateString);
          if (key !== visibleMonth) {
            navigatedThisSession.current = true;
            setVisibleMonth(key);
            setCalendarMonthPref(key);
          }
        }}
        markedDates={marked}
        markingType="dot"
        renderHeader={(date?: { getFullYear?: () => number; getMonth?: () => number }) => {
          // The calendar passes its internal XDate; its local getters name the
          // visible month. Fall back to our tracked month if unavailable.
          let m = visibleMonth;
          if (date && typeof date.getFullYear === 'function' && typeof date.getMonth === 'function') {
            const y = date.getFullYear();
            const mo = date.getMonth();
            if (Number.isFinite(y) && Number.isFinite(mo)) {
              m = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
            }
          }
          return (
            <View style={styles.monthHeader}>
              <Text style={[styles.monthHeaderText, { color: theme.colors.onBackground }]}>
                {headerLabel(m)}
              </Text>
              {summaryNode}
            </View>
          );
        }}
        theme={{
          calendarBackground: 'transparent',
          dayTextColor: theme.colors.onSurface,
          // De-emphasized but still readable: the theme's secondary text color
          // (gray600 light / gray400 dark). The previous gray200 measured 1.19:1
          // in the light-mode QA pass.
          textDisabledColor: theme.colors.onSurfaceVariant,
          // Weekday headers (Mon–Sun) previously used the library's default
          // light gray (1.74:1); they now follow the theme's secondary text.
          textSectionTitleColor: theme.colors.onSurfaceVariant,
          monthTextColor: theme.colors.onBackground,
          arrowColor: theme.colors.onSurface,
          todayTextColor: theme.colors.primary,
          selectedDayBackgroundColor: theme.colors.primaryContainer,
          selectedDayTextColor: theme.colors.onPrimaryContainer,
          dotColor: theme.colors.primary,
          textDayFontFamily: fontFamilies.regular,
          textMonthFontFamily: fontFamilies.semibold,
          textDayHeaderFontFamily: fontFamilies.medium,
        }}
        firstDay={1}
        // Accessibility: the library ships its own a11y labels; keep the
        // container identifiable for screen readers without hiding days.
        accessibilityLabel="Calendar of logged days"
      />
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]} accessibilityRole="text">
        Dots mark days with entries. Tap a day to see it.
      </Text>
      <RecentDays onOpen={(date) => navigation.navigate('DayDetail', { date })} />
    </LargeTitleScreen>
  );
}

/** The last few days with anything logged — a jump-off point that needs no
 * calendar paging. Sits below the calendar to fill the empty lower half. */
function RecentDays({ onOpen }: { onOpen: (date: string) => void }) {
  const theme = useTheme();
  const today = dateKey();
  const from = addDays(today, -13);
  const entries = useEntriesRange(from, today);
  const trackers = useTrackerRange(from, today);

  const recent = React.useMemo(() => {
    const kcalByDay = new Map<string, number>();
    for (const e of entries.data ?? []) {
      if (e.type !== 'food') continue;
      const k = e.loggedAt.slice(0, 10);
      kcalByDay.set(k, (kcalByDay.get(k) ?? 0) + e.calories);
    }
    const trackerByDay = new Map((trackers.data ?? []).map((t) => [t.date, t]));
    const days: Array<{ date: string; kcal: number; waterMl: number; weightKg?: number; sleepHours?: number }> = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(today, -i);
      const kcal = kcalByDay.get(d) ?? 0;
      const t = trackerByDay.get(d);
      const hasNote = kcal > 0 || (t != null && (t.waterMl > 0 || t.weightKg != null || t.sleepHours != null));
      if (!hasNote) continue;
      days.push({ date: d, kcal, waterMl: t?.waterMl ?? 0, weightKg: t?.weightKg, sleepHours: t?.sleepHours });
    }
    return days.slice(0, 5);
  }, [entries.data, trackers.data, today]);

  if (recent.length === 0) return null;

  const parts = (d: { kcal: number; waterMl: number; weightKg?: number; sleepHours?: number }) => {
    const bits: string[] = [];
    if (d.kcal > 0) bits.push(`${Math.round(d.kcal).toLocaleString()} kcal`);
    if (d.waterMl > 0) bits.push(d.waterMl >= 1000 ? `${(d.waterMl / 1000).toFixed(d.waterMl % 1000 === 0 ? 0 : 1)} L` : `${Math.round(d.waterMl)} ml`);
    if (d.weightKg != null) bits.push(`${d.weightKg} kg`);
    if (d.sleepHours != null) bits.push(`${d.sleepHours} h sleep`);
    return bits.join(' · ');
  };

  return (
    <View style={styles.recentWrap}>
      <Text style={[styles.recentTitle, { color: theme.colors.onSurfaceVariant }]}>Recent days</Text>
      <View style={[styles.recentCard, { backgroundColor: theme.colors.surface }]}>
        {recent.map((d, i) => (
          <Pressable
            key={d.date}
            onPress={() => onOpen(d.date)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${d.date} in Diary`}
            android_ripple={{ color: theme.colors.surfaceVariant }}
            style={({ pressed }) => [
              styles.recentRow,
              i < recent.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant },
              pressed && { opacity: 0.6 },
            ]}
          >
            <View style={styles.recentLeft}>
              <Text style={[styles.recentDate, { color: theme.colors.onSurface }]}>
                {d.date === today ? 'Today' : new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
              <Text numberOfLines={1} style={[styles.recentDetail, { color: theme.colors.onSurfaceVariant }]}>
                {parts(d)}
              </Text>
            </View>
            <Text style={[styles.recentChevron, { color: theme.colors.onSurfaceVariant }]}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12.5, textAlign: 'center', padding: 16, fontFamily: fontFamilies.regular },
  monthHeader: { alignItems: 'center', gap: 4, paddingVertical: 2 },
  monthHeaderText: { fontSize: 15.5, fontFamily: fontFamilies.semibold },
  monthSummary: { flexDirection: 'row', gap: 14 },
  monthDotCell: { alignItems: 'center', gap: 3 },
  monthDot: { width: 7, height: 7, borderRadius: 3.5 },
  monthDotText: { fontSize: 9, fontFamily: fontFamilies.medium },
  recentWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  recentTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8, fontFamily: fontFamilies.semibold },
  recentCard: { borderRadius: 16, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  recentLeft: { flex: 1, gap: 2 },
  recentDate: { fontSize: 14.5, fontFamily: fontFamilies.medium },
  recentDetail: { fontSize: 12.5, fontFamily: fontFamilies.regular },
  recentChevron: { fontSize: 20, marginLeft: 8 },
});
