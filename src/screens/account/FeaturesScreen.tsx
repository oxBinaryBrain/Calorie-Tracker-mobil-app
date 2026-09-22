import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Divider, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import { Screen } from '../../components/ui';

type Props = NativeStackScreenProps<AccountTabParams, 'Features'>;

const GROUPS: Array<{ title: string; items: Array<[string, string, string]> }> = [
  {
    title: 'Logging',
    items: [
      ['message-text-outline', 'Text logging', 'Type what you ate. Caloria splits it into items with calories and macros you can edit.'],
      ['camera-outline', 'Photo logging', 'Photograph your plate. Each visible food gets its own estimate.'],
      ['pencil-outline', 'Edit anything', 'Every entry can be adjusted, re-analyzed, or deleted.'],
    ],
  },
  {
    title: 'Review',
    items: [
      ['calendar-month-outline', 'Diary', 'A calendar of logged days. Tap one to see what you recorded.'],
      ['chart-box-outline', 'Weekly summary', 'Average calories, days near target, movement, weight change, and sleep.'],
      ['circle-slice-6', 'Daily targets', 'A ring and macro bars showing where the day stands. No warnings.'],
    ],
  },
  {
    title: 'Trackers',
    items: [
      ['cup-water', 'Water', 'Quick-add chips for the day.'],
      ['scale-bathroom', 'Weight', 'A 90-day trend line.'],
      ['weather-night', 'Sleep', 'Hours and a quality rating.'],
    ],
  },
  {
    title: 'Caloria Pro',
    items: [
      ['star-outline', 'What Pro adds', 'Photo logging, weekly summaries, and unlimited history. Optional; the free plan is a complete diary.'],
    ],
  },
];

export default function FeaturesScreen({ navigation }: Props) {
  const theme = useTheme();

  return (
    <Screen scroll title="Features">
      {GROUPS.map((group) => (
        <View key={group.title}>
          <Text style={[styles.groupTitle, { color: theme.colors.primary }]}>{group.title}</Text>
          <Card mode="contained" style={styles.card}>
            <Card.Content style={styles.cardContent}>
              {group.items.map(([icon, title, desc], i) => (
                <View key={title}>
                  {i > 0 ? <Divider style={styles.divider} /> : null}
                  <View style={styles.item}>
                    <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <MaterialCommunityIcons name={icon as any} size={20} color={theme.colors.onSurfaceVariant} />
                    </View>
                    <View style={styles.itemText}>
                      <Text style={[styles.itemTitle, { color: theme.colors.onSurface }]}>{title}</Text>
                      <Text style={[styles.itemDesc, { color: theme.colors.onSurfaceVariant }]}>{desc}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupTitle: { fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 6, letterSpacing: 0.3 },
  card: { borderRadius: 16 },
  cardContent: { paddingVertical: 4, paddingHorizontal: 14 },
  item: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 14.5, fontWeight: '600' },
  itemDesc: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  divider: { opacity: 0.5 },
});
