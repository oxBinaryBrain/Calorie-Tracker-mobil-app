import * as React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Divider, TextInput, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeTabParams } from '../../navigation/types';
import { useDeleteEntry, useUpdateEntry } from '../../hooks/queries';
import { api } from '../../api/client';
import { useToasts } from '../../stores';
import { formatKcal, formatDateLong, dateFromKey } from '../../utils';
import { AppHeader } from '../../components/ui';

type Props = NativeStackScreenProps<HomeTabParams, 'EntryDetail'>;

export default function EntryDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const show = useToasts((s) => s.show);
  const { entryId } = route.params;
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const [entry, setEntry] = React.useState<Awaited<ReturnType<typeof import('../../db/repos').entryRepo.get>> | null>(null);
  const [reanalyzing, setReanalyzing] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const { entryRepo } = await import('../../db/repos');
      const found = await entryRepo.get(entryId);
      if (alive) setEntry(found);
    })();
    return () => {
      alive = false;
    };
  }, [entryId]);

  if (!entry) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>This entry no longer exists.</Text>
        <Button onPress={() => navigation.goBack()}>Go back</Button>
      </View>
    );
  }

  const isFood = entry.type === 'food';
  const patch = (p: Partial<typeof entry>) => {
    setEntry({ ...entry, ...p });
    update.mutate({ id: entry.id, patch: p });
  };

  const confirmDelete = () => {
    Alert.alert('Remove this entry?', 'It will be deleted from your diary.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          remove.mutate(entry.id, {
            onSuccess: () => {
              show('Entry deleted');
              navigation.goBack();
            },
          });
        },
      },
    ]);
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
      if (match) {
        patch({
          title: match.title,
          grams: match.grams ?? undefined,
          calories: match.calories,
          carbs: match.carbs ?? undefined,
          protein: match.protein ?? undefined,
          fat: match.fat ?? undefined,
          caloriesBurned: match.caloriesBurned ?? undefined,
          note: match.note,
        });
        show('Re-analyzed — numbers updated');
      }
    } catch {
      show('Could not re-analyze right now');
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <AppHeader title="Entry" />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={styles.date}>{formatDateLong(entry.loggedAt.slice(0, 10))}</Text>

      <Card mode="contained" style={styles.card}>
        <Card.Content style={styles.gap}>
          <TextInput
            label="Title"
            mode="outlined"
            value={entry.title}
            onChangeText={(title) => patch({ title })}
            style={styles.input}
          />
          <View style={styles.row}>
            {isFood ? (
              <>
                <TextInput label="Grams" mode="outlined" keyboardType="decimal-pad" value={entry.grams != null ? String(entry.grams) : ''} onChangeText={(t) => patch({ grams: t === '' ? undefined : Number(t) })} style={styles.third} />
                <TextInput label="Carbs" mode="outlined" keyboardType="decimal-pad" value={entry.carbs != null ? String(entry.carbs) : ''} onChangeText={(t) => patch({ carbs: t === '' ? undefined : Number(t) })} style={styles.third} />
                <TextInput label="Protein" mode="outlined" keyboardType="decimal-pad" value={entry.protein != null ? String(entry.protein) : ''} onChangeText={(t) => patch({ protein: t === '' ? undefined : Number(t) })} style={styles.third} />
                <TextInput label="Fat" mode="outlined" keyboardType="decimal-pad" value={entry.fat != null ? String(entry.fat) : ''} onChangeText={(t) => patch({ fat: t === '' ? undefined : Number(t) })} style={styles.third} />
              </>
            ) : null}
            <TextInput
              label={isFood ? 'Calories' : 'Calories burned'}
              mode="outlined"
              keyboardType="decimal-pad"
              value={String(isFood ? entry.calories : entry.caloriesBurned ?? 0)}
              onChangeText={(t) => (isFood ? patch({ calories: Number(t) || 0 }) : patch({ caloriesBurned: Number(t) || 0 }))}
              style={styles.third}
            />
          </View>
          <TextInput
            label="Note"
            mode="outlined"
            value={entry.note ?? ''}
            onChangeText={(note) => patch({ note })}
            multiline
            style={styles.input}
          />
          {entry.photoUrl ? (
            <Card.Cover source={{ uri: entry.photoUrl }} style={styles.photo} />
          ) : null}
        </Card.Content>
      </Card>

      <View style={styles.gap}>
        <Button mode="text" icon="refresh" loading={reanalyzing} onPress={() => void reanalyze()}>
          Re-analyze
        </Button>
        <Divider />
        <Button mode="text" textColor={theme.colors.onSurfaceVariant} onPress={confirmDelete}>
          Delete entry
        </Button>
      </View>
      </ScrollView>
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
});
