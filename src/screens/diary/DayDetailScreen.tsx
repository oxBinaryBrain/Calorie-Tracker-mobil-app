import * as React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconButton, TextInput, useTheme } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DiaryTabParams } from '../../navigation/types';
import { useDayEntries, todayTotals, useSaveMealTemplate } from '../../hooks/queries';
import { templateFromEntries } from '../../db/meal-template-repo-types';
import { formatDateLong, formatKcal } from '../../utils';
import { AppHeader, EntryList, StatTile } from '../../components/ui';
import { useToasts } from '../../stores';

type Props = NativeStackScreenProps<DiaryTabParams, 'DayDetail'>;

export default function DayDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const qc = useQueryClient();
  const { date } = route.params;
  const entries = useDayEntries(date);
  const saveTemplate = useSaveMealTemplate();
  const totals = todayTotals(entries.data);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['entries'] }),
      qc.invalidateQueries({ queryKey: ['trackers'] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  const foodEntries = (entries.data ?? []).filter((e) => e.type === 'food');
  const [naming, setNaming] = React.useState(false);
  const [name, setName] = React.useState('');

  const onSaveTemplate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      show('Give the template a name first');
      return;
    }
    if (foodEntries.length === 0 || saveTemplate.isPending) return;
    try {
      await saveTemplate.mutateAsync(
        templateFromEntries(
          trimmed,
          foodEntries.map((e) => ({
            type: e.type,
            title: e.title,
            grams: e.grams,
            calories: e.calories,
            carbs: e.carbs,
            protein: e.protein,
            fat: e.fat,
            caloriesBurned: e.caloriesBurned,
            note: e.note,
          })),
        ),
      );
      show(`Saved "${trimmed}" · ${foodEntries.length} ${foodEntries.length === 1 ? 'item' : 'items'}`);
      setNaming(false);
      setName('');
    } catch {
      show('Could not save that — try again');
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AppHeader
        title={formatDateLong(date)}
        right={
          foodEntries.length > 0 ? (
            <IconButton
              icon="content-save-outline"
              size={22}
              iconColor={theme.colors.primary}
              onPress={() => setNaming((v) => !v)}
              accessibilityLabel="Save this day's meals as a template"
              accessibilityRole="button"
            />
          ) : null
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface}
          />
        }
      >
        <View style={styles.tiles}>
          <StatTile label="Consumed" value={`${formatKcal(totals.calories)} kcal`} />
          <StatTile label="Burned" value={totals.burned > 0 ? `${formatKcal(totals.burned)} kcal` : '—'} />
        </View>

        {naming && foodEntries.length > 0 ? (
          <View style={[styles.namingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <Text style={[styles.namingTitle, { color: theme.colors.onSurface }]}>
              Save {foodEntries.length} {foodEntries.length === 1 ? 'item' : 'items'} ({formatKcal(totals.calories)} kcal) as a template
            </Text>
            <View style={styles.namingRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder='e.g. "Usual breakfast"'
                placeholderTextColor={theme.colors.onSurfaceVariant}
                mode="outlined"
                dense
                style={styles.namingInput}
                onSubmitEditing={() => void onSaveTemplate()}
                returnKeyType="done"
                accessibilityLabel="Template name"
              />
              <Pressable
                onPress={() => void onSaveTemplate()}
                disabled={saveTemplate.isPending}
                style={[styles.namingSave, { backgroundColor: theme.colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Save template"
              >
                <Text style={[styles.namingSaveText, { color: theme.colors.onPrimary }]}>
                  {saveTemplate.isPending ? '…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.list}>
          <EntryList
            entries={entries.data ?? []}
            onPressEntry={(entry) => navigation.navigate('EntryDetail', { entryId: entry.id })}
            emptyTitle="A quiet day"
            emptyMessage="Nothing was logged on this date."
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: 10, padding: 16 },
  list: { paddingHorizontal: 16 },
  namingCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  namingTitle: { fontSize: 13.5 },
  namingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  namingInput: { flex: 1, backgroundColor: 'transparent', fontSize: 14 },
  namingSave: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  namingSaveText: { fontSize: 14, fontWeight: '600' },
});
