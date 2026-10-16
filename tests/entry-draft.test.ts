import { describe, expect, it } from 'vitest';
import {
  draftFromEntry,
  patchChangesEntry,
  patchFromDraft,
  sanitizeNumberInput,
} from '../src/services/entry-draft';
import type { Entry } from '../src/types';

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 'e1',
  type: 'food',
  rawInput: 'an egg',
  title: 'Egg',
  calories: 78,
  loggedAt: '2026-10-17T08:00:00.000Z',
  ...over,
});

describe('draftFromEntry', () => {
  it('turns a food entry into text fields', () => {
    const draft = draftFromEntry(entry({ grams: 100, carbs: 1, protein: 13, fat: 11, note: 'Large eggs' }));
    expect(draft).toEqual({
      title: 'Egg',
      grams: '100',
      carbs: '1',
      protein: '13',
      fat: '11',
      calories: '78',
      note: 'Large eggs',
    });
  });

  it('leaves missing numbers and notes blank', () => {
    const draft = draftFromEntry(entry({ grams: undefined, carbs: undefined, protein: undefined, fat: undefined, note: undefined }));
    expect(draft.grams).toBe('');
    expect(draft.carbs).toBe('');
    expect(draft.note).toBe('');
  });

  it('shows burned calories for a movement entry', () => {
    const draft = draftFromEntry(entry({ type: 'exercise', calories: 0, caloriesBurned: 320 }));
    expect(draft.calories).toBe('320');
  });
});

describe('sanitizeNumberInput', () => {
  it('keeps digits and a single decimal point', () => {
    expect(sanitizeNumberInput('120')).toBe('120');
    expect(sanitizeNumberInput('12.5')).toBe('12.5');
    expect(sanitizeNumberInput('12,5')).toBe('12.5');
  });

  it('drops letters, stray separators and extra points', () => {
    expect(sanitizeNumberInput('12a')).toBe('12');
    expect(sanitizeNumberInput('1.2.3')).toBe('1.23');
    expect(sanitizeNumberInput('..')).toBe('.');
    expect(sanitizeNumberInput('kg 70')).toBe('70');
  });

  it('allows a half-typed number', () => {
    expect(sanitizeNumberInput('')).toBe('');
    expect(sanitizeNumberInput('.')).toBe('.');
  });
});

describe('patchFromDraft', () => {
  const draft = (over = {}) => ({
    title: 'Egg',
    grams: '100',
    carbs: '1',
    protein: '13',
    fat: '11',
    calories: '78',
    note: 'Large eggs',
    ...over,
  });

  it('parses the string fields into numbers', () => {
    expect(patchFromDraft(draft(), 'food')).toEqual({
      title: 'Egg',
      grams: 100,
      carbs: 1,
      protein: 13,
      fat: 11,
      calories: 78,
      note: 'Large eggs',
    });
  });

  it('clears a field that was emptied instead of writing NaN', () => {
    const patch = patchFromDraft(draft({ grams: '', fat: '', note: '  ' }), 'food');
    expect(patch.grams).toBeUndefined();
    expect(patch.fat).toBeUndefined();
    expect(patch.note).toBeUndefined();
    expect(Number.isNaN(patch.grams as number)).toBe(false);
  });

  it('keeps a calorie count for a half-typed or cleared field', () => {
    expect(patchFromDraft(draft({ calories: '' }), 'food').calories).toBe(0);
    expect(patchFromDraft(draft({ calories: '12.' }), 'food').calories).toBe(12);
  });

  it('writes burned calories for movement and no macro fields', () => {
    const patch = patchFromDraft(draft({ calories: '320' }), 'exercise');
    expect(patch.caloriesBurned).toBe(320);
    expect(patch.grams).toBeUndefined();
    expect(patch.carbs).toBeUndefined();
  });

  it('trims typed whitespace', () => {
    const patch = patchFromDraft(draft({ title: '  Two eggs  ', note: ' hot ' }), 'food');
    expect(patch.title).toBe('Two eggs');
    expect(patch.note).toBe('hot');
  });
});

describe('patchChangesEntry', () => {
  it('is false when nothing about the stored entry would change', () => {
    const stored = entry({ grams: 100, note: 'Large eggs' });
    const patch = patchFromDraft(draftFromEntry(stored), stored.type);
    expect(patchChangesEntry(patch, stored)).toBe(false);
  });

  it('is true for a real edit', () => {
    const stored = entry({ grams: 100 });
    const patch = patchFromDraft(draftFromEntry(stored), stored.type);
    expect(patchChangesEntry({ ...patch, title: 'Two eggs' }, stored)).toBe(true);
  });

  it('sees a cleared value as a change', () => {
    const stored = entry({ grams: 100 });
    expect(patchChangesEntry({ grams: undefined }, stored)).toBe(true);
  });
});
