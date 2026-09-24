import * as React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Card, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Entry } from '../../types';
import { semantic } from '../../theme';
import type { SemanticColors } from '../../theme';
import { formatKcal, mealSlot } from '../../utils';
import type { MealSlot } from '../../utils';
import { EmptyState } from './feedback';
import { styles } from './styles';

/** Meal slot look: the colour says which meal, the icon names it. */
function slotLook(s: SemanticColors, slot: MealSlot): { icon: string; color: string; tint: string } {
  switch (slot) {
    case 'breakfast':
      return { icon: 'coffee-outline', color: s.macroFat, tint: s.mealTint };
    case 'lunch':
      return { icon: 'silverware-fork-knife', color: s.macroCarbs, tint: s.carbsTint };
    case 'dinner':
      return { icon: 'pot-steam-outline', color: s.macroProtein, tint: s.proteinTint };
    case 'snack':
      return { icon: 'cookie-outline', color: s.macroFat, tint: s.mealTint };
  }
}

// ---------------------------------------------------------------------------
// Entry list (shared by Home and Diary DayDetail)
// ---------------------------------------------------------------------------

export function EntryList({ entries, onPressEntry, emptyIcon = 'silverware-fork-knife', emptyTitle = 'Nothing logged yet', emptyMessage = 'Describe a meal below to get started.' }: {
  entries: Entry[];
  onPressEntry?: (entry: Entry) => void;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} />;
  }
  return (
    <View>
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} onPress={onPressEntry ? () => onPressEntry(entry) : undefined} />
      ))}
    </View>
  );
}

export function EntryCard({ entry, onPress }: { entry: Entry; onPress?: () => void }) {
  const theme = useTheme();
  const s = semantic(theme);
  const isFood = entry.type === 'food';
  // Movement keeps the green tint; food is tinted by the meal it was logged in.
  const look = isFood
    ? slotLook(s, mealSlot(entry.loggedAt))
    : { icon: 'run', color: theme.colors.tertiary, tint: s.workoutTint };
  const kcalText = isFood
    ? `plus ${formatKcal(entry.calories)} calories`
    : entry.caloriesBurned
      ? `minus ${formatKcal(entry.caloriesBurned)} calories burned`
      : 'Movement';
  return (
    <Card
      mode="contained"
      onPress={onPress}
      style={styles.entryCard}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${entry.title}, ${kcalText}` : undefined}
    >
      <View
        style={[styles.entryEdge, { backgroundColor: look.color }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Card.Content style={styles.entryContent}>
        {/* Image-style slot: a real photo when the entry has one; otherwise a
            quiet tinted tile with the meal's icon (no fake imagery). */}
        <View style={[styles.entryThumb, { backgroundColor: look.tint }]}>
          {entry.photoUrl ? (
            <Image source={{ uri: entry.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <MaterialCommunityIcons name={look.icon as any} size={22} color={look.color} />
          )}
        </View>
        <View style={styles.entryLeft}>
          <View style={styles.entryTitleRow}>
            <Text style={[styles.entryTitle, { color: theme.colors.onSurface }]}>{entry.title}</Text>
            <Text style={[styles.entryTime, { color: theme.colors.onSurfaceVariant }]}>
              {new Date(entry.loggedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={[styles.entryKcal, { color: theme.colors.onSurface }]}>
            {isFood ? `+ ${formatKcal(entry.calories)} kcal` : entry.caloriesBurned ? `− ${formatKcal(entry.caloriesBurned)} kcal` : 'Movement'}
          </Text>
          <View style={styles.entryChips}>
            {isFood ? (
              <>
                {entry.grams != null ? <EntryChip icon="weight" text={`${Math.round(entry.grams)} g`} /> : null}
                {(entry.carbs ?? 0) > 0 ? <EntryChip icon="barley" text={`${Math.round(entry.carbs ?? 0)} g`} color={s.macroCarbs} /> : null}
                {(entry.protein ?? 0) > 0 ? <EntryChip icon="egg-outline" text={`${Math.round(entry.protein ?? 0)} g`} color={s.macroProtein} /> : null}
                {(entry.fat ?? 0) > 0 ? <EntryChip icon="water" text={`${Math.round(entry.fat ?? 0)} g`} color={s.macroFat} /> : null}
              </>
            ) : (
              entry.caloriesBurned ? <EntryChip icon="fire" text={`${formatKcal(entry.caloriesBurned)} burned`} /> : null
            )}
            {entry.note ? <EntryChip icon="note-text-outline" text={entry.note} /> : null}
          </View>
        </View>
      </Card.Content>
    </Card>
  );
}

function EntryChip({ icon, text, color }: { icon: string; text: string; color?: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.entryChip, { backgroundColor: theme.dark ? theme.colors.surfaceVariant : '#F3F4F1' }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <MaterialCommunityIcons name={icon as any} size={11} color={color ?? theme.colors.onSurfaceVariant} />
      <Text numberOfLines={1} style={[styles.entryChipText, { color: theme.colors.onSurfaceVariant }]}>{text}</Text>
    </View>
  );
}
