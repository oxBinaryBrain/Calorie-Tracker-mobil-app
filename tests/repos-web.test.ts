import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  },
}));

import {
  AsyncStorageEntryRepo,
  AsyncStorageMealTemplateRepo,
  AsyncStorageProfileRepo,
  AsyncStorageTargetRepo,
  AsyncStorageTrackerRepo,
} from '../src/db/repos-web';
import { templateFromEntries } from '../src/db/meal-template-repo-types';
import type { Entry, MealTemplate } from '../src/types';

beforeEach(() => store.clear());

const food = (over: Partial<Omit<Entry, 'id' | 'loggedAt'>> & { loggedAt?: string } = {}) => ({
  type: 'food' as const,
  rawInput: 'an egg',
  title: 'Egg',
  calories: 78,
  ...over,
});

describe('AsyncStorageEntryRepo', () => {
  it('creates with generated id and timestamp, then reads it back', async () => {
    const repo = new AsyncStorageEntryRepo();
    const created = await repo.create(food());
    expect(created.id).toBeTruthy();
    expect(created.loggedAt).toBeTruthy();
    expect(await repo.get(created.id)).toEqual(created);
  });

  it('filters listByDate on the loggedAt date and sorts ascending', async () => {
    const repo = new AsyncStorageEntryRepo();
    await repo.create(food({ title: 'B', loggedAt: '2026-09-22T12:00:00.000Z' }));
    await repo.create(food({ title: 'A', loggedAt: '2026-09-22T08:00:00.000Z' }));
    await repo.create(food({ title: 'Other day', loggedAt: '2026-09-21T08:00:00.000Z' }));

    const day = await repo.listByDate('2026-09-22');
    expect(day.map((e) => e.title)).toEqual(['A', 'B']);
    expect(await repo.listByDate('2026-09-23')).toEqual([]);
  });

  it('listBetween includes both bounds', async () => {
    const repo = new AsyncStorageEntryRepo();
    await repo.create(food({ title: 'before', loggedAt: '2026-09-19T00:00:00.000Z' }));
    await repo.create(food({ title: 'from', loggedAt: '2026-09-20T00:00:00.000Z' }));
    await repo.create(food({ title: 'to', loggedAt: '2026-09-22T23:59:59.000Z' }));
    await repo.create(food({ title: 'after', loggedAt: '2026-09-23T00:00:00.000Z' }));

    const range = await repo.listBetween('2026-09-20', '2026-09-22');
    expect(range.map((e) => e.title)).toEqual(['from', 'to']);
  });

  it('patches an existing entry and returns null for a missing id', async () => {
    const repo = new AsyncStorageEntryRepo();
    const created = await repo.create(food());
    const updated = await repo.update(created.id, { title: 'Two eggs', calories: 155 });
    expect(updated).toMatchObject({ title: 'Two eggs', calories: 155 });
    expect((await repo.get(created.id))?.title).toBe('Two eggs');
    expect(await repo.update('missing', { title: 'x' })).toBeNull();
  });

  it('removes one or many entries', async () => {
    const repo = new AsyncStorageEntryRepo();
    const a = await repo.create(food({ title: 'a' }));
    const b = await repo.create(food({ title: 'b' }));
    const c = await repo.create(food({ title: 'c' }));

    await repo.remove(b.id);
    expect(await repo.get(b.id)).toBeNull();

    await repo.removeMany([a.id, c.id]);
    expect(await repo.listByDate(dateOf(a.loggedAt))).toEqual([]);
  });

  const dateOf = (iso: string) => iso.slice(0, 10);
});

describe('AsyncStorageTrackerRepo', () => {
  it('defaults a missing day to zero water', async () => {
    const repo = new AsyncStorageTrackerRepo();
    expect(await repo.get('2026-09-22')).toEqual({ date: '2026-09-22', waterMl: 0 });
  });

  it('upserts without duplicating a day', async () => {
    const repo = new AsyncStorageTrackerRepo();
    await repo.upsert({ date: '2026-09-22', waterMl: 500 });
    await repo.upsert({ date: '2026-09-22', waterMl: 750, weightKg: 70.2 });

    expect(await repo.get('2026-09-22')).toEqual({ date: '2026-09-22', waterMl: 750, weightKg: 70.2 });
    expect(await repo.getRange('2026-09-22', '2026-09-22')).toHaveLength(1);
  });

  it('merges a water-only upsert instead of wiping weight and sleep', async () => {
    const repo = new AsyncStorageTrackerRepo();
    await repo.upsert({ date: '2026-09-22', waterMl: 500, weightKg: 70.2, sleepHours: 7.5, sleepQuality: 'good' });
    await repo.upsert({ date: '2026-09-22', waterMl: 750 });

    expect(await repo.get('2026-09-22')).toEqual({
      date: '2026-09-22',
      waterMl: 750,
      weightKg: 70.2,
      sleepHours: 7.5,
      sleepQuality: 'good',
    });
  });

  it('getRange filters and sorts by date', async () => {
    const repo = new AsyncStorageTrackerRepo();
    await repo.upsert({ date: '2026-09-23', waterMl: 100 });
    await repo.upsert({ date: '2026-09-21', waterMl: 200 });
    await repo.upsert({ date: '2026-09-22', waterMl: 300 });

    const range = await repo.getRange('2026-09-21', '2026-09-22');
    expect(range.map((t) => t.date)).toEqual(['2026-09-21', '2026-09-22']);
  });
});

describe('AsyncStorageTargetRepo', () => {
  it('starts null and round-trips a target set', async () => {
    const repo = new AsyncStorageTargetRepo();
    expect(await repo.get()).toBeNull();

    const targets = { dailyCalories: 2106, carbsGrams: 236, proteinGrams: 126, fatGrams: 70 };
    await repo.set(targets);
    expect(await repo.get()).toEqual(targets);
  });
});

describe('AsyncStorageProfileRepo', () => {
  it('starts null and round-trips a profile', async () => {
    const repo = new AsyncStorageProfileRepo();
    expect(await repo.get()).toBeNull();

    const profile = {
      heightCm: 175,
      weightKg: 70,
      age: 30,
      sex: 'male' as const,
      activityLevel: 'moderate' as const,
      goal: 'lose' as const,
      targetWeightKg: 68,
    };
    await repo.set(profile);
    expect(await repo.get()).toEqual(profile);
  });
});

describe('AsyncStorageMealTemplateRepo', () => {
  const tpl = (over: Partial<MealTemplate> = {}): MealTemplate => ({
    id: 't1',
    name: 'Usual breakfast',
    items: [food({ title: 'Oats', calories: 300 })],
    createdAt: '2026-09-22T08:00:00.000Z',
    ...over,
  });

  it('saves, replaces by id, and lists newest first', async () => {
    const repo = new AsyncStorageMealTemplateRepo();
    expect(await repo.list()).toEqual([]);

    await repo.save(tpl());
    await repo.save(tpl({ id: 't2', name: 'Gym shake', createdAt: '2026-09-23T08:00:00.000Z' }));
    await repo.save(tpl({ id: 't1', name: 'Breakfast v2' }));

    const list = await repo.list();
    expect(list.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(list[1].name).toBe('Breakfast v2');
    expect(await repo.list()).toHaveLength(2);
  });

  it('removes a template by id', async () => {
    const repo = new AsyncStorageMealTemplateRepo();
    await repo.save(tpl());
    await repo.remove('t1');
    expect(await repo.list()).toEqual([]);
  });
});

describe('templateFromEntries', () => {
  it('builds a named template with an id and timestamp', () => {
    const t = templateFromEntries('Usual breakfast', [food({ title: 'Oats', calories: 300 })]);
    expect(t.id).toBeTruthy();
    expect(t.name).toBe('Usual breakfast');
    expect(t.items).toHaveLength(1);
    expect(t.createdAt).toBeTruthy();
  });
});
