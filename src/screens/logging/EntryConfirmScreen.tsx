import * as React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Card, IconButton, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeTabParams } from '../../navigation/types';
import type { EntryType, ParsedEntry } from '../../types';
import { useSaveEntries } from '../../hooks/queries';
import { useSession, useToasts } from '../../stores';
import { formatKcal, toNum } from '../../utils';
import { PrimaryButton } from '../../components/inputs';
import { AppHeader } from '../../components/ui';

type Props = NativeStackScreenProps<HomeTabParams, 'EntryConfirm'>;

type Draft = ParsedEntry & { key: string };

function newDraft(partial?: Partial<ParsedEntry>): Draft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'food',
    title: '',
    grams: null,
    calories: 0,
    carbs: null,
    protein: null,
    fat: null,
    caloriesBurned: null,
    note: '',
    ...partial,
  };
}

/** One editable card per parsed item — everything stays adjustable before saving. */
function ItemCard({ draft, onChange, onRemove, canRemove }: {
  draft: Draft;
  onChange: (next: Draft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const theme = useTheme();
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const isFood = draft.type === 'food';

  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <TextInput
            value={draft.title}
            onChangeText={(title) => set({ title })}
            placeholder="Item name"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            mode="flat"
            dense
            style={styles.titleInput}
            underlineStyle={{ height: 0 }}
          />
          {canRemove ? <IconButton icon="close" onPress={onRemove} size={20} /> : null}
        </View>

        <View style={styles.typeRow}>
          {(['food', 'exercise'] as EntryType[]).map((t) => (
            <ChipToggle
              key={t}
              selected={draft.type === t}
              label={t === 'food' ? 'Food' : 'Movement'}
              onPress={() =>
                set(
                  t === 'food'
                    ? { type: 'food', caloriesBurned: null }
                    : { type: 'exercise', grams: null, carbs: null, protein: null, fat: null, calories: 0 },
                )
              }
            />
          ))}
        </View>

        <View style={styles.numRow}>
          {isFood ? (
            <>
              <MiniField label="g" value={draft.grams} onChangeText={(v) => set({ grams: v })} />
              <MiniField label="kcal" value={draft.calories} onChangeText={(v) => set({ calories: v ?? 0 })} />
              <MiniField label="Carbs" value={draft.carbs} onChangeText={(v) => set({ carbs: v })} />
              <MiniField label="Protein" value={draft.protein} onChangeText={(v) => set({ protein: v })} />
              <MiniField label="Fat" value={draft.fat} onChangeText={(v) => set({ fat: v })} />
            </>
          ) : (
            <>
              <MiniField label="kcal burned" value={draft.caloriesBurned} onChangeText={(v) => set({ caloriesBurned: v })} wide />
            </>
          )}
        </View>

        <TextInput
          value={draft.note}
          onChangeText={(note) => set({ note })}
          placeholder="Note (optional)"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          mode="flat"
          dense
          multiline
          style={styles.noteInput}
          underlineStyle={{ height: 0 }}
        />
      </Card.Content>
    </Card>
  );
}

function ChipToggle({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Text
      onPress={onPress}
      style={[
        styles.chipToggle,
        {
          color: selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
          backgroundColor: selected ? theme.colors.primary : theme.colors.surfaceVariant,
        },
      ]}
    >
      {label}
    </Text>
  );
}

function MiniField({ label, value, onChangeText, wide }: {
  label: string;
  value: number | null | undefined;
  onChangeText: (v: number | null) => void;
  wide?: boolean;
}) {
  const theme = useTheme();
  const [text, setText] = React.useState(value != null ? String(Math.round(value * 10) / 10) : '');
  const syncFromProps = () => {
    setText(value != null ? String(Math.round(value * 10) / 10) : '');
  };
  // Re-sync when a re-analysis replaces values underneath us.
  React.useEffect(syncFromProps, [value]);

  return (
    <View style={[styles.miniField, wide && { flex: 2 }]}>
      <Text style={[styles.miniLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          const cleaned = t.replace(',', '.').replace(/[^0-9.]/g, '');
          setText(cleaned);
          onChangeText(toNum(cleaned) ?? null);
        }}
        keyboardType="decimal-pad"
        mode="outlined"
        dense
        style={styles.miniInput}
      />
    </View>
  );
}

export default function EntryConfirmScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const userId = useSession((s) => s.userId);
  const save = useSaveEntries();
  const { parsed, rawInput, photoUri } = route.params;

  const [drafts, setDrafts] = React.useState<Draft[]>(() =>
    parsed.length > 0 ? parsed.map((p) => ({ ...newDraft(), ...p, key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })) : [newDraft()],
  );

  const totalKcal = drafts.reduce((sum, d) => sum + (d.type === 'food' ? d.calories : 0), 0);
  const totalBurned = drafts.reduce((sum, d) => sum + (d.type === 'exercise' ? d.caloriesBurned ?? 0 : 0), 0);

  const saveAll = async () => {
    const items = drafts
      .filter((d) => d.title.trim().length > 0 || d.calories > 0 || (d.caloriesBurned ?? 0) > 0)
      .map((d) => ({
        type: d.type,
        rawInput,
        photoUrl: photoUri,
        title: d.title.trim() || 'Entry',
        grams: d.grams ?? undefined,
        calories: d.calories,
        carbs: d.carbs ?? undefined,
        protein: d.protein ?? undefined,
        fat: d.fat ?? undefined,
        caloriesBurned: d.caloriesBurned ?? undefined,
        note: d.note?.trim() || undefined,
        userIdHint: userId ?? undefined,
      }));
    if (items.length === 0) {
      show('Nothing to save yet');
      return;
    }
    try {
      await save.mutateAsync(items as never);
      show(items.length === 1 ? 'Entry saved' : `${items.length} entries saved`);
      navigation.popToTop();
    } catch {
      show('Could not save — try again');
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <AppHeader title="Confirm entries" />
        {photoUri ? (
          <Card mode="contained" style={styles.photoCard}>
            <Card.Cover source={{ uri: photoUri }} style={styles.photo} />
          </Card>
        ) : null}
        <Text style={[styles.summary, { color: theme.colors.onSurfaceVariant }]}>
          {formatKcal(totalKcal)} kcal{totalBurned > 0 ? ` · ${formatKcal(totalBurned)} burned` : ''} · adjust anything before saving
        </Text>

        <View style={styles.list}>
          {drafts.map((d, i) => (
            <ItemCard
              key={d.key}
              draft={d}
              canRemove={drafts.length > 1}
              onRemove={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
              onChange={(next) => setDrafts((ds) => ds.map((x, xi) => (xi === i ? next : x)))}
            />
          ))}
        </View>

        <View style={styles.addButtonWrap}>
          <Text
            onPress={() => setDrafts((ds) => [...ds, newDraft()])}
            style={[styles.addButton, { color: theme.colors.primary }]}
          >
            + Add another item
          </Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton onPress={() => void saveAll()} loading={save.isPending}>
            Save {drafts.length > 1 ? `all ${drafts.length}` : 'entry'}
          </PrimaryButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  photoCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16 },
  photo: { height: 140, borderRadius: 16 },
  summary: { fontSize: 13, paddingHorizontal: 16, paddingTop: 10 },
  list: { paddingHorizontal: 16, gap: 10, marginTop: 4 },
  card: { borderRadius: 16 },
  cardContent: { gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  titleInput: { flex: 1, backgroundColor: 'transparent', fontSize: 16, fontWeight: '600' },
  typeRow: { flexDirection: 'row', gap: 8 },
  chipToggle: {
    fontSize: 12.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  numRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  miniField: { flex: 1, minWidth: 64 },
  miniLabel: { fontSize: 11, marginBottom: 2 },
  miniInput: { fontSize: 14, backgroundColor: 'transparent' },
  noteInput: { backgroundColor: 'transparent', fontSize: 13.5 },
  addButtonWrap: { paddingHorizontal: 16, paddingVertical: 6 },
  addButton: { fontSize: 14.5, fontWeight: '600' },
  footer: { padding: 16 },
});
