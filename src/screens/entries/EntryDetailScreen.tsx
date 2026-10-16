import * as React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Dialog, Divider, Portal, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeTabParams } from '../../navigation/types';
import type { Entry } from '../../types';
import { useDeleteEntry, useUpdateEntry } from '../../hooks/queries';
import { api } from '../../api/client';
import { useToasts } from '../../stores';
import {
  draftFromEntry,
  patchChangesEntry,
  patchFromDraft,
  sanitizeNumberInput,
  type EntryDraft,
  type EntryPatch,
} from '../../services/entry-draft';
import { formatDateLong, localDayKey } from '../../utils';
import { AppHeader } from '../../components/ui';

type Props = NativeStackScreenProps<HomeTabParams, 'EntryDetail'>;

type Field = keyof EntryDraft;

/** How long typing may pause before the edit is written. */
const SAVE_AFTER_MS = 700;

export default function EntryDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const { entryId } = route.params;
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const savePatch = update.mutateAsync;

  const [entry, setEntry] = React.useState<Entry | null>(null);
  const [draft, setDraft] = React.useState<EntryDraft | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [reanalyzing, setReanalyzing] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // The refs mirror the state so the debounce timer, the blur handler and the
  // unmount flush all read what is on screen right now rather than a render
  // that has been superseded.
  const entryRef = React.useRef<Entry | null>(null);
  const draftRef = React.useRef<EntryDraft | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = React.useRef(false);
  const followUpRef = React.useRef(false);
  const focusedRef = React.useRef(false);

  const applyEntry = React.useCallback((next: Entry | null) => {
    entryRef.current = next;
    setEntry(next);
  }, []);

  const applyDraft = React.useCallback((next: EntryDraft | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const { entryRepo } = await import('../../db/repos');
      const found = await entryRepo.get(entryId);
      if (!alive) return;
      applyEntry(found);
      applyDraft(found ? draftFromEntry(found) : null);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [entryId, applyEntry, applyDraft]);

  // Leaving the screen with typing still inside the debounce window writes it
  // rather than dropping it. The screen is gone by then, so nothing is set on
  // it afterwards.
  React.useEffect(
    () => () => {
      if (!timerRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const current = draftRef.current;
      const stored = entryRef.current;
      if (!current || !stored) return;
      const patch = patchFromDraft(current, stored.type);
      if (patchChangesEntry(patch, stored)) void savePatch({ id: entryId, patch });
    },
    [entryId, savePatch],
  );

  /**
   * Writes one patch at a time. A change made while a write is in flight is
   * written straight after it, so the last thing typed is what is stored.
   * Returns false when the write failed.
   */
  const write = React.useCallback(
    async (patch: EntryPatch): Promise<boolean> => {
      clearTimer();
      if (busyRef.current) {
        followUpRef.current = true;
        return true;
      }
      busyRef.current = true;
      try {
        let next: EntryPatch | null = patch;
        let stored: Entry | null = null;
        while (next) {
          setSaveError(null);
          stored = await savePatch({ id: entryId, patch: next });
          if (stored) applyEntry(stored);
          if (followUpRef.current) {
            followUpRef.current = false;
            const latest = draftRef.current;
            next = latest && stored ? patchFromDraft(latest, stored.type) : null;
          } else {
            next = null;
            // Re-sync the field text with what was stored, unless it is being
            // edited right now.
            if (!focusedRef.current && stored && draftRef.current) applyDraft(draftFromEntry(stored));
          }
        }
        return true;
      } catch {
        setSaveError('Could not save that change.');
        return false;
      } finally {
        followUpRef.current = false;
        busyRef.current = false;
      }
    },
    [entryId, savePatch, clearTimer, applyEntry, applyDraft],
  );

  /** Write whatever the fields hold now, if it differs from the stored entry. */
  const commit = React.useCallback(() => {
    clearTimer();
    const current = draftRef.current;
    const stored = entryRef.current;
    if (!current || !stored) return;
    const patch = patchFromDraft(current, stored.type);
    if (!patchChangesEntry(patch, stored)) return;
    void write(patch);
  }, [write, clearTimer]);

  const edit = React.useCallback(
    (field: Field, value: string) => {
      const current = draftRef.current;
      if (!current) return;
      const text = field === 'title' || field === 'note' ? value : sanitizeNumberInput(value);
      const next = { ...current, [field]: text };
      applyDraft(next);
      setSaveError(null);
      clearTimer();
      timerRef.current = setTimeout(commit, SAVE_AFTER_MS);
    },
    [applyDraft, clearTimer, commit],
  );

  const fieldProps = {
    onFocus: () => {
      focusedRef.current = true;
    },
    onBlur: () => {
      focusedRef.current = false;
      commit();
    },
  };

  // Loading is its own state — the read is async, so rendering the missing
  // case straight away flashed "no longer exists" on every open.
  if (!entry || !draft) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: theme.colors.background }]}>
        {loaded ? (
          <>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>This entry no longer exists.</Text>
            <Button onPress={() => navigation.goBack()}>Go back</Button>
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const isFood = entry.type === 'food';

  // A Paper dialog rather than Alert.alert: react-native-web ships Alert as a
  // no-op, so the confirm step silently disappeared on web and the entry could
  // never be deleted there.
  const deleteEntry = () => {
    setConfirmingDelete(false);
    remove.mutate(entry.id, {
      onSuccess: () => {
        show('Entry deleted');
        navigation.goBack();
      },
      onError: () => show('Could not delete that — try again'),
    });
  };

  const reanalyze = async () => {
    setReanalyzing(true);
    try {
      let result;
      if (entry.photoUrl && entry.rawInput === '') {
        // Photo entry: re-run photo parse with the stored base64 not retained —
        // fall back to describing from the title.
        result = await api.parseText(entry.title);
      } else {
        result = await api.parseText(entry.rawInput || entry.title);
      }
      const match = result.entries.find((e) => e.type === entry.type) ?? result.entries[0];
      if (!match) return;
      const saved = await write({
        title: match.title,
        grams: match.grams ?? undefined,
        calories: match.calories,
        carbs: match.carbs ?? undefined,
        protein: match.protein ?? undefined,
        fat: match.fat ?? undefined,
        caloriesBurned: match.caloriesBurned ?? undefined,
        note: match.note,
      });
      show(saved ? 'Re-analyzed — numbers updated' : 'Could not re-analyze right now');
    } catch {
      show('Could not re-analyze right now');
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AppHeader title="Entry" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.date, { color: theme.colors.onSurfaceVariant }]}>{formatDateLong(localDayKey(entry.loggedAt))}</Text>

        <Card mode="contained" style={styles.card}>
          <Card.Content style={styles.gap}>
            <TextInput
              label="Title"
              mode="outlined"
              value={draft.title}
              onChangeText={(t) => edit('title', t)}
              style={styles.input}
              accessibilityLabel="Entry title"
              {...fieldProps}
            />
            <View style={styles.row}>
              {isFood ? (
                <>
                  <TextInput label="Grams" mode="outlined" keyboardType="decimal-pad" value={draft.grams} onChangeText={(t) => edit('grams', t)} style={styles.third} accessibilityLabel="Grams" {...fieldProps} />
                  <TextInput label="Carbs" mode="outlined" keyboardType="decimal-pad" value={draft.carbs} onChangeText={(t) => edit('carbs', t)} style={styles.third} accessibilityLabel="Carbs in grams" {...fieldProps} />
                  <TextInput label="Protein" mode="outlined" keyboardType="decimal-pad" value={draft.protein} onChangeText={(t) => edit('protein', t)} style={styles.third} accessibilityLabel="Protein in grams" {...fieldProps} />
                  <TextInput label="Fat" mode="outlined" keyboardType="decimal-pad" value={draft.fat} onChangeText={(t) => edit('fat', t)} style={styles.third} accessibilityLabel="Fat in grams" {...fieldProps} />
                </>
              ) : null}
              <TextInput
                label={isFood ? 'Calories' : 'Calories burned'}
                mode="outlined"
                keyboardType="decimal-pad"
                value={draft.calories}
                onChangeText={(t) => edit('calories', t)}
                style={styles.third}
                accessibilityLabel={isFood ? 'Calories' : 'Calories burned'}
                {...fieldProps}
              />
            </View>
            <TextInput
              label="Note"
              mode="outlined"
              value={draft.note}
              onChangeText={(t) => edit('note', t)}
              multiline
              style={styles.input}
              accessibilityLabel="Note, optional"
              {...fieldProps}
            />
            {entry.photoUrl ? (
              <Card.Cover source={{ uri: entry.photoUrl }} style={styles.photo} />
            ) : null}
          </Card.Content>
        </Card>

        {/* Only failure needs saying: an entry write is local and lands before
            a "Saving…" state could paint. */}
        {saveError ? (
          <View style={styles.errorRow}>
            <Text style={[styles.errorText, { color: theme.colors.error }]}>{saveError}</Text>
            <Button mode="text" compact onPress={commit} accessibilityLabel="Try saving the change again">
              Try again
            </Button>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button mode="text" icon="refresh" loading={reanalyzing} onPress={() => void reanalyze()}>
            Re-analyze
          </Button>
          <Divider />
          <Button mode="text" textColor={theme.colors.onSurfaceVariant} onPress={() => setConfirmingDelete(true)}>
            Delete entry
          </Button>
        </View>
      </ScrollView>

      <Portal>
        <Dialog visible={confirmingDelete} onDismiss={() => setConfirmingDelete(false)}>
          <Dialog.Title>Remove this entry?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {entry.title} will be deleted from your diary.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmingDelete(false)}>Keep it</Button>
            <Button textColor={theme.colors.error} onPress={deleteEntry} loading={remove.isPending}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  date: { fontSize: 13, paddingHorizontal: 16, paddingTop: 12 },
  card: { margin: 16, borderRadius: 16 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  third: { flex: 1, minWidth: 90 },
  input: { backgroundColor: 'transparent' },
  photo: { borderRadius: 12, marginTop: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20, marginBottom: 6 },
  errorText: { flex: 1, fontSize: 12.5 },
  actions: { gap: 10, paddingHorizontal: 16 },
});
