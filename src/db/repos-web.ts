import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayTracker, Entry, MealTemplate, Profile, UserTargets } from '../types';
import type { EntryRepo, ProfileRepo, TargetRepo, TrackerRepo } from './repo-types';
import type { MealTemplateRepo } from './meal-template-repo-types';

/**
 * Web implementations of the repositories. expo-sqlite has no web build in
 * this SDK, so the browser preview persists through AsyncStorage
 * (localStorage) behind the exact same interfaces.
 */

const KEYS = {
  entries: 'caloria.entries.v1',
  trackers: 'caloria.trackers.v1',
  targets: 'caloria.targets.v1',
  profile: 'caloria.profile.v1',
  mealTemplates: 'caloria.mealTemplates.v1',
};

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export class AsyncStorageEntryRepo implements EntryRepo {
  async listByDate(date: string): Promise<Entry[]> {
    const all = await readJson<Entry[]>(KEYS.entries, []);
    return all.filter((e) => e.loggedAt.slice(0, 10) === date).sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }

  async listBetween(from: string, to: string): Promise<Entry[]> {
    const all = await readJson<Entry[]>(KEYS.entries, []);
    return all
      .filter((e) => e.loggedAt.slice(0, 10) >= from && e.loggedAt.slice(0, 10) <= to)
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }

  async get(id: string): Promise<Entry | null> {
    const all = await readJson<Entry[]>(KEYS.entries, []);
    return all.find((e) => e.id === id) ?? null;
  }

  async create(input: Omit<Entry, 'id' | 'loggedAt'> & { loggedAt?: string }): Promise<Entry> {
    const entry: Entry = { ...input, id: makeId(), loggedAt: input.loggedAt ?? new Date().toISOString() };
    const all = await readJson<Entry[]>(KEYS.entries, []);
    all.push(entry);
    await writeJson(KEYS.entries, all);
    return entry;
  }

  async update(id: string, patch: Partial<Omit<Entry, 'id' | 'loggedAt'>>): Promise<Entry | null> {
    const all = await readJson<Entry[]>(KEYS.entries, []);
    const idx = all.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const merged: Entry = { ...all[idx], ...patch };
    all[idx] = merged;
    await writeJson(KEYS.entries, all);
    return merged;
  }

  async remove(id: string): Promise<void> {
    const all = await readJson<Entry[]>(KEYS.entries, []);
    await writeJson(KEYS.entries, all.filter((e) => e.id !== id));
  }

  async removeMany(ids: string[]): Promise<void> {
    const all = await readJson<Entry[]>(KEYS.entries, []);
    const drop = new Set(ids);
    await writeJson(KEYS.entries, all.filter((e) => !drop.has(e.id)));
  }
}

export class AsyncStorageTrackerRepo implements TrackerRepo {
  async get(date: string): Promise<DayTracker> {
    const all = await readJson<DayTracker[]>(KEYS.trackers, []);
    return all.find((t) => t.date === date) ?? { date, waterMl: 0 };
  }

  async getRange(from: string, to: string): Promise<DayTracker[]> {
    const all = await readJson<DayTracker[]>(KEYS.trackers, []);
    return all
      .filter((t) => t.date >= from && t.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async upsert(tracker: DayTracker): Promise<DayTracker> {
    const all = await readJson<DayTracker[]>(KEYS.trackers, []);
    const idx = all.findIndex((t) => t.date === tracker.date);
    // Merge, don't replace: water quick-adds only send { date, waterMl },
    // and a blind replace would wipe a saved weight or sleep.
    const merged: DayTracker = idx === -1 ? tracker : { ...all[idx], ...tracker, date: tracker.date };
    if (idx === -1) all.push(merged);
    else all[idx] = merged;
    await writeJson(KEYS.trackers, all);
    return merged;
  }
}

export class AsyncStorageTargetRepo implements TargetRepo {
  async get(): Promise<UserTargets | null> {
    return readJson<UserTargets | null>(KEYS.targets, null);
  }

  async set(targets: UserTargets): Promise<void> {
    await writeJson(KEYS.targets, targets);
  }
}

export class AsyncStorageMealTemplateRepo implements MealTemplateRepo {
  async list(): Promise<MealTemplate[]> {
    const all = await readJson<MealTemplate[]>(KEYS.mealTemplates, []);
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async save(template: MealTemplate): Promise<MealTemplate> {
    const all = await readJson<MealTemplate[]>(KEYS.mealTemplates, []);
    const idx = all.findIndex((t) => t.id === template.id);
    if (idx === -1) all.push(template);
    else all[idx] = template;
    await writeJson(KEYS.mealTemplates, all);
    return template;
  }

  async remove(id: string): Promise<void> {
    const all = await readJson<MealTemplate[]>(KEYS.mealTemplates, []);
    await writeJson(KEYS.mealTemplates, all.filter((t) => t.id !== id));
  }
}

export class AsyncStorageProfileRepo implements ProfileRepo {
  async get(): Promise<Profile | null> {
    return readJson<Profile | null>(KEYS.profile, null);
  }

  async set(profile: Profile): Promise<void> {
    await writeJson(KEYS.profile, profile);
  }
}
