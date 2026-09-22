import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MD3Theme } from 'react-native-paper';
import { dateKey, formatKcal } from '../../../utils';
import { fontFamilies } from '../../../theme';

/** Seven slim bars, one per day — tap one to open the day in the Diary. */
export function WeekStrip({ days, theme, onOpenDay }: {
  days: Array<{ date: string; calories: number }>;
  theme: MD3Theme;
  onOpenDay: (date: string) => void;
}) {
  const today = dateKey();
  return (
    <View style={styles.weekStrip} accessibilityRole="tablist" accessibilityLabel="Days this week">
      {days.map((d) => {
        const isToday = d.date === today;
        const logged = d.calories > 0;
        const dayNum = new Date(d.date).getDate();
        const dow = new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' });
        return (
          <Pressable
            key={d.date}
            onPress={() => onOpenDay(d.date)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isToday }}
            accessibilityLabel={`Open ${d.date} in Diary, ${formatKcal(d.calories)} calories`}
            style={({ pressed }) => [
              styles.weekDayCol,
              isToday && { backgroundColor: theme.colors.primaryContainer, borderRadius: 999, paddingVertical: 6 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.weekDayDow, { color: isToday ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }]}>{dow}</Text>
            <Text style={[styles.weekDayNum, { color: isToday ? theme.colors.onPrimaryContainer : theme.colors.onSurface }]}>
              {dayNum < 10 ? `0${dayNum}` : dayNum}
            </Text>
            <View
              style={[
                styles.weekDot,
                { backgroundColor: isToday ? theme.colors.primary : logged ? theme.colors.tertiary : 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  weekStrip: { flexDirection: 'row', alignItems: 'center' },
  weekDayCol: { flex: 1, alignItems: 'center', gap: 3 },
  weekDayDow: { fontSize: 12, fontFamily: fontFamilies.regular },
  weekDayNum: { fontSize: 14.5, fontFamily: fontFamilies.semibold },
  weekDot: { width: 5, height: 5, borderRadius: 2.5 },
});
