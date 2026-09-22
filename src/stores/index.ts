import { create } from 'zustand';
import type { Settings, ThemePref, Units } from '../types';
import * as Notifications from '../services/notifications';
import { storageGet, storageSet, storageDelete } from '../services/storage';

type PrefsState = {
  units: Units;
  theme: ThemePref;
  /** Last month the user was viewing in the diary calendar, "yyyy-mm-01". */
  calendarMonth: string | null;
  reminderEnabled: boolean;
  reminderHour: number;
  simulatedPro: boolean;
  hydrated: boolean;
  setUnits: (u: Units) => void;
  setTheme: (t: ThemePref) => void;
  /** Remembers the diary calendar's visible month; null resets to today's month. */
  setCalendarMonth: (month: string | null) => void;
  setReminder: (enabled: boolean, hour?: number) => Promise<void>;
  setSimulatedPro: (pro: boolean) => void;
  hydrate: () => void;
};

const STORAGE_KEY = 'caloria.prefs.v1';

/**
 * Developer builds ship with full access: Pro is forced on so every feature is
 * available locally (the mock store has no real entitlements). Flip to false
 * for release builds; then the Paywall controls the flag as designed.
 */
const DEV_FULL_ACCESS = true;

/**
 * Preferences persist through the shared storage abstraction as one JSON blob.
 */
async function persist(state: Pick<PrefsState, 'units' | 'theme' | 'calendarMonth' | 'reminderEnabled' | 'reminderHour' | 'simulatedPro'>) {
  try {
    await storageSet(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // non-fatal
  }
}

export const usePrefs = create<PrefsState>((set, get) => ({
  units: 'metric',
  theme: 'system',
  calendarMonth: null,
  reminderEnabled: false,
  reminderHour: 20,
  simulatedPro: DEV_FULL_ACCESS,
  hydrated: false,
  setUnits: (units) => {
    set({ units });
    void persist(get());
  },
  setTheme: (theme) => {
    set({ theme });
    void persist(get());
  },
  setCalendarMonth: (calendarMonth) => {
    set({ calendarMonth });
    void persist(get());
  },
  setReminder: async (reminderEnabled, hour) => {
    const reminderHour = hour ?? get().reminderHour;
    set({ reminderEnabled, reminderHour });
    if (reminderEnabled) {
      const granted = await Notifications.ensureNotificationPermission();
      if (granted) await Notifications.scheduleDailyReminder(reminderHour);
      else set({ reminderEnabled: false });
    } else {
      await Notifications.cancelDailyReminder();
    }
    void persist(get());
  },
  setSimulatedPro: (simulatedPro) => {
    set({ simulatedPro });
    void persist(get());
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    void (async () => {
      try {
        const raw = await storageGet(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings> & { simulatedPro?: boolean };
          set({
            units: parsed.units ?? 'metric',
            theme: parsed.theme ?? 'system',
            calendarMonth: typeof parsed.calendarMonth === 'string' ? parsed.calendarMonth : null,
            reminderEnabled: parsed.reminderEnabled ?? false,
            reminderHour: parsed.reminderHour ?? 20,
            simulatedPro: DEV_FULL_ACCESS ? true : (parsed.simulatedPro ?? false),
          });
        }
      } catch {
        // fresh install or unreadable storage
      }
    })();
  },
}));

type SessionState = {
  token: string | null;
  userId: string | null;
  email: string | null;
  onboarded: boolean;
  hydrated: boolean;
  ready: boolean;
  setSession: (s: { token: string; userId: string; email: string }) => void;
  setOnboarded: (v: boolean) => void;
  signOut: () => void;
  hydrate: () => void;
};

const SESSION_KEY = 'caloria.session.v1';
const ONBOARDED_KEY = 'caloria.onboarded.v1';

export const useSession = create<SessionState>((set, get) => ({
  token: null,
  userId: null,
  email: null,
  onboarded: false,
  hydrated: false,
  ready: false,
  setSession: ({ token, userId, email }) => {
    set({ token, userId, email });
    void storageSet(SESSION_KEY, JSON.stringify({ token, userId, email }));
  },
  setOnboarded: (onboarded) => {
    set({ onboarded });
    void storageSet(ONBOARDED_KEY, onboarded ? '1' : '0');
  },
  signOut: () => {
    set({ token: null, userId: null, email: null, onboarded: false });
    void storageDelete(SESSION_KEY);
    void storageDelete(ONBOARDED_KEY);
  },
  hydrate: () => {
    if (get().hydrated) return;
    set({ hydrated: true });
    void (async () => {
      try {
        const raw = await storageGet(SESSION_KEY);
        const onboardedRaw = await storageGet(ONBOARDED_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { token?: string; userId?: string; email?: string };
          set({ token: parsed.token ?? null, userId: parsed.userId ?? null, email: parsed.email ?? null });
        }
        if (onboardedRaw === '1') set({ onboarded: true });
      } catch {
        // fresh install or unreadable storage
      } finally {
        set({ ready: true });
      }
    })();
  },
}));

export type ToastKind = 'info' | 'success';
export type Toast = { id: number; text: string; kind: ToastKind };

type ToastState = {
  toasts: Toast[];
  show: (text: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
};

let toastSeq = 1;

/** Gentle feedback: plain informational toasts only, never warnings. */
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show: (text, kind = 'info') => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2600);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
