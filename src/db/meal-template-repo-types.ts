import type { MealTemplate, MealTemplateItem } from '../types';

/**
 * Repository boundary for meal templates — named, reusable entry sets. The
 * persistence pattern matches the other repos: AsyncStorage on web, SQLite on
 * native (see db/repos.ts), and a future remote backend can implement the
 * same interface without touching any screen.
 */
export interface MealTemplateRepo {
  list(): Promise<MealTemplate[]>;
  /** Creates or replaces (same id) and returns the stored template. */
  save(template: MealTemplate): Promise<MealTemplate>;
  remove(id: string): Promise<void>;
}

/** Convenience constructor from entries already in the diary. */
export function templateFromEntries(name: string, entries: MealTemplateItem[]): MealTemplate {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    items: entries,
    createdAt: new Date().toISOString(),
  };
}
