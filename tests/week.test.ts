import { describe, expect, it, vi } from 'vitest';
import { todayTotals, weekRange } from '../src/hooks/queries';
import { addDays } from '../src/utils';
import type { Entry } from '../src/types';

vi.mock('../src/db/repos', () => ({
  entryRepo: {},
  mealTemplateRepo: {},
  profileRepo: {},
  targetRepo: {},
  trackerRepo: {},
}));

vi.mock('../src/api/client', () => ({
  api: {},
  usingMockApi: true,
}));

const entry = (over: Partial<Entry> & Pick<Entry, 'type' | 'loggedAt'>): Entry => ({
  id: Math.random().toString(36).slice(2),
  rawInput: '',
  title: 'x',
  calories: 0,
  ...over,
});

describe('weekRange', () => {
  it('anchors the week on Monday for a mid-week date', () => {
    // Wed 2026-09-16 → Mon 2026-09-14 .. Sun 2026-09-20
    const w = weekRange(new Date(2026, 8, 16, 12));
    expect(w.from).toBe('2026-09-14');
    expect(w.to).toBe('2026-09-20');
    expect(w.days).toHaveLength(7);
  });

  it('starts on Monday when the anchor is a Monday', () => {
    const w = weekRange(new Date(2026, 8, 21, 12));
    expect(w.from).toBe('2026-09-21');
    expect(w.days[0]).toBe('2026-09-21');
  });

  it('puts a Sunday in the week that started six days earlier', () => {
    const w = weekRange(new Date(2026, 8, 20, 12));
    expect(w.from).toBe('2026-09-14');
    expect(w.to).toBe('2026-09-20');
  });

  it('produces seven contiguous days, crossing year end', () => {
    // Thu 2026-12-31 → Mon 2026-12-28 .. Sun 2027-01-03
    const w = weekRange(new Date(2026, 11, 31, 12));
    expect(w.from).toBe('2026-12-28');
    expect(w.to).toBe('2027-01-03');
    for (let i = 1; i < 7; i++) {
      expect(w.days[i]).toBe(addDays(w.days[i - 1], 1));
    }
  });
});

describe('todayTotals', () => {
  it('returns zeros for undefined or empty input', () => {
    expect(todayTotals(undefined)).toEqual({ calories: 0, carbs: 0, protein: 0, fat: 0, burned: 0 });
    expect(todayTotals([])).toEqual({ calories: 0, carbs: 0, protein: 0, fat: 0, burned: 0 });
  });

  it('sums food into intake macros', () => {
    const totals = todayTotals([
      entry({ type: 'food', loggedAt: '2026-09-22T08:00:00.000Z', calories: 300, carbs: 40, protein: 20, fat: 9 }),
      entry({ type: 'food', loggedAt: '2026-09-22T12:00:00.000Z', calories: 500, carbs: 60, protein: 30, fat: 15 }),
    ]);
    expect(totals).toEqual({ calories: 800, carbs: 100, protein: 50, fat: 24, burned: 0 });
  });

  it('counts exercise only as burned, never as eaten calories', () => {
    const totals = todayTotals([
      entry({ type: 'food', loggedAt: '2026-09-22T08:00:00.000Z', calories: 300 }),
      entry({ type: 'exercise', loggedAt: '2026-09-22T18:00:00.000Z', calories: 200, caloriesBurned: 250 }),
    ]);
    expect(totals.calories).toBe(300);
    expect(totals.burned).toBe(250);
  });

  it('treats missing macros as zero', () => {
    const totals = todayTotals([entry({ type: 'food', loggedAt: '2026-09-22T08:00:00.000Z', calories: 100 })]);
    expect(totals.carbs).toBe(0);
    expect(totals.protein).toBe(0);
    expect(totals.fat).toBe(0);
    expect(totals.burned).toBe(0);
  });
});
