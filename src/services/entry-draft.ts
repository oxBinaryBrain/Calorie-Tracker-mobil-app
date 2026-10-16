import type { Entry, EntryType } from '../types';

/**
 * Editable text state for one entry. Every field is a string: the screen shows
 * exactly what was typed (including a half-typed "1."), and the numbers are
 * parsed once, at save time, instead of on every keystroke.
 */
export type EntryDraft = {
  title: string;
  grams: string;
  carbs: string;
  protein: string;
  fat: string;
  calories: string;
  note: string;
};

/** The editable part of an entry. */
export type EntryPatch = Partial<Omit<Entry, 'id' | 'loggedAt'>>;

export function draftFromEntry(
  entry: Pick<Entry, 'type' | 'title' | 'grams' | 'carbs' | 'protein' | 'fat' | 'calories' | 'caloriesBurned' | 'note'>,
): EntryDraft {
  const num = (value: number | undefined) => (value != null ? String(value) : '');
  return {
    title: entry.title,
    grams: num(entry.grams),
    carbs: num(entry.carbs),
    protein: num(entry.protein),
    fat: num(entry.fat),
    // One field serves both: calories for food, calories burned for movement.
    calories: String(entry.type === 'food' ? entry.calories : entry.caloriesBurned ?? 0),
    note: entry.note ?? '',
  };
}

/** Keystroke filter for the numeric fields: digits and at most one point. */
export function sanitizeNumberInput(text: string): string {
  const cleaned = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
}

function toNumber(text: string): number | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * What to store for a draft. A cleared numeric field clears the value instead
 * of writing NaN, a blank note clears the note, and a food entry keeps a
 * calorie count even when the field is emptied.
 */
export function patchFromDraft(draft: EntryDraft, type: EntryType): EntryPatch {
  const note = draft.note.trim();
  const base: EntryPatch = {
    title: draft.title.trim(),
    note: note === '' ? undefined : note,
  };
  if (type !== 'food') {
    return { ...base, caloriesBurned: toNumber(draft.calories) ?? 0 };
  }
  return {
    ...base,
    grams: toNumber(draft.grams),
    carbs: toNumber(draft.carbs),
    protein: toNumber(draft.protein),
    fat: toNumber(draft.fat),
    calories: toNumber(draft.calories) ?? 0,
  };
}

/** True when a patch would actually change something that is stored. */
export function patchChangesEntry(patch: EntryPatch, entry: Entry): boolean {
  return (Object.keys(patch) as Array<keyof EntryPatch>).some((key) => entry[key] !== patch[key]);
}
