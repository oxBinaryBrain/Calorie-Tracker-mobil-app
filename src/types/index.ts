export type EntryType = 'food' | 'exercise';

/** What the AI parse endpoints return, per item. */
export type ParsedEntry = {
  type: EntryType;
  title: string;
  grams: number | null;
  calories: number;
  carbs: number | null;
  protein: number | null;
  fat: number | null;
  caloriesBurned: number | null;
  note: string;
};

/** A parse response from POST /entries/parse or POST /entries/parse-photo. */
export type ParseResult = { entries: ParsedEntry[] };

export type Entry = {
  id: string;
  type: EntryType;
  rawInput: string;
  photoUrl?: string;
  title: string;
  grams?: number;
  calories: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  caloriesBurned?: number;
  note?: string;
  loggedAt: string; // ISO 8601
};

/** The loggable subset of an Entry, carried by a meal template. */
export type MealTemplateItem = {
  type: EntryType;
  title: string;
  grams?: number;
  calories: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  caloriesBurned?: number;
  note?: string;
};

/** A named, reusable set of entries ("Usual breakfast"). */
export type MealTemplate = {
  id: string;
  name: string;
  items: MealTemplateItem[];
  createdAt: string; // ISO 8601
};

export type UserTargets = {
  dailyCalories: number;
  carbsGrams: number;
  proteinGrams: number;
  fatGrams: number;
};

export type SleepQuality = 'poor' | 'fair' | 'good';

export type DayTracker = {
  date: string; // YYYY-MM-DD (local)
  waterMl: number;
  weightKg?: number;
  sleepHours?: number;
  sleepQuality?: SleepQuality;
};

export type Sex = 'female' | 'male' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type Goal = 'lose' | 'maintain' | 'gain';

export type Profile = {
  heightCm: number;
  weightKg: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: Goal;
  targetWeightKg?: number;
  displayName?: string;
  avatarEmoji?: string;
};

export type OnboardingPayload = Profile;

export type AuthSession = {
  token: string;
  userId: string;
  email: string;
};

export type Units = 'metric' | 'imperial';
export type ThemePref = 'system' | 'light' | 'dark';

export type Settings = {
  units: Units;
  theme: ThemePref;
  /** Last month the user viewed in the diary calendar ("yyyy-mm-01"). */
  calendarMonth?: string;
  reminderEnabled: boolean;
  reminderHour: number; // 0-23, local time
  /** User-set daily water goal in ml; null/absent means derive from profile. */
  waterGoalMl?: number | null;
};

/** Payload for editing a target set (server may recompute from profile instead). */
export type TargetEdit = Partial<UserTargets>;

/** The backend contract this app talks to. Implement server-side, or use the mock. */
export type ApiClient = {
  // Auth
  login(email: string, password: string): Promise<AuthSession>;
  signup(email: string, password: string): Promise<AuthSession>;
  forgotPassword(email: string): Promise<void>;

  // Onboarding & targets
  submitOnboarding(payload: OnboardingPayload): Promise<{ targets: UserTargets }>;
  updateTargets(edit: TargetEdit): Promise<UserTargets>;

  // AI parsing
  parseText(input: string): Promise<ParseResult>;
  parsePhoto(photoBase64: string): Promise<ParseResult>;
};

export type { TargetEdit as TargetsEdit };
