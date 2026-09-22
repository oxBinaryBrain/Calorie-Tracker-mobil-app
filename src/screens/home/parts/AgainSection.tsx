import * as React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { addDays, dateKey, formatKcal } from '../../../utils';
import { fontFamilies } from '../../../theme';
import { useDayEntries, useDeleteMealTemplate, useMealTemplates, useSaveEntries, useSaveMealTemplate } from '../../../hooks/queries';
import { useSession, useToasts } from '../../../stores';
import { templateFromEntries } from '../../../db/meal-template-repo-types';
import type { Entry, MealTemplate } from '../../../types';

/**
 * "Again" — one-tap re-logging: yesterday's meals and saved templates,
 * plus saving today's meals as a new template.
 */
export function AgainSection({ todayFood }: { todayFood: Entry[] }) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const userId = useSession((s) => s.userId);
  const today = dateKey();

  const saveEntries = useSaveEntries();
  const yesterdayEntries = useDayEntries(addDays(today, -1));
  const yesterdayFood = React.useMemo(
    () => (yesterdayEntries.data ?? []).filter((e) => e.type === 'food'),
    [yesterdayEntries.data],
  );
  const todayHasFood = todayFood.length > 0;
  const canRepeat = yesterdayFood.length > 0 && !todayHasFood;

  const templates = useMealTemplates();
  const saveTemplate = useSaveMealTemplate();
  const deleteTemplate = useDeleteMealTemplate();
  const [editingTemplates, setEditingTemplates] = React.useState(false);
  const [namingToday, setNamingToday] = React.useState(false);
  const [templateName, setTemplateName] = React.useState('');

  const repeatLastMeal = React.useCallback(async () => {
    if (saveEntries.isPending || yesterdayFood.length === 0) return;
    try {
      await saveEntries.mutateAsync(
        yesterdayFood.map((e) => ({
          type: e.type,
          rawInput: e.rawInput,
          photoUrl: undefined, // yesterday's local photo uri may be gone; skip
          title: e.title,
          grams: e.grams,
          calories: e.calories,
          carbs: e.carbs,
          protein: e.protein,
          fat: e.fat,
          caloriesBurned: e.caloriesBurned,
          note: e.note,
          userIdHint: userId ?? undefined,
        })) as never,
      );
      show(
        yesterdayFood.length === 1
          ? 'Yesterday\u2019s meal added to today'
          : `${yesterdayFood.length} items added to today`,
      );
    } catch {
      show('Could not copy yesterday \u2014 try again');
    }
  }, [saveEntries, yesterdayFood, show, userId]);

  const applyTemplate = React.useCallback(async (tpl: MealTemplate) => {
    if (saveEntries.isPending || tpl.items.length === 0) return;
    try {
      await saveEntries.mutateAsync(
        tpl.items.map((item) => ({
          ...item,
          rawInput: '',
          title: item.title.trim() || 'Entry',
          userIdHint: userId ?? undefined,
        })) as never,
      );
      show(`\u201C${tpl.name}\u201D added to today`);
    } catch {
      show('Could not add that \u2014 try again');
    }
  }, [saveEntries, show, userId]);

  const todayFoodKcal = todayFood.reduce((sum, e) => sum + e.calories, 0);

  const saveTodayTemplate = React.useCallback(async () => {
    const trimmed = templateName.trim();
    if (!trimmed) {
      show('Give the template a name first');
      return;
    }
    if (todayFood.length === 0 || saveTemplate.isPending) return;
    try {
      await saveTemplate.mutateAsync(
        templateFromEntries(
          trimmed,
          todayFood.map((e) => ({
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
      show(`Saved \u201C${trimmed}\u201D`);
      setNamingToday(false);
      setTemplateName('');
    } catch {
      show('Could not save that \u2014 try again');
    }
  }, [templateName, todayFood, saveTemplate, show]);

  const hasTemplates = (templates.data?.length ?? 0) > 0;
  const nothingToShow = todayFood.length === 0 && !canRepeat && !hasTemplates && !namingToday;
  if (nothingToShow) return null;

  return (
    <View>
      {todayFood.length > 0 && !namingToday ? (
        <Pressable
          onPress={() => setNamingToday(true)}
          style={styles.saveTplRow}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Save today's meals as a template"
        >
          <MaterialCommunityIcons name="plus" size={15} color={theme.colors.primary} />
          <Text style={[styles.saveTplText, { color: theme.colors.primary }]}>Save today as a template</Text>
        </Pressable>
      ) : null}
      {namingToday && todayFood.length > 0 ? (
        <View style={[styles.namingCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.namingTitle, { color: theme.colors.onSurface }]}>
            Save {todayFood.length} {todayFood.length === 1 ? 'item' : 'items'} ({formatKcal(todayFoodKcal)} kcal) as a template
          </Text>
          <View style={styles.namingRow}>
            <TextInput
              value={templateName}
              onChangeText={setTemplateName}
              placeholder='e.g. "Usual breakfast"'
              placeholderTextColor={theme.colors.onSurfaceVariant}
              mode="outlined"
              dense
              style={styles.namingInput}
              onSubmitEditing={() => void saveTodayTemplate()}
              returnKeyType="done"
              accessibilityLabel="Template name"
            />
            <Pressable
              onPress={() => void saveTodayTemplate()}
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

      {canRepeat || hasTemplates ? (
        <View style={styles.againWrap}>
          <View style={styles.againHeader}>
            <Text style={[styles.againTitle, { color: theme.colors.onSurfaceVariant }]}>Again</Text>
            {hasTemplates ? (
              <Pressable
                onPress={() => setEditingTemplates((v) => !v)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={editingTemplates ? 'Done editing templates' : 'Edit templates'}
              >
                <Text style={[styles.againEdit, { color: theme.colors.primary }]}>{editingTemplates ? 'Done' : 'Edit'}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={[styles.againCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            {canRepeat ? (
              <Pressable
                onPress={() => (editingTemplates ? undefined : void repeatLastMeal())}
                disabled={saveEntries.isPending || editingTemplates}
                accessibilityRole="button"
                accessibilityLabel="Copy yesterday's meals to today"
                android_ripple={{ color: theme.colors.surfaceVariant }}
                style={({ pressed }) => [
                  styles.againRow,
                  pressed && !editingTemplates && { opacity: 0.6 },
                ]}
              >
                {saveEntries.isPending ? (
                  <ActivityIndicator size={16} color={theme.colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="history" size={19} color={theme.colors.primary} />
                )}
                <View style={styles.againTextWrap}>
                  <Text style={[styles.againRowTitle, { color: theme.colors.onSurface }]}>Yesterday's meals</Text>
                  <Text style={[styles.againRowDetail, { color: theme.colors.onSurfaceVariant }]}>
                    {yesterdayFood.length} {yesterdayFood.length === 1 ? 'item' : 'items'} · {formatKcal(yesterdayFood.reduce((s, e) => s + e.calories, 0))} kcal
                  </Text>
                </View>
                <Text style={[styles.againChevron, { color: theme.colors.onSurfaceVariant }]}>›</Text>
              </Pressable>
            ) : null}
            {(templates.data ?? []).map((tpl, i) => {
              const tplKcal = tpl.items.reduce((s, it) => s + (it.type === 'food' ? it.calories : 0), 0);
              return (
                <Pressable
                  key={tpl.id}
                  onPress={() => (editingTemplates ? undefined : void applyTemplate(tpl))}
                  disabled={editingTemplates}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${tpl.name} to today`}
                  android_ripple={{ color: theme.colors.surfaceVariant }}
                  style={({ pressed }) => [
                    styles.againRow,
                    (i > 0 || canRepeat) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.outlineVariant },
                    pressed && !editingTemplates && { opacity: 0.6 },
                  ]}
                >
                  <MaterialCommunityIcons name="food-outline" size={19} color={theme.colors.primary} />
                  <View style={styles.againTextWrap}>
                    <Text numberOfLines={1} style={[styles.againRowTitle, { color: theme.colors.onSurface }]}>{tpl.name}</Text>
                    <Text style={[styles.againRowDetail, { color: theme.colors.onSurfaceVariant }]}>
                      {tpl.items.length} {tpl.items.length === 1 ? 'item' : 'items'}
                      {tplKcal > 0 ? ` · ${formatKcal(tplKcal)} kcal` : ''}
                    </Text>
                  </View>
                  {editingTemplates ? (
                    <IconButton
                      icon="close"
                      size={18}
                      iconColor={theme.colors.onSurfaceVariant}
                      onPress={() => deleteTemplate.mutate(tpl.id)}
                      accessibilityLabel={`Delete template ${tpl.name}`}
                    />
                  ) : (
                    <Text style={[styles.againChevron, { color: theme.colors.onSurfaceVariant }]}>›</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  againWrap: { paddingHorizontal: 16, marginTop: 12 },
  againHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 },
  againTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, fontFamily: fontFamilies.semibold },
  againEdit: { fontSize: 13, fontFamily: fontFamilies.medium },
  againCard: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  againRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  againTextWrap: { flex: 1, gap: 1 },
  againRowTitle: { fontSize: 14.5, fontFamily: fontFamilies.medium },
  againRowDetail: { fontSize: 12.5, fontFamily: fontFamilies.regular },
  againChevron: { fontSize: 20 },
  saveTplRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, marginTop: 8 },
  saveTplText: { fontSize: 13, fontFamily: fontFamilies.medium },
  namingCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  namingTitle: { fontSize: 13.5 },
  namingRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  namingInput: { flex: 1, backgroundColor: 'transparent', fontSize: 14 },
  namingSave: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  namingSaveText: { fontSize: 14, fontWeight: '600' },
});
