import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrackersTabParams } from '../../navigation/types';
import type { SleepQuality } from '../../types';
import { useDayTracker, useTrackerRange, useUpsertTracker, useProfile } from '../../hooks/queries';
import { addDays, dateKey, formatMl } from '../../utils';
import { effectiveWaterGoalMl } from '../../services/targets';
import { tickLight } from '../../services/haptics';
import { usePrefs } from '../../stores';
import { LargeTitleScreen, QuickChip } from '../../components/ui';

type Props = NativeStackScreenProps<TrackersTabParams, 'Trackers'>;

const WATER_CHIPS = [100, 250, 330, 500];

const QUALITY_LABELS: Record<SleepQuality, string> = {
  poor: 'Rough',
  fair: 'Fair',
  good: 'Good',
};

function monthBounds(key: string) {
  return { from: key.slice(0, 8) + '01', to: key.slice(0, 8) + '31' };
}

export default function TrackersScreen({ navigation }: Props) {
  const theme = useTheme();
  const qc = useQueryClient();
  const today = dateKey();
  const tracker = useDayTracker(today);
  const upsert = useUpsertTracker();
  const profile = useProfile();
  const waterGoalPref = usePrefs((s) => s.waterGoalMl);
  const goalMl = effectiveWaterGoalMl(waterGoalPref, profile.data?.weightKg, profile.data?.activityLevel);
  const { from, to } = monthBounds(today);
  const month = useTrackerRange(from, to);
  const t = tracker.data;
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['tracker'] });
    await qc.invalidateQueries({ queryKey: ['trackers'] });
    await qc.invalidateQueries({ queryKey: ['profile'] });
    setRefreshing(false);
  }, [qc]);

  // Water progress for today against the personalized goal.
  const waterMl = t?.waterMl ?? 0;
  const waterPct = Math.min(100, Math.round((waterMl / goalMl) * 100));

  // Last weighed-in value and its change since the previous weighing.
  const weighIns = (month.data ?? [])
    .filter((d) => d.weightKg != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastWeight = weighIns[weighIns.length - 1]?.weightKg ?? t?.weightKg;
  const prevWeight = weighIns.length >= 2 ? weighIns[weighIns.length - 2].weightKg : undefined;
  const weightDelta = lastWeight != null && prevWeight != null ? lastWeight - prevWeight : undefined;

  const addWater = (ml: number) => {
    tickLight();
    upsert.mutate({ date: today, waterMl: Math.max(0, waterMl + ml) });
  };

  const rows = [
    {
      key: 'weight',
      title: 'Weight',
      icon: 'scale-bathroom',
      value: lastWeight != null ? `${lastWeight} kg` : 'Not noted yet',
      detail:
        weightDelta == null
          ? weighIns.length >= 1
            ? 'One weigh-in this month'
            : 'Weigh in to see a trend'
          : `${weightDelta > 0 ? '+' : ''}${weightDelta.toFixed(1)} kg since last note`,
      route: 'Weight' as const,
    },
    {
      key: 'sleep',
      title: 'Sleep',
      icon: 'sleep',
      value:
        t?.sleepHours != null
          ? `${t.sleepHours} h${t.sleepQuality ? ` · ${QUALITY_LABELS[t.sleepQuality]}` : ''}`
          : 'Not noted yet',
      detail: t?.sleepHours != null ? 'Tap to adjust hours or mood' : 'How long, and how it felt',
      route: 'Sleep' as const,
    },
  ];

  return (
    <LargeTitleScreen
      title="Trackers"
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
    >
      <Text style={[styles.intro, { color: theme.colors.onSurfaceVariant }]} accessibilityRole="text">
        Gentle trackers for the day. Everything is optional.
      </Text>

      {/* Water card with inline progress and quick-add, so the common action
          needs no round-trip through the Water screen. */}
      <Card
        mode="contained"
        style={styles.card}
        onPress={() => navigation.navigate('Water', { date: today })}
      >
        <Card.Content>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name="cup-water" size={22} color={theme.colors.onPrimaryContainer} />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.title, { color: theme.colors.onSurface }]}>Water</Text>
              <Text style={[styles.value, { color: theme.colors.onSurfaceVariant }]}>
                {formatMl(waterMl)} of {formatMl(goalMl)} · {waterPct}%
              </Text>
            </View>
            <Text style={[styles.chevron, { color: theme.colors.onSurfaceVariant }]}>›</Text>
          </View>
          <View
            style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: waterPct, text: `${waterPct} percent of daily water goal` }}
          >
            <View style={[styles.progressFill, { width: `${waterPct}%`, backgroundColor: theme.colors.primary }]} />
          </View>
          <View style={styles.chipRow}>
            {WATER_CHIPS.map((ml) => (
              <QuickChip key={ml} label={`+${ml}`} onPress={() => addWater(ml)} />
            ))}
          </View>
        </Card.Content>
      </Card>

      {rows.map((card) => (
        <Card
          key={card.key}
          mode="contained"
          style={styles.card}
          onPress={() => navigation.navigate(card.route, { date: today })}
        >
          <Card.Content>
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
                <MaterialCommunityIcons name={card.icon as any} size={22} color={theme.colors.onPrimaryContainer} />
              </View>
              <View style={styles.textWrap}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>{card.title}</Text>
                <Text style={[styles.value, { color: theme.colors.onSurfaceVariant }]}>{card.value}</Text>
              </View>
              <Text style={[styles.chevron, { color: theme.colors.onSurfaceVariant }]}>›</Text>
            </View>
            <Text style={[styles.cardDetail, { color: theme.colors.onSurfaceVariant }]}>{card.detail}</Text>
          </Card.Content>
        </Card>
      ))}
    </LargeTitleScreen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 13.5, padding: 16, paddingBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  textWrap: { flex: 1, gap: 1 },
  title: { fontSize: 15.5, fontWeight: '600' },
  value: { fontSize: 13 },
  chevron: { fontSize: 22, fontWeight: '400' },
  progressTrack: { height: 8, borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginBottom: 2 },
  cardDetail: { fontSize: 12.5, marginTop: 10, marginLeft: 58 },
});
