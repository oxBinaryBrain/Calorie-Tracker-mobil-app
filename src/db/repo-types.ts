import type { DayTracker, Entry, Profile, UserTargets } from '../types';

// ---------------------------------------------------------------------------
// Repository interfaces — the sync-ready persistence boundary. SQLite
// implements these on native; AsyncStorage on web. A future remote backend
// can implement them too without touching any screen.
// ---------------------------------------------------------------------------

export interface EntryRepo {
  listByDate(date: string): Promise<Entry[]>;
  listBetween(from: string, to: string): Promise<Entry[]>;
  get(id: string): Promise<Entry | null>;
  create(input: Omit<Entry, 'id' | 'loggedAt'> & { loggedAt?: string }): Promise<Entry>;
  update(id: string, patch: Partial<Omit<Entry, 'id' | 'loggedAt'>>): Promise<Entry | null>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
}

export interface TrackerRepo {
  get(date: string): Promise<DayTracker>;
  getRange(from: string, to: string): Promise<DayTracker[]>;
  upsert(tracker: DayTracker): Promise<DayTracker>;
}

export interface TargetRepo {
  get(): Promise<UserTargets | null>;
  set(targets: UserTargets): Promise<void>;
}

export interface ProfileRepo {
  get(): Promise<Profile | null>;
  set(profile: Profile): Promise<void>;
}
