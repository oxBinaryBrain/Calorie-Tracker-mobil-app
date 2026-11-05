import * as React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Divider, List, Switch, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AccountTabParams } from '../../navigation/types';
import type { ThemePref } from '../../types';
import { usePrefs } from '../../stores';
import { usingMockApi } from '../../api/client';
import { useDayEntries, useTargets } from '../../hooks/queries';
import { dateKey, formatKcal } from '../../utils';
import { ChoiceGroup, ChoicePill } from '../../components/inputs';
import { InfoRow, Screen, SectionTitle } from '../../components/ui';

type Props = NativeStackScreenProps<AccountTabParams, 'Settings'>;

/** Whole row is the switch: a bare 20pt web Switch is too small to tap. */
function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.switchRow, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.switchLabel, { color: theme.colors.onSurface }]} accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onChange}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no"
        aria-hidden={true}
        style={styles.switch}
      />
    </Pressable>
  );
}

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
      <SwitchRow
        label="Metric (kg, cm)"
        value={units === 'metric'}
        onChange={(v) => setUnits(v ? 'metric' : 'imperial')}
      />
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        Imperial shows lb/oz labels where supported.
      </Text>

      <Divider style={styles.divider} />

      <SectionTitle text="Daily reminder" />
      <SwitchRow
        label="Gentle nudge to log"
        value={reminderEnabled}
        onChange={(v) => void setReminder(v)}
      />
      {reminderEnabled ? (
        <View style={styles.hours} accessibilityRole="radiogroup" accessibilityLabel="Reminder hour">
          {HOURS.map((h) => (
            <ChoicePill
              key={h}
              label={`${h}:00`}
              selected={reminderHour === h}
              onPress={() => void setReminder(true, h)}
            />
          ))}
        </View>
      ) : null}
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
        One notification a day at the time you pick. No badges, no streaks.
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
      {/* Reads only: there is nothing behind it to open, so it is not a button. */}
      <InfoRow label="Your data" value={usingMockApi ? 'On this device' : 'Synced'} />
      <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant, marginBottom: 8 }]}>
        {usingMockApi
          ? `Mock mode: everything is stored locally. ${loggedToday > 0 ? `Today: ${loggedToday} ${loggedToday === 1 ? 'item' : 'items'} logged` : 'Nothing logged yet today'}${dailyCalories ? ` · ${formatKcal(dailyCalories)} kcal target` : ''}.`
          : 'Your diary syncs with your Caloria backend.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // 44pt+ tall row so the whole line is the tap target for the switch.
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, minHeight: 44 },
  switchLabel: { fontSize: 14, flex: 1, marginRight: 12 },
  switch: { height: 30 },
  hours: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  hint: { fontSize: 12, marginTop: 4 },
  divider: { marginVertical: 14 },
});
