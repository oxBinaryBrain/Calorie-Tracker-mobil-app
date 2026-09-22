import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip, Divider, List, Switch, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import type { ThemePref } from '../../types';
import { usePrefs } from '../../stores';
import { usingMockApi } from '../../api/client';
import { useDayEntries, useTargets } from '../../hooks/queries';
import { dateKey, formatKcal } from '../../utils';
import { ChoiceGroup } from '../../components/inputs';
import { PressableRow, Screen, SectionTitle } from '../../components/ui';

type Props = NativeStackScreenProps<AccountTabParams, 'Settings'>;

const HOURS = [6, 7, 8, 12, 18, 20, 21];
const THEME_OPTIONS: Array<{ value: ThemePref; label: string }> = [
  { value: 'system', label: 'Automatic' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const today = dateKey();
  const entries = useDayEntries(today);
  const targets = useTargets();
  const loggedToday = (entries.data ?? []).filter((e) => e.type === 'food').length;
  const dailyCalories = targets.data?.dailyCalories;
  const units = usePrefs((s) => s.units);
  const setUnits = usePrefs((s) => s.setUnits);
  const themePref = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const reminderEnabled = usePrefs((s) => s.reminderEnabled);
  const reminderHour = usePrefs((s) => s.reminderHour);
  const setReminder = usePrefs((s) => s.setReminder);

  return (
    <Screen scroll title="Settings">
      <SectionTitle text="Appearance" />
      <ChoiceGroup
        label="Theme"
        options={THEME_OPTIONS}
        value={themePref}
        onChange={setTheme}
        columns={3}
      />
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        Automatic follows your device's light or dark setting.
      </Text>

      <Divider style={styles.divider} />

      <SectionTitle text="Units" />
      <View style={styles.switchRow}>
        <Text style={{ color: theme.colors.onSurface }}>Metric (kg, cm)</Text>
        <Switch value={units === 'metric'} onValueChange={(v) => setUnits(v ? 'metric' : 'imperial')} />
      </View>
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        Imperial shows lb/oz labels where supported.
      </Text>

      <Divider style={styles.divider} />

      <SectionTitle text="Daily reminder" />
      <View style={styles.switchRow}>
        <Text style={{ color: theme.colors.onSurface }}>Gentle nudge to log</Text>
        <Switch value={reminderEnabled} onValueChange={(v) => void setReminder(v)} />
      </View>
      {reminderEnabled ? (
        <View style={styles.hours}>
          {HOURS.map((h) => (
            <Chip key={h} selected={reminderHour === h} onPress={() => void setReminder(true, h)} style={styles.chip} compact>
              {h}:00
            </Chip>
          ))}
        </View>
      ) : null}
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        One quiet local notification a day. No badges, no streaks.
      </Text>

      <Divider style={styles.divider} />

      <List.Item
        title="Version"
        description="Caloria 1.0.0"
        titleStyle={{ color: theme.colors.onSurface }}
        descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
      />

      <Divider style={styles.divider} />

      <SectionTitle text="About" />
      <PressableRow
        label="Your data"
        icon="database-outline"
        value={usingMockApi ? 'On this device' : 'Synced'}
        onPress={() => {}}
        last
      />
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant, marginBottom: 8 }]}>
        {usingMockApi
          ? `Mock mode — everything is stored locally. ${loggedToday > 0 ? `Today: ${loggedToday} ${loggedToday === 1 ? 'item' : 'items'} logged` : 'Nothing logged yet today'}${dailyCalories ? ` · ${formatKcal(dailyCalories)} kcal target` : ''}.`
          : 'Your diary syncs with your Caloria backend.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  chip: { margin: 2 },
  hint: { fontSize: 12, marginTop: 4 },
  divider: { marginVertical: 14 },
});
