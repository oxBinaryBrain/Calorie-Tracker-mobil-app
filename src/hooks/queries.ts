import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, dateKey } from '../utils';
import { entryRepo, mealTemplateRepo, profileRepo, targetRepo, trackerRepo } from '../db/repos';
import { api } from '../api/client';
import type { DayTracker, Entry, MealTemplate, Profile, TargetEdit, UserTargets } from '../types';

export const queryKeys = {
  entriesDay: (date: string) => ['entries', 'day', date] as const,
  entriesRange: (from: string, to: string) => ['entries', 'range', from, to] as const,
  entry: (id: string) => ['entry', id] as const,
  tracker: (date: string) => ['tracker', date] as const,
  trackerRange: (from: string, to: string) => ['trackers', 'range', from, to] as const,
  targets: ['targets'] as const,
  profile: ['profile'] as const,
  mealTemplates: ['mealTemplates'] as const,
};

// ----------------------------- Entries -------------------------------------

export function useDayEntries(date: string) {
  return useQuery({
    queryKey: queryKeys.entriesDay(date),
    queryFn: () => entryRepo.listByDate(date),
  });
}

export function useEntriesRange(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.entriesRange(from, to),
    queryFn: () => entryRepo.listBetween(from, to),
  });
}

export function useLoggedDayKeys(from: string, to: string) {
  const q = useEntriesRange(from, to);
  const days = new Set<string>();
  for (const e of q.data ?? []) days.add(e.loggedAt.slice(0, 10));
  return { ...q, days };
}

export function useSaveEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<Omit<Entry, 'id' | 'loggedAt'> & { loggedAt?: string }>) => {
      const saved: Entry[] = [];
      for (const item of items) saved.push(await entryRepo.create(item));
      return saved;
    },
    onSuccess: (saved) => {
      // Every entry consumer (day lists and week-range strips alike) refetches;
      // one prefix-wide invalidation is cheaper than tracking which ranges
      // include each saved day.
      void qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Omit<Entry, 'id' | 'loggedAt'>> }) =>
      entryRepo.update(id, patch),
    onSuccess: (updated) => {
      if (!updated) return;
      void qc.invalidateQueries({ queryKey: queryKeys.entry(updated.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.entriesDay(updated.loggedAt.slice(0, 10)) });
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entryRepo.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['entries'] });
    },
  });
}

// ----------------------------- Trackers ------------------------------------

export function useDayTracker(date: string) {
  return useQuery({
    queryKey: queryKeys.tracker(date),
    queryFn: () => trackerRepo.get(date),
  });
}

export function useTrackerRange(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.trackerRange(from, to),
    queryFn: () => trackerRepo.getRange(from, to),
  });
}

export function useUpsertTracker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tracker: DayTracker) => trackerRepo.upsert(tracker),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tracker(t.date) });
      void qc.invalidateQueries({ queryKey: ['trackers'] });
    },
  });
}

// ----------------------------- Targets & profile ---------------------------

export function useTargets() {
  return useQuery({
    queryKey: queryKeys.targets,
    queryFn: () => targetRepo.get(),
  });
}

export function useSetTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targets: UserTargets) => targetRepo.set(targets),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.targets }),
  });
}

export function useUpdateTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (edit: TargetEdit) => api.updateTargets(edit),
    onSuccess: (targets) => {
      void targetRepo.set(targets);
      qc.setQueryData(queryKeys.targets, targets);
    },
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => profileRepo.get(),
  });
}

export function useSetProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: Profile) => profileRepo.set(profile),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.profile }),
  });
}

// ----------------------------- Meal templates -------------------------------

export function useMealTemplates() {
  return useQuery({
    queryKey: queryKeys.mealTemplates,
    queryFn: () => mealTemplateRepo.list(),
  });
}

export function useSaveMealTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: MealTemplate) => mealTemplateRepo.save(template),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mealTemplates }),
  });
}

export function useDeleteMealTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mealTemplateRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.mealTemplates }),
  });
}

// ----------------------------- Derived helpers ------------------------------

export function todayTotals(entries: Entry[] | undefined) {
  let calories = 0;
  let carbs = 0;
  let protein = 0;
  let fat = 0;
  let burned = 0;
  for (const e of entries ?? []) {
    if (e.type === 'food') {
      calories += e.calories;
      carbs += e.carbs ?? 0;
      protein += e.protein ?? 0;
      fat += e.fat ?? 0;
    } else {
      burned += e.caloriesBurned ?? 0;
    }
  }
  return { calories, carbs, protein, fat, burned };
}

export function weekRange(anchor = new Date()): { from: string; to: string; days: string[] } {
  const d = new Date(anchor);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  const from = dateKey(d);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return { from, to: days[6], days };
}
