import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { dateKey } from '../utils';
import type { DayTracker, Entry, MealTemplate, Profile, UserTargets } from '../types';
import type { EntryRepo, ProfileRepo, TargetRepo, TrackerRepo } from './repo-types';
import type { MealTemplateRepo } from './meal-template-repo-types';
import {
  AsyncStorageEntryRepo,
  AsyncStorageMealTemplateRepo,
  AsyncStorageProfileRepo,
  AsyncStorageTargetRepo,
  AsyncStorageTrackerRepo,
} from './repos-web';

export type { EntryRepo, ProfileRepo, TargetRepo, TrackerRepo } from './repo-types';

// ---------------------------------------------------------------------------
// SQLite implementations
// ---------------------------------------------------------------------------

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('caloria.db').then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          raw_input TEXT NOT NULL,
          photo_url TEXT,
          title TEXT NOT NULL,
          grams REAL,
          calories REAL NOT NULL,
          carbs REAL,
          protein REAL,
          fat REAL,
          calories_burned REAL,
          note TEXT,
          logged_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_entries_logged_at ON entries (logged_at);
        CREATE TABLE IF NOT EXISTS day_trackers (
          date TEXT PRIMARY KEY NOT NULL,
          water_ml REAL NOT NULL DEFAULT 0,
          weight_kg REAL,
          sleep_hours REAL,
          sleep_quality TEXT
        );
        CREATE TABLE IF NOT EXISTS kv (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meal_templates (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          items_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      return database;
    });
  }
  return dbPromise;
}

function rowToEntry(row: SQLite.SQLiteBindParams extends never ? never : any): Entry {
  return {
    id: String(row.id),
    type: row.type === 'exercise' ? 'exercise' : 'food',
    rawInput: row.raw_input ?? '',
    photoUrl: row.photo_url ?? undefined,
    title: row.title,
    grams: row.grams ?? undefined,
    calories: row.calories ?? 0,
    carbs: row.carbs ?? undefined,
    protein: row.protein ?? undefined,
    fat: row.fat ?? undefined,
    caloriesBurned: row.calories_burned ?? undefined,
    note: row.note ?? undefined,
    loggedAt: row.logged_at,
  };
}

export class SqliteEntryRepo implements EntryRepo {
  async listByDate(date: string): Promise<Entry[]> {
    const database = await db();
    const rows = await database.getAllAsync(
      `SELECT * FROM entries WHERE substr(logged_at, 1, 10) = ? ORDER BY logged_at ASC`,
      [date],
    );
    return rows.map(rowToEntry);
  }

  async listBetween(from: string, to: string): Promise<Entry[]> {
    const database = await db();
    const rows = await database.getAllAsync(
      `SELECT * FROM entries WHERE substr(logged_at, 1, 10) >= ? AND substr(logged_at, 1, 10) <= ? ORDER BY logged_at ASC`,
      [from, to],
    );
    return rows.map(rowToEntry);
  }

  async get(id: string): Promise<Entry | null> {
    const database = await db();
    const row = await database.getFirstAsync(`SELECT * FROM entries WHERE id = ?`, [id]);
    return row ? rowToEntry(row) : null;
  }

  async create(input: Omit<Entry, 'id' | 'loggedAt'> & { loggedAt?: string }): Promise<Entry> {
    const database = await db();
    const entry: Entry = {
      ...input,
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      loggedAt: input.loggedAt ?? new Date().toISOString(),
    };
    await database.runAsync(
      `INSERT INTO entries (id, type, raw_input, photo_url, title, grams, calories, carbs, protein, fat, calories_burned, note, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.type,
        entry.rawInput,
        entry.photoUrl ?? null,
        entry.title,
        entry.grams ?? null,
        entry.calories,
        entry.carbs ?? null,
        entry.protein ?? null,
        entry.fat ?? null,
        entry.caloriesBurned ?? null,
        entry.note ?? null,
        entry.loggedAt,
      ],
    );
    return entry;
  }

  async update(id: string, patch: Partial<Omit<Entry, 'id' | 'loggedAt'>>): Promise<Entry | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const merged: Entry = { ...existing, ...patch };
    const database = await db();
    await database.runAsync(
      `UPDATE entries SET type = ?, raw_input = ?, photo_url = ?, title = ?, grams = ?, calories = ?, carbs = ?, protein = ?, fat = ?, calories_burned = ?, note = ?
       WHERE id = ?`,
      [
        merged.type,
        merged.rawInput,
        merged.photoUrl ?? null,
        merged.title,
        merged.grams ?? null,
        merged.calories,
        merged.carbs ?? null,
        merged.protein ?? null,
        merged.fat ?? null,
        merged.caloriesBurned ?? null,
        merged.note ?? null,
        id,
      ],
    );
    return merged;
  }

  async remove(id: string): Promise<void> {
    const database = await db();
    await database.runAsync(`DELETE FROM entries WHERE id = ?`, [id]);
  }

  async removeMany(ids: string[]): Promise<void> {
    const database = await db();
    for (const id of ids) {
      await database.runAsync(`DELETE FROM entries WHERE id = ?`, [id]);
    }
  }
}

export class SqliteTrackerRepo implements TrackerRepo {
  async get(date: string): Promise<DayTracker> {
    const database = await db();
    const row = await database.getFirstAsync(`SELECT * FROM day_trackers WHERE date = ?`, [date]);
    if (!row) return { date, waterMl: 0 };
    const t = row as any;
    return {
      date: String(t.date),
      waterMl: Number(t.water_ml ?? 0),
      weightKg: t.weight_kg != null ? Number(t.weight_kg) : undefined,
      sleepHours: t.sleep_hours != null ? Number(t.sleep_hours) : undefined,
      sleepQuality: (t.sleep_quality as DayTracker['sleepQuality']) ?? undefined,
    };
  }

  async getRange(from: string, to: string): Promise<DayTracker[]> {
    const database = await db();
    const rows = await database.getAllAsync(
      `SELECT * FROM day_trackers WHERE date >= ? AND date <= ? ORDER BY date ASC`,
      [from, to],
    );
    return rows.map((row: any) => ({
      date: String(row.date),
      waterMl: Number(row.water_ml ?? 0),
      weightKg: row.weight_kg != null ? Number(row.weight_kg) : undefined,
      sleepHours: row.sleep_hours != null ? Number(row.sleep_hours) : undefined,
      sleepQuality: (row.sleep_quality as DayTracker['sleepQuality']) ?? undefined,
    }));
  }

  async upsert(tracker: DayTracker): Promise<DayTracker> {
    const database = await db();
    // Merge with the stored row first: water quick-adds only send
    // { date, waterMl }, and writing those through untouched would null out
    // a saved weight or sleep.
    const existing = await this.get(tracker.date);
    const merged: DayTracker = { ...existing, ...tracker, date: tracker.date };
    await database.runAsync(
      `INSERT INTO day_trackers (date, water_ml, weight_kg, sleep_hours, sleep_quality)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET water_ml = excluded.water_ml, weight_kg = excluded.weight_kg,
         sleep_hours = excluded.sleep_hours, sleep_quality = excluded.sleep_quality`,
      [
        merged.date,
        merged.waterMl,
        merged.weightKg ?? null,
        merged.sleepHours ?? null,
        merged.sleepQuality ?? null,
      ],
    );
    return merged;
  }
}

const KV_TARGETS = 'targets';
const KV_PROFILE = 'profile';

export class SqliteTargetRepo implements TargetRepo {
  async get(): Promise<UserTargets | null> {
    const database = await db();
    const row = await database.getFirstAsync(`SELECT value FROM kv WHERE key = ?`, [KV_TARGETS]) as { value: string } | null;
    if (!row) return null;
    try {
      return JSON.parse(String(row.value)) as UserTargets;
    } catch {
      return null;
    }
  }

  async set(targets: UserTargets): Promise<void> {
    const database = await db();
    await database.runAsync(
      `INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [KV_TARGETS, JSON.stringify(targets)],
    );
  }
}

export class SqliteProfileRepo implements ProfileRepo {
  async get(): Promise<Profile | null> {
    const database = await db();
    const row = await database.getFirstAsync(`SELECT value FROM kv WHERE key = ?`, [KV_PROFILE]) as { value: string } | null;
    if (!row) return null;
    try {
      return JSON.parse(String(row.value)) as Profile;
    } catch {
      return null;
    }
  }

  async set(profile: Profile): Promise<void> {
    const database = await db();
    await database.runAsync(
      `INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [KV_PROFILE, JSON.stringify(profile)],
    );
  }
}

export const entryRepo: EntryRepo = Platform.OS === 'web' ? new AsyncStorageEntryRepo() : new SqliteEntryRepo();
export const trackerRepo: TrackerRepo = Platform.OS === 'web' ? new AsyncStorageTrackerRepo() : new SqliteTrackerRepo();
export const targetRepo: TargetRepo = Platform.OS === 'web' ? new AsyncStorageTargetRepo() : new SqliteTargetRepo();
export const profileRepo: ProfileRepo = Platform.OS === 'web' ? new AsyncStorageProfileRepo() : new SqliteProfileRepo();
// ---------------------------------------------------------------------------
// Meal templates (SQLite)
// ---------------------------------------------------------------------------

export class SqliteMealTemplateRepo implements MealTemplateRepo {
  async list(): Promise<MealTemplate[]> {
    const database = await db();
    const rows = await database.getAllAsync(
      `SELECT * FROM meal_templates ORDER BY created_at DESC`,
    );
    return rows.map((row: any) => {
      let items: MealTemplate['items'] = [];
      try {
        items = JSON.parse(String(row.items_json)) as MealTemplate['items'];
      } catch {
        items = [];
      }
      return {
        id: String(row.id),
        name: String(row.name),
        items,
        createdAt: String(row.created_at),
      };
    });
  }

  async save(template: MealTemplate): Promise<MealTemplate> {
    const database = await db();
    await database.runAsync(
      `INSERT INTO meal_templates (id, name, items_json, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, items_json = excluded.items_json,
         created_at = excluded.created_at`,
      [template.id, template.name, JSON.stringify(template.items), template.createdAt],
    );
    return template;
  }

  async remove(id: string): Promise<void> {
    const database = await db();
    await database.runAsync(`DELETE FROM meal_templates WHERE id = ?`, [id]);
  }
}

export const mealTemplateRepo: MealTemplateRepo = Platform.OS === 'web' ? new AsyncStorageMealTemplateRepo() : new SqliteMealTemplateRepo();
