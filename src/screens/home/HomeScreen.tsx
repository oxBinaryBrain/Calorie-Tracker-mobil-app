import * as React from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, IconButton, TextInput, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImageManipulator from 'expo-image-manipulator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeTabParams } from '../../navigation/types';
import type { ParsedEntry } from '../../types';
import { api, usingMockApi } from '../../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../stores';
import type { MD3Theme } from 'react-native-paper';
import { useDayEntries, todayTotals, useTargets, useDayTracker, useUpsertTracker, useProfile, useEntriesRange, useSaveEntries, useMealTemplates, useSaveMealTemplate, useDeleteMealTemplate, weekRange } from '../../hooks/queries';
import { addDays, dateKey, formatKcal, formatMl, greeting } from '../../utils';
import { semantic, fontFamilies } from '../../theme';
import { waterGoalMl } from '../../services/targets';
import { searchFoods, suggestionKcalHint, type FoodSuggestion } from '../../services/foodDb';
import { tickLight } from '../../services/haptics';
import { templateFromEntries } from '../../db/meal-template-repo-types';
import type { MealTemplate } from '../../types';
import { CalorieRing, EntryList, MacroRingTile, EmptyState } from '../../components/ui';
import { useToasts } from '../../stores';

type Props = NativeStackScreenProps<HomeTabParams, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const today = dateKey();
  const entries = useDayEntries(today);
  const targets = useTargets();
  const profile = useProfile();
  const tracker = useDayTracker(today);
  const upsertTracker = useUpsertTracker();
  const saveEntries = useSaveEntries();
  const userId = useSession((s) => s.userId);
  const [input, setInput] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<FoodSuggestion[]>([]);
  const [parsing, setParsing] = React.useState(false);
  const [photoBusy, setPhotoBusy] = React.useState(false);
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

  // Week overview: calories per day for the strip, Monday-anchored.
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

  // One-line tracker summary; honest guidance when nothing is noted.
  const insightBits: string[] = [];
  const waterToday = tracker.data?.waterMl ?? 0;
  if (tracker.data?.sleepHours != null) insightBits.push(`${tracker.data.sleepHours} h of sleep`);
  if (tracker.data?.weightKg != null) insightBits.push(`${tracker.data.weightKg} kg`);
  if (waterToday > 0) insightBits.push(`${formatMl(waterToday)} of water`);

  const parseAndNavigate = React.useCallback(async (rawInput: string, photoBase64?: string, photoUri?: string) => {
    setParsing(true);
    try {
      const result = photoBase64 ? await api.parsePhoto(photoBase64) : await api.parseText(rawInput);
      const parsed: ParsedEntry[] = result.entries.map((e) => ({ ...e, type: e.type === 'exercise' ? 'exercise' : 'food' }));
      setInput('');
      setSuggestions([]);
      navigation.navigate('EntryConfirm', { parsed, rawInput, photoUri });
    } catch (e) {
      show(e instanceof Error ? e.message : 'Could not read that — try again');
    } finally {
      setParsing(false);
    }
  }, [navigation, show]);

  const submitText = React.useCallback(() => {
    const text = input.trim();
    if (!text || parsing) return;
    void parseAndNavigate(text);
  }, [input, parsing, parseAndNavigate]);

  const openPhotoFlow = React.useCallback(async () => {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        show('Camera permission is needed to photograph your plate');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false, exif: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!manipulated.base64) {
        show('Could not read that photo — try again');
        return;
      }
      await parseAndNavigate('', manipulated.base64, manipulated.uri);
    } catch (e) {
      show(e instanceof Error ? e.message : 'Camera is unavailable right now');
    } finally {
      setPhotoBusy(false);
    }
  }, [photoBusy, parseAndNavigate, show]);

  const goTab = (tab: 'TrackersTab' | 'SummaryTab' | 'DiaryTab' | 'AccountTab') => {
    (navigation as any).getParent()?.navigate(tab);
  };

  // Autocomplete: suggest foods for the word currently being typed.
  const handleInput = React.useCallback((text: string) => {
    setInput(text);
    const word = text.match(/([a-zA-Z]{2,})\s*$/)?.[1];
    setSuggestions(word ? searchFoods(word, 4) : []);
  }, []);

  const applySuggestion = React.useCallback((sug: FoodSuggestion) => {
    setInput((prev) => prev.replace(/([a-zA-Z]{2,})\s*$/, `${sug.key} `));
    setSuggestions([]);
  }, []);

  // Repeat last meal: yesterday's food entries, one tap to today. Offered
  // only when yesterday actually has meals and today has none yet — copying
  // onto an existing day would double-log.
  const yesterdayEntries = useDayEntries(addDays(today, -1));
  const yesterdayFood = React.useMemo(
    () => (yesterdayEntries.data ?? []).filter((e) => e.type === 'food'),
    [yesterdayEntries.data],
  );
  const todayHasFood = (entries.data ?? []).some((e) => e.type === 'food');
  const canRepeat = yesterdayFood.length > 0 && !todayHasFood;

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

  // Meal templates: saved entry sets, one tap to log. Edit mode toggles
  // deletion affordances instead of navigation.
  const templates = useMealTemplates();
  const saveTemplate = useSaveMealTemplate();
  const deleteTemplate = useDeleteMealTemplate();
  const [editingTemplates, setEditingTemplates] = React.useState(false);
  const [namingToday, setNamingToday] = React.useState(false);
  const [templateName, setTemplateName] = React.useState('');

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

  const todayFood = (entries.data ?? []).filter((e) => e.type === 'food');
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

  const firstName = (p?.displayName || '').split(' ')[0];

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
          {/* Header (scrolls with content; solid background) */}
          <View style={styles.header}>
            <Pressable style={[styles.avatar, { backgroundColor: theme.colors.primaryContainer }]} onPress={() => goTab('AccountTab')}>
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
            <View style={[styles.bellChip, { backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons name="bell-outline" size={20} color={theme.colors.onSurface} />
            </View>
          </View>

          {/* Ring row — numbers lead, compact progress ring trails */}
          <View style={[styles.ringRow, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.ringNumbers}>
              <Text style={styles.ringBig}>
                <Text style={{ color: theme.colors.onBackground }}>{formatKcal(totals.calories)}</Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}> / {formatKcal(targetKcal || totals.calories || 2100)}</Text>
              </Text>
              <Text style={[styles.ringCaption, { color: theme.colors.onSurfaceVariant }]}>Today calories</Text>
              {totals.burned > 0 ? (
                <Text style={[styles.ringBurned, { color: theme.colors.onSurfaceVariant }]}>
                  {formatKcal(totals.burned)} burned
                </Text>
              ) : null}
            </View>
            <CalorieRing
              size={86}
              consumed={totals.calories}
              target={targetKcal || 2100}
              burned={totals.burned}
              center={<MaterialCommunityIcons name="fire" size={24} color={theme.colors.onBackground} />}
            />
          </View>

          {/* Macro tiles — grams left, mini ring per macro */}
          {target ? (
            <View style={styles.glanceRow}>
              <MacroRingTile
                value={Math.max(0, Math.round(target.proteinGrams - totals.protein))}
                unit="g"
                progress={target.proteinGrams > 0 ? totals.protein / target.proteinGrams : 0}
                over={totals.protein > target.proteinGrams}
                label="Protein left"
                overLabel="Protein over"
                color="#8FB8E8"
                icon="food-drumstick-outline"
              />
              <MacroRingTile
                value={Math.max(0, Math.round(target.carbsGrams - totals.carbs))}
                unit="g"
                progress={target.carbsGrams > 0 ? totals.carbs / target.carbsGrams : 0}
                over={totals.carbs > target.carbsGrams}
                label="Carbs left"
                overLabel="Carbs over"
                color="#E8B96F"
                icon="barley"
              />
              <MacroRingTile
                value={Math.max(0, Math.round(target.fatGrams - totals.fat))}
                unit="g"
                progress={target.fatGrams > 0 ? totals.fat / target.fatGrams : 0}
                over={totals.fat > target.fatGrams}
                label="Fat left"
                overLabel="Fat over"
                color="#7FC98F"
                icon="food-apple-outline"
              />
            </View>
          ) : null}

          {/* Week strip — capsule-selected day, tap to open in the Diary */}
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
              targetKcal={targetKcal}
              theme={theme}
              onOpenDay={(date) =>
                (navigation as any).getParent()?.navigate('DiaryTab', { screen: 'DayDetail', params: { date } })
              }
            />
          </View>

          {/* Quick water — inline against the personalized goal */}
          <View style={styles.waterRow}>
            <Text style={[styles.waterLabel, { color: theme.colors.onSurfaceVariant }]}>Add water</Text>
            {[250, 500].map((ml) => (
              <Pressable
                key={ml}
                onPress={() => {
                  tickLight();
                  upsertTracker.mutate({ date: today, waterMl: Math.max(0, waterToday + ml) });
                }}
                style={[styles.waterChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                <MaterialCommunityIcons name="plus" size={14} color={theme.colors.primary} />
                <Text style={[styles.waterChipText, { color: theme.colors.onSurface }]}>{ml}</Text>
              </Pressable>
            ))}
            <Text numberOfLines={1} style={[styles.waterGoal, { color: theme.colors.onSurfaceVariant }]}>
              {formatMl(waterToday)} / {formatMl(waterGoalMl(p?.weightKg, p?.activityLevel))}
            </Text>
          </View>

          {/* Tracker insight line */}
          <Pressable
            style={[styles.insightRow, { backgroundColor: theme.colors.surface }]}
            onPress={() => goTab('TrackersTab')}
            android_ripple={{ color: theme.colors.surfaceVariant }}
          >
            <MaterialCommunityIcons name="clipboard-pulse-outline" size={20} color={theme.colors.primary} />
            <Text numberOfLines={1} style={[styles.insightText, { color: theme.colors.onSurfaceVariant }]}>
              {insightBits.length > 0 ? insightBits.join(' · ') : 'Water, weight and sleep live here.'}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.onSurfaceVariant} />
          </Pressable>

          {/* Today list */}
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

          {/* Save today's meals as a reusable template. */}
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

          {/* Again — one-tap re-logging: yesterday's meals and saved templates. */}
          {canRepeat || (templates.data?.length ?? 0) > 0 ? (
            <View style={styles.againWrap}>
              <View style={styles.againHeader}>
                <Text style={[styles.againTitle, { color: theme.colors.onSurfaceVariant }]}>Again</Text>
                {(templates.data?.length ?? 0) > 0 ? (
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
        </ScrollView>

        {/* Persistent input bar — translucent material; content scrolls beneath it */}
        <View style={styles.inputBarWrap}>
          <View style={styles.inputBarSlot}>
            {suggestions.length > 0 ? (
              <View style={[styles.suggestPanel, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                {suggestions.map((sug, i) => (
                  <Pressable
                    key={sug.key}
                    onPress={() => applySuggestion(sug)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${sug.name}, ${suggestionKcalHint(sug.info)}`}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      i < suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.outlineVariant },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <MaterialCommunityIcons name="food-outline" size={16} color={theme.colors.primary} />
                    <Text style={[styles.suggestName, { color: theme.colors.onSurface }]}>{sug.name}</Text>
                    <Text style={[styles.suggestHint, { color: theme.colors.onSurfaceVariant }]}>{suggestionKcalHint(sug.info)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={[styles.inputBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
            <TextInput
              value={input}
              onChangeText={handleInput}
              placeholder="Describe what you ate…"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              mode="flat"
              dense
              style={styles.input}
              underlineStyle={{ height: 0 }}
              onSubmitEditing={submitText}
              returnKeyType="done"
              blurOnSubmit
            />
            {parsing || photoBusy ? (
              <ActivityIndicator style={styles.inputAction} />
            ) : (
              <IconButton icon="" size={0} style={{ display: 'none' }} />
            )}
            <Pressable onPress={() => void openPhotoFlow()} style={styles.camBtn} hitSlop={8}>
              <MaterialCommunityIcons name="camera-outline" size={22} color={parsing || photoBusy ? theme.colors.outline : theme.colors.onSurfaceVariant} />
            </Pressable>
            <Pressable onPress={submitText} style={[styles.sendBtn, { backgroundColor: input.trim() ? theme.colors.primary : theme.colors.surfaceVariant }]} hitSlop={6}>
              <MaterialCommunityIcons name="arrow-up" size={20} color={input.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant} />
            </Pressable>
            </View>
          </View>
          <View
            style={[
              styles.blurBar,
              {
                borderTopColor: theme.colors.outlineVariant,
                ...(Platform.OS === 'web'
                  ? {
                      backgroundColor: theme.dark ? 'rgba(33, 35, 33, 0.88)' : 'rgba(255, 255, 255, 0.88)',
                      backdropFilter: 'blur(20px) saturate(180%)',
                    }
                  : { backgroundColor: theme.colors.background }),
              },
            ]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  bellChip: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 20, fontWeight: '700', fontFamily: fontFamilies.semibold },
  dateLine: { fontSize: 12.5, marginTop: 1, fontFamily: fontFamilies.regular },
  ringRow: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  ringNumbers: { flex: 1, gap: 2 },
  ringBig: { fontSize: 30, fontFamily: fontFamilies.semibold, letterSpacing: -0.5 },
  ringCaption: { fontSize: 13, fontFamily: fontFamilies.regular },
  ringBurned: { fontSize: 12.5, fontFamily: fontFamilies.regular, marginTop: 2 },
  glanceRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 12 },
  waterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  waterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  waterChipText: { fontSize: 12.5, fontWeight: '600', fontFamily: fontFamilies.semibold },
  section: { fontSize: 13, fontWeight: '600', paddingHorizontal: 16, marginTop: 16, marginBottom: 6, fontFamily: fontFamilies.semibold },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  weekTitle: { fontSize: 15, fontWeight: '600', fontFamily: fontFamilies.semibold },
  waterLabel: { fontSize: 12.5, marginRight: 2, fontFamily: fontFamilies.regular },
  weekMeta: { fontSize: 12, fontFamily: fontFamilies.regular },
  weekCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  weekStrip: { flexDirection: 'row', alignItems: 'center' },
  weekDayCol: { flex: 1, alignItems: 'center', gap: 3 },
  weekDayDow: { fontSize: 12, fontFamily: fontFamilies.regular },
  weekDayNum: { fontSize: 14.5, fontFamily: fontFamilies.semibold },
  waterGoal: { flex: 1, textAlign: 'right', fontSize: 12.5, fontFamily: fontFamilies.regular },
  weekDot: { width: 4, height: 4, borderRadius: 2 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  insightText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.regular },
  loading: { padding: 24 },
  list: { paddingHorizontal: 16 },
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
  inputBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  inputBarSlot: { margin: 12, marginBottom: 8, zIndex: 1, position: 'relative' },
  blurBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 6,
    overflow: 'hidden',
  },
  suggestPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    marginBottom: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  suggestName: { fontSize: 13.5, fontFamily: fontFamilies.medium },
  suggestHint: { fontSize: 12, marginLeft: 'auto', fontFamily: fontFamilies.regular },
  input: { flex: 1, backgroundColor: 'transparent', fontSize: 15 },
  inputAction: { marginHorizontal: 10 },
  camBtn: { padding: 8 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

/** Seven slim bars, one per day — tap one to open the day in the Diary. */
function WeekStrip({ days, targetKcal, theme, onOpenDay }: {
  days: Array<{ date: string; calories: number }>;
  targetKcal: number;
  theme: MD3Theme;
  onOpenDay: (date: string) => void;
}) {
  const today = dateKey();
  return (
    <View style={styles.weekStrip}>
      {days.map((d) => {
        const isToday = d.date === today;
        const dayNum = new Date(d.date).getDate();
        const dow = new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' });
        return (
          <Pressable
            key={d.date}
            onPress={() => onOpenDay(d.date)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${d.date} in Diary`}
            style={({ pressed }) => [
              styles.weekDayCol,
              isToday && { backgroundColor: theme.colors.background, borderRadius: 999, paddingVertical: 6 },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text style={[styles.weekDayDow, { color: isToday ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>{dow}</Text>
            <Text style={[styles.weekDayNum, { color: isToday ? theme.colors.onSurface : theme.colors.onSurfaceVariant }]}>
              {dayNum < 10 ? `0${dayNum}` : dayNum}
            </Text>
          </Pressable>
       );
      })}
    </View>
  );
}
