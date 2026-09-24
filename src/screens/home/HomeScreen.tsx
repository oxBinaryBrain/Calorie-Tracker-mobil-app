import * as React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeTabParams } from '../../navigation/types';
import type { ParsedEntry } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import { useDayEntries, todayTotals, useTargets, useDayTracker, useUpsertTracker, useProfile, useEntriesRange, weekRange } from '../../hooks/queries';
import { dateKey, formatKcal, formatMl, greeting } from '../../utils';
import { fontFamilies, semantic } from '../../theme';
import { effectiveWaterGoalMl } from '../../services/targets';
import { CalorieRing, EntryList, MacroBars, EmptyState } from '../../components/ui';
import { usingMockApi } from '../../api/client';
import { usePrefs } from '../../stores';
import { WeekStrip } from './parts/WeekStrip';
import { WaterQuickAdd } from './parts/WaterQuickAdd';
import { AgainSection } from './parts/AgainSection';
import { LogBar } from './parts/LogBar';

type Props = NativeStackScreenProps<HomeTabParams, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const today = dateKey();
  const entries = useDayEntries(today);
  const targets = useTargets();
  const profile = useProfile();
  const tracker = useDayTracker(today);
  const upsertTracker = useUpsertTracker();
  const waterGoalPref = usePrefs((s) => s.waterGoalMl);
  const [refreshing, setRefreshing] = React.useState(false);
  const queryClient = useQueryClient();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['entries'] }),
      queryClient.invalidateQueries({ queryKey: ['tracker'] }),
      queryClient.invalidateQueries({ queryKey: ['targets'] }),
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const totals = todayTotals(entries.data);
  const target = targets.data;
  const p = profile.data;
  const s = semantic(theme);

  const { from: weekFrom, days: weekDays } = weekRange();
  const weekEntries = useEntriesRange(weekFrom, today);
  const targetKcal = target?.dailyCalories ?? 0;
  const weekTotals = weekDays.map((d) => ({
    date: d,
    calories: (weekEntries.data ?? [])
      .filter((e) => e.type === 'food' && e.loggedAt.slice(0, 10) === d)
      .reduce((sum, e) => sum + e.calories, 0),
  }));
  const loggedCount = weekTotals.filter((d) => d.calories > 0).length;
  const weekTotal = weekTotals.reduce((sum, d) => sum + d.calories, 0);

  const insightBits: string[] = [];
  const waterToday = tracker.data?.waterMl ?? 0;
  if (tracker.data?.sleepHours != null) insightBits.push(`${tracker.data.sleepHours} h of sleep`);
  if (tracker.data?.weightKg != null) insightBits.push(`${tracker.data.weightKg} kg`);
  if (waterToday > 0) insightBits.push(`${formatMl(waterToday)} of water`);

  const goTab = (tab: 'TrackersTab' | 'SummaryTab' | 'DiaryTab' | 'AccountTab') => {
    (navigation as any).getParent()?.navigate(tab);
  };

  const openParsed = React.useCallback((parsed: ParsedEntry[], rawInput: string, photoUri?: string) => {
    navigation.navigate('EntryConfirm', { parsed, rawInput, photoUri });
  }, [navigation]);

  const todayFood = (entries.data ?? []).filter((e) => e.type === 'food');
  const firstName = (p?.displayName || '').split(' ')[0];
  const goalMl = effectiveWaterGoalMl(waterGoalPref, p?.weightKg, p?.activityLevel);

  const remainingKcal = targetKcal - totals.calories;
  const dayStrip: Array<{ icon: string; text: string }> = [
    { icon: 'silverware-fork-knife', text: `${todayFood.length} ${todayFood.length === 1 ? 'meal' : 'meals'}` },
    {
      icon: 'target',
      text:
        targetKcal > 0
          ? remainingKcal >= 0
            ? `${formatKcal(remainingKcal)} left`
            : `${formatKcal(-remainingKcal)} over`
          : `${formatKcal(totals.calories)} in`,
    },
    { icon: 'water-outline', text: `${formatMl(waterToday)} / ${formatMl(goalMl)}` },
  ];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{ paddingBottom: 118 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          <View style={styles.header}>
            <Pressable
              style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]}
              onPress={() => goTab('AccountTab')}
              accessibilityRole="button"
              accessibilityLabel="Open account"
            >
              <Text style={{ fontSize: 20, color: theme.colors.onPrimaryContainer }}>{p?.avatarEmoji ?? '🌿'}</Text>
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.greeting, { color: theme.colors.onBackground }]}>
                {greeting()}{firstName ? `, ${firstName}` : ''}
              </Text>
              <Text style={[styles.dateLine, { color: theme.colors.onSurfaceVariant }]}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View
              style={[styles.bellChip, { backgroundColor: theme.colors.surface }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              <MaterialCommunityIcons name="bell-outline" size={20} color={theme.colors.onSurface} />
            </View>
          </View>

          <View
            style={styles.dayStrip}
            accessibilityRole="text"
            accessibilityLabel={`Today: ${dayStrip.map((d) => d.text).join(', ')}`}
          >
            {dayStrip.map((d, i) => (
              <View
                key={d.icon}
                style={[
                  styles.dayItem,
                  i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.outlineVariant, paddingLeft: 10 },
                ]}
              >
                <MaterialCommunityIcons
                  name={d.icon as any}
                  size={14}
                  color={theme.colors.onSurfaceVariant}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text numberOfLines={1} style={[styles.dayItemText, { color: theme.colors.onSurfaceVariant }]}>
                  {d.text}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.hero, { backgroundColor: s.calorieTint }]}>
            <View style={styles.heroNumbers}>
              <Text style={styles.heroBig}>
                <Text style={{ color: theme.colors.onBackground }}>
                  {targetKcal > 0 ? formatKcal(Math.abs(remainingKcal)) : formatKcal(totals.calories)}
                </Text>
                <Text style={[styles.heroUnit, { color: theme.colors.onSurfaceVariant }]}>
                  {targetKcal > 0 ? (remainingKcal >= 0 ? ' kcal left' : ' kcal over') : ' kcal logged'}
                </Text>
              </Text>
              <Text style={[styles.heroSub, { color: theme.colors.onSurfaceVariant }]}>
                {targetKcal > 0
                  ? `Target ${formatKcal(targetKcal)} kcal${totals.burned > 0 ? ` · ${formatKcal(totals.burned)} burned` : ''}`
                  : 'No daily target yet. Set one to see what is left.'}
              </Text>
            </View>
            {targetKcal > 0 ? (
              <CalorieRing
                size={100}
                consumed={totals.calories}
                target={targetKcal}
                center={
                  <View style={styles.ringEaten}>
                    <Text style={[styles.ringEatenValue, { color: theme.colors.onBackground }]}>
                      {formatKcal(totals.calories)}
                    </Text>
                    <Text style={[styles.ringEatenLabel, { color: theme.colors.onSurfaceVariant }]}>eaten</Text>
                  </View>
                }
              />
            ) : (
              <Pressable
                onPress={() => (navigation as any).getParent()?.navigate('AccountTab', { screen: 'Goals' })}
                accessibilityRole="button"
                accessibilityLabel="Set your daily calorie target"
                style={({ pressed }) => [
                  styles.heroCta,
                  { backgroundColor: theme.colors.primaryContainer },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.heroCtaText, { color: theme.colors.onPrimaryContainer }]}>Set target</Text>
              </Pressable>
            )}
          </View>

          {target ? (
            <View style={[styles.macroCard, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.macroCardTitle, { color: theme.colors.onSurface }]}>Macros</Text>
              <MacroBars carbs={totals.carbs} protein={totals.protein} fat={totals.fat} targets={target} />
            </View>
          ) : null}

          <View style={[styles.weekCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <View style={styles.weekHeader}>
              <Text style={[styles.weekTitle, { color: theme.colors.onSurface }]}>This week</Text>
              <Text style={[styles.weekMeta, { color: theme.colors.onSurfaceVariant }]}>
                {loggedCount === 0
                  ? 'No days logged yet'
                  : `${loggedCount} of 7 days logged${weekTotal > 0 ? ` · ${formatKcal(weekTotal)} kcal` : ''}`}
              </Text>
            </View>
            <WeekStrip
              days={weekTotals}
              theme={theme}
              onOpenDay={(date) =>
                (navigation as any).getParent()?.navigate('DiaryTab', { screen: 'DayDetail', params: { date } })
              }
            />
          </View>

          <WaterQuickAdd
            loggedMl={waterToday}
            goalMl={goalMl}
            onAdd={(ml) => upsertTracker.mutate({ date: today, waterMl: Math.max(0, waterToday + ml) })}
          />

          <Pressable
            onPress={() => goTab('TrackersTab')}
            android_ripple={{ color: theme.colors.surfaceVariant }}
            accessibilityRole="button"
            accessibilityLabel="Open trackers"
            style={[styles.insightRow, { backgroundColor: theme.colors.surface }]}
          >
            <View style={[styles.insightIcon, { backgroundColor: theme.colors.tertiaryContainer }]}>
              <MaterialCommunityIcons name="clipboard-pulse-outline" size={18} color={theme.colors.tertiary} accessibilityElementsHidden importantForAccessibility="no" />
            </View>
            <Text numberOfLines={1} style={[styles.insightText, { color: theme.colors.onSurfaceVariant }]}>
              {insightBits.length > 0 ? insightBits.join(' · ') : 'Water, weight and sleep live here.'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>

          <Text style={[styles.section, { color: theme.colors.onSurfaceVariant }]}>Today</Text>
          {entries.isLoading ? (
            <ActivityIndicator style={styles.loading} />
          ) : (entries.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon="silverware-fork-knife"
              title="Nothing logged yet"
              message={usingMockApi ? 'Try: "two eggs, toast and a latte" below.' : 'Describe a meal below to get started.'}
            />
          ) : (
            <View style={styles.list}>
              <EntryList entries={entries.data ?? []} onPressEntry={(entry) => navigation.navigate('EntryDetail', { entryId: entry.id })} />
            </View>
          )}

          <AgainSection todayFood={todayFood} />
        </ScrollView>

        <LogBar onParsed={openParsed} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  dayStrip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 14, gap: 10 },
  dayItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayItemText: { fontSize: 12.5, fontFamily: fontFamilies.regular },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  bellChip: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 20, fontWeight: '700', fontFamily: fontFamilies.semibold },
  dateLine: { fontSize: 12.5, marginTop: 1, fontFamily: fontFamilies.regular },
  hero: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  heroNumbers: { flex: 1, gap: 2 },
  heroBig: { fontSize: 30, fontFamily: fontFamilies.semibold, letterSpacing: -0.5 },
  heroUnit: { fontSize: 14, fontFamily: fontFamilies.regular },
  heroSub: { fontSize: 12.5, fontFamily: fontFamilies.regular },
  ringEaten: { alignItems: 'center' },
  ringEatenValue: { fontSize: 19, fontWeight: '600', fontFamily: fontFamilies.semibold },
  ringEatenLabel: { fontSize: 10.5, fontFamily: fontFamilies.regular },
  heroCta: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  heroCtaText: { fontSize: 13, fontFamily: fontFamilies.medium },
  macroCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  macroCardTitle: { fontSize: 15, fontWeight: '600', fontFamily: fontFamilies.semibold, marginBottom: 10 },
  section: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, marginTop: 16, marginBottom: 6, fontFamily: fontFamilies.semibold },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  weekTitle: { fontSize: 15, fontWeight: '600', fontFamily: fontFamilies.semibold },
  weekMeta: { fontSize: 12, fontFamily: fontFamilies.regular },
  weekCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  insightIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.regular },
  loading: { padding: 24 },
  list: { paddingHorizontal: 16 },
});
