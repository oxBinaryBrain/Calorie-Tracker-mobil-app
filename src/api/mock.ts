import type {
  ApiClient,
  AuthSession,
  OnboardingPayload,
  ParseResult,
  TargetEdit,
  UserTargets,
} from '../types';
import { previewTargets } from '../services/targets';
import { matchFood } from '../services/foodDb';

/**
 * MockApi — simulates the backend contract so every flow works end-to-end with
 * no server. The parsing estimator below mirrors what the server-side LLM
 * prompt (see docs/BACKEND.md) would return: itemized entries, one per food or
 * activity, descriptive never-judgmental notes, no warnings.
 */

const EXERCISE_DB: Record<string, { met: number; note: string }> = {
  walk: { met: 3.5, note: 'A relaxed-pace walk.' },
  walking: { met: 3.5, note: 'A relaxed-pace walk.' },
  run: { met: 9.8, note: 'A moderate-paced run.' },
  running: { met: 9.8, note: 'A moderate-paced run.' },
  jog: { met: 7, note: 'An easy-paced jog.' },
  cycling: { met: 7.5, note: 'Cycling at a moderate pace.' },
  bike: { met: 7.5, note: 'Cycling at a moderate pace.' },
  swim: { met: 8.3, note: 'Swimming laps at a steady pace.' },
  swimming: { met: 8.3, note: 'Swimming laps at a steady pace.' },
  yoga: { met: 2.5, note: 'A gentle yoga session.' },
  pilates: { met: 3, note: 'A pilates session.' },
  lifting: { met: 5, note: 'Strength training with weights.' },
  weights: { met: 5, note: 'Strength training with weights.' },
  gym: { met: 5.5, note: 'A general gym session.' },
  hike: { met: 6, note: 'Hiking on varied terrain.' },
  hiking: { met: 6, note: 'Hiking on varied terrain.' },
  dance: { met: 5, note: 'Dancing at a moderate intensity.' },
  dancing: { met: 5, note: 'Dancing at a moderate intensity.' },
  soccer: { met: 8, note: 'A recreational soccer game.' },
  football: { met: 8, note: 'A recreational football game.' },
  tennis: { met: 7.3, note: 'A casual tennis match.' },
  basketball: { met: 8, note: 'A casual basketball game.' },
  climbing: { met: 8, note: 'Rock climbing.' },
  rowing: { met: 7, note: 'Rowing at a steady pace.' },
  stairs: { met: 8.8, note: 'Stair climbing.' },
  stretching: { met: 2.3, note: 'A stretching session.' },
};

function matchExercise(word: string): { key: string; info: (typeof EXERCISE_DB)[string] } | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  if (EXERCISE_DB[w]) return { key: w, info: EXERCISE_DB[w] };
  // "ran" -> "run", "swam" -> "swim", "cycled" -> "cycling"
  const irregular: Record<string, string> = {
    ran: 'run', running: 'run', swam: 'swim', cycled: 'cycling', lifted: 'lifting',
    hiked: 'hike', danced: 'dancing', climbed: 'climbing', rowed: 'rowing', stretched: 'stretching',
  };
  if (irregular[w]) return { key: irregular[w], info: EXERCISE_DB[irregular[w]] };
  if (w.length >= 5 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    for (const key of Object.keys(EXERCISE_DB)) {
      if (key.startsWith(stem)) return { key, info: EXERCISE_DB[key] };
    }
  }
  if (w.length >= 4) {
    for (const key of Object.keys(EXERCISE_DB)) {
      if (key.startsWith(w) || w.startsWith(key)) return { key, info: EXERCISE_DB[key] };
    }
  }
  return null;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * Keyword estimator. Splits input into clauses, then matches food and exercise
 * words, quantities ("two eggs", "200g rice", "ran 30 minutes") and emits one
 * ParsedEntry per item — the same shape the LLM prompt returns.
 */
export function estimateEntries(input: string): ParseResult['entries'] {
  const text = input.toLowerCase();
  const clauses = text
    .split(/[,.;\n]|\band\b|\bwith\b|\bthen\b|\+/)
    .map((c) => c.trim())
    .filter(Boolean);

  const entries: ParseResult['entries'] = [];
  const used = new Set<string>();

  const numberWords: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    a: 1, an: 1, half: 0.5,
  };

  const parseQty = (clause: string): { count: number | null; grams: number | null; minutes: number | null } => {
    let count: number | null = null;
    let grams: number | null = null;
    let minutes: number | null = null;

    const gramMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/);
    if (gramMatch) grams = Number(gramMatch[1]);

    const mlMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:ml|milliliter|milliliters)\b/);
    if (mlMatch) grams = Number(mlMatch[1]);

    const minMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
    if (minMatch) minutes = Number(minMatch[1]);

    const hrMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
    if (hrMatch) minutes = (minutes ?? 0) + Number(hrMatch[1]) * 60;

    const numMatch = clause.match(/\b(\d+(?:\.\d+)?)\s+[a-z]/);
    if (numMatch && !gramMatch) count = Number(numMatch[1]);
    for (const [word, value] of Object.entries(numberWords)) {
      const re = new RegExp(`\\b${word}\\b\\s+[a-z]`);
      if (re.test(clause)) {
        count = value;
        break;
      }
    }
    return { count, grams, minutes };
  };

  for (const clause of clauses) {
    const words = clause.split(/\s+/).filter(Boolean);
    const { count, grams: gGrams, minutes } = parseQty(clause);

    // Exercise detection (looks for duration to confirm).
    let matchedExercise = false;
    for (let i = words.length - 1; i >= 0; i--) {
      const hit = matchExercise(words[i]);
      if (!hit) continue;
      if (used.has(`${i}:${words[i]}`)) continue;
      const dur = minutes ?? 30;
      // METs → kcal: MET × 3.5 × kg / 200 × minutes. Use a typical 70 kg body.
      const kcal = round(hit.info.met * 3.5 * 70 / 200 * dur);
      entries.push({
        type: 'exercise',
        title: `${titleCase(hit.key)} · ${dur} min`,
        grams: null,
        calories: 0,
        carbs: null,
        protein: null,
        fat: null,
        caloriesBurned: kcal,
        note: hit.info.note,
      });
      used.add(`${i}:${words[i]}`);
      matchedExercise = true;
      break;
    }
    if (matchedExercise) continue;

    // Food detection: scan every word (quantity words and bare numbers are
    // not foods) so multi-item clauses like "a latte" yield their real item.
    for (let i = 0; i < words.length; i++) {
      const key = `${i}:${words[i]}`;
      if (used.has(key)) continue;
      if (numberWords[words[i]] != null || /^\d+(?:\.\d+)?$/.test(words[i])) continue;
      const hit = matchFood(words[i]);
      if (!hit) continue;
      used.add(key);
      const info = hit.info;
      let grams = gGrams;
      let note = info.note;
      if (grams == null) {
        const pieces = count ?? 1;
        grams = round(info.serving * pieces);
        if (pieces === 1 && count == null) {
          note = `${info.note} No quantity given, so a typical single serving was assumed.`;
        }
      } else if (count != null && gGrams == null) {
        grams = round(info.serving * count);
      }
      const kcal = round((info.per100 * (grams ?? info.serving)) / 100);
      entries.push({
        type: 'food',
        title: titleCase(words[i]),
        grams,
        calories: kcal,
        carbs: round((info.carbs * (grams ?? info.serving)) / 100),
        protein: round((info.protein * (grams ?? info.serving)) / 100),
        fat: round((info.fat * (grams ?? info.serving)) / 100),
        caloriesBurned: null,
        note,
      });
    }
  }

  if (entries.length === 0) {
    // Fallback: describe generically, never judge.
    entries.push({
      type: 'food',
      title: input.trim().slice(0, 40) || 'Meal',
      grams: null,
      calories: 350,
      carbs: 40,
      protein: 15,
      fat: 12,
      caloriesBurned: null,
      note: 'Estimated from your description; a standard mixed plate was assumed. You can adjust the numbers.',
    });
  }

  return entries;
}

const FAKE_PHOTO_ITEMS: Array<Omit<ParseResult['entries'][number], 'type'>> = [
  { title: 'Grilled chicken', grams: 150, calories: 248, carbs: 0, protein: 47, fat: 5, caloriesBurned: null, note: 'A palm-sized portion of grilled chicken, estimated from the photo.' },
  { title: 'Rice', grams: 180, calories: 234, carbs: 50, protein: 5, fat: 1, caloriesBurned: null, note: 'A cup of cooked rice beside the main dish.' },
  { title: 'Mixed vegetables', grams: 100, calories: 45, carbs: 8, protein: 2, fat: 0.5, caloriesBurned: null, note: 'Steamed vegetables visible on the plate.' },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simulated auth store so login/signup flows work offline. */
const DEMO_USER: AuthSession = {
  token: 'mock-token',
  userId: 'demo-user',
  email: 'you@example.com',
};

let mockTargets: UserTargets | null = null;

export class MockApi implements ApiClient {
  async login(_email: string, _password: string): Promise<AuthSession> {
    await delay(700);
    return { ...DEMO_USER, email: _email };
  }

  async signup(email: string, _password: string): Promise<AuthSession> {
    await delay(900);
    return { ...DEMO_USER, email };
  }

  async forgotPassword(_email: string): Promise<void> {
    await delay(600);
  }

  async submitOnboarding(payload: OnboardingPayload): Promise<{ targets: UserTargets }> {
    await delay(1200);
    mockTargets = previewTargets(payload);
    return { targets: mockTargets };
  }

  async updateTargets(edit: TargetEdit): Promise<UserTargets> {
    await delay(500);
    mockTargets = { ...(mockTargets ?? { dailyCalories: 2100, carbsGrams: 230, proteinGrams: 120, fatGrams: 70 }), ...edit };
    return mockTargets;
  }

  async parseText(input: string): Promise<ParseResult> {
    await delay(900);
    return { entries: estimateEntries(input) };
  }

  async parsePhoto(_photoBase64: string): Promise<ParseResult> {
    await delay(1400);
    return { entries: FAKE_PHOTO_ITEMS.map((item) => ({ ...item, type: 'food' as const })) };
  }
}
