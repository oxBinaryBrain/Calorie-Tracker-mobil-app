/**
 * The built-in food library. One source of truth: the mock parser estimates
 * from it, and Home's autocomplete suggests from it as the user types.
 *
 * Values are per-100g with a typical single serving, so an entry can be
 * estimated either by grams (typed "200g rice") or by pieces ("two eggs").
 * Per-100g values are common USDA-style references; servings are the typical
 * portion an estimator would assume.
 */

export type FoodInfo = {
  /** kcal per 100 g. */
  per100: number;
  carbs: number;
  protein: number;
  fat: number;
  /** Typical single serving in grams (used when no quantity is given). */
  serving: number;
  /** Honest one-line note about the assumption, shown on the parsed entry. */
  note: string;
  /** How the food is usually measured — shapes autocomplete quantity hints. */
  unit: 'pieces' | 'grams' | 'cups' | 'slices';
};

export const FOOD_DB: Record<string, FoodInfo> = {
  banana: { per100: 89, carbs: 23, protein: 1.1, fat: 0.3, serving: 118, note: 'A medium banana, estimated at its typical weight.', unit: 'pieces' },
  apple: { per100: 52, carbs: 14, protein: 0.3, fat: 0.2, serving: 182, note: 'A medium apple with skin.', unit: 'pieces' },
  egg: { per100: 155, carbs: 1.1, protein: 13, fat: 11, serving: 50, note: 'One large egg.', unit: 'pieces' },
  eggs: { per100: 155, carbs: 1.1, protein: 13, fat: 11, serving: 50, note: 'Large eggs, estimated per egg.', unit: 'pieces' },
  chicken: { per100: 165, carbs: 0, protein: 31, fat: 3.6, serving: 150, note: 'Cooked chicken breast, estimated portion.', unit: 'grams' },
  salmon: { per100: 208, carbs: 0, protein: 20, fat: 13, serving: 150, note: 'Cooked salmon fillet.', unit: 'grams' },
  rice: { per100: 130, carbs: 28, protein: 2.7, fat: 0.3, serving: 158, note: 'Cooked white rice, about one cup.', unit: 'cups' },
  pasta: { per100: 158, carbs: 31, protein: 5.8, fat: 0.9, serving: 140, note: 'Cooked pasta, about one cup.', unit: 'cups' },
  bread: { per100: 265, carbs: 49, protein: 9, fat: 3.2, serving: 32, note: 'One slice of bread.', unit: 'slices' },
  toast: { per100: 265, carbs: 49, protein: 9, fat: 3.2, serving: 32, note: 'One slice of toast.', unit: 'slices' },
  oats: { per100: 68, carbs: 12, protein: 2.4, fat: 1.4, serving: 234, note: 'Cooked oatmeal, about one cup.', unit: 'cups' },
  yogurt: { per100: 59, carbs: 3.6, protein: 10, fat: 0.4, serving: 170, note: 'Plain low-fat yogurt, one container.', unit: 'grams' },
  cheese: { per100: 402, carbs: 1.3, protein: 25, fat: 33, serving: 30, note: 'A typical slice or serving of cheese.', unit: 'slices' },
  avocado: { per100: 160, carbs: 8.5, protein: 2, fat: 15, serving: 100, note: 'Half a medium avocado.', unit: 'pieces' },
  salad: { per100: 33, carbs: 6, protein: 1.8, fat: 0.4, serving: 150, note: 'A bowl of mixed greens with light dressing.', unit: 'grams' },
  pizza: { per100: 266, carbs: 33, protein: 11, fat: 10, serving: 107, note: 'One average slice of cheese pizza.', unit: 'slices' },
  burger: { per100: 295, carbs: 24, protein: 17, fat: 14, serving: 215, note: 'A standard fast-food-style burger.', unit: 'pieces' },
  fries: { per100: 312, carbs: 41, protein: 3.4, fat: 15, serving: 117, note: 'A medium serving of french fries.', unit: 'grams' },
  coffee: { per100: 2, carbs: 0, protein: 0.1, fat: 0, serving: 240, note: 'Black coffee; milk or sugar would add more.', unit: 'cups' },
  latte: { per100: 55, carbs: 5, protein: 3, fat: 2, serving: 350, note: 'A 12 oz latte with whole milk.', unit: 'cups' },
  beer: { per100: 43, carbs: 3.6, protein: 0.5, fat: 0, serving: 355, note: 'One standard can or bottle of beer.', unit: 'pieces' },
  wine: { per100: 83, carbs: 2.6, protein: 0.1, fat: 0, serving: 148, note: 'One 5 oz glass of wine.', unit: 'pieces' },
  chocolate: { per100: 546, carbs: 61, protein: 4.9, fat: 31, serving: 40, note: 'A small bar or a few squares of chocolate.', unit: 'grams' },
  cookie: { per100: 480, carbs: 63, protein: 5, fat: 24, serving: 30, note: 'One medium cookie.', unit: 'pieces' },
  smoothie: { per100: 60, carbs: 13, protein: 1.5, fat: 0.5, serving: 300, note: 'A fruit smoothie, blended with a little juice.', unit: 'cups' },
  soup: { per100: 45, carbs: 6, protein: 2, fat: 1.5, serving: 245, note: 'A bowl of broth-based soup.', unit: 'cups' },
  sandwich: { per100: 250, carbs: 30, protein: 12, fat: 9, serving: 200, note: 'A typical deli sandwich.', unit: 'pieces' },
  steak: { per100: 271, carbs: 0, protein: 25, fat: 19, serving: 200, note: 'Cooked beef steak, restaurant-style portion.', unit: 'grams' },
  tofu: { per100: 76, carbs: 1.9, protein: 8, fat: 4.8, serving: 126, note: 'Firm tofu, about half a block.', unit: 'grams' },
  nuts: { per100: 607, carbs: 21, protein: 20, fat: 54, serving: 28, note: 'A small handful of mixed nuts.', unit: 'grams' },
  milk: { per100: 61, carbs: 4.8, protein: 3.2, fat: 3.3, serving: 244, note: 'One cup of milk.', unit: 'cups' },
  orange: { per100: 47, carbs: 12, protein: 0.9, fat: 0.1, serving: 131, note: 'One medium orange.', unit: 'pieces' },
  potato: { per100: 77, carbs: 17, protein: 2, fat: 0.1, serving: 173, note: 'One medium potato.', unit: 'pieces' },
  pancake: { per100: 227, carbs: 28, protein: 6.4, fat: 9.7, serving: 77, note: 'One medium pancake.', unit: 'pieces' },
  burrito: { per100: 206, carbs: 26, protein: 9, fat: 7, serving: 350, note: 'A standard burrito.', unit: 'pieces' },
  shrimp: { per100: 99, carbs: 0.2, protein: 24, fat: 0.3, serving: 120, note: 'Cooked shrimp.', unit: 'grams' },
};

/** Keys ordered for display (longer/more specific forms after their stems). */
const FOOD_KEYS = Object.keys(FOOD_DB);

/**
 * Fuzzy food lookup: exact, prefix ("eggs" → "egg"), and short-reverse
 * ("choc" → "chocolate"). Returns null when nothing sensible matches — the
 * caller decides between suggesting or falling back to the generic estimate.
 */
export function matchFood(word: string): { key: string; info: FoodInfo } | null {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  if (FOOD_DB[w]) return { key: w, info: FOOD_DB[w] };
  for (const key of FOOD_KEYS) {
    // "eggs" -> "egg" via prefix; "chocolatey" -> "chocolate" only for
    // reasonably long words so short words don't fuzzy-match everything.
    if (w.startsWith(key) || (w.length >= 4 && key.startsWith(w))) return { key, info: FOOD_DB[key] };
  }
  return null;
}

export type FoodSuggestion = {
  key: string;
  name: string;
  info: FoodInfo;
};

/** Human label for a food key ("egg" → "Egg"). */
export function foodName(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Autocomplete: foods matching the query, best first. Exact and prefix
 * matches rank ahead of fuzzy ones; ties keep the library's order.
 * Returns at most `limit` items.
 */
export function searchFoods(query: string, limit = 5): FoodSuggestion[] {
  const w = query.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return [];
  const exact: FoodSuggestion[] = [];
  const prefix: FoodSuggestion[] = [];
  const fuzzy: FoodSuggestion[] = [];
  for (const key of FOOD_KEYS) {
    const info = FOOD_DB[key];
    if (key === w) exact.push({ key, name: foodName(key), info });
    else if (key.startsWith(w)) prefix.push({ key, name: foodName(key), info });
    else if (w.length >= 3 && (w.startsWith(key) || key.startsWith(w))) fuzzy.push({ key, name: foodName(key), info });
  }
  return [...exact, ...prefix, ...fuzzy].slice(0, limit);
}

/**
 * One-line quantity hint for a suggestion ("Egg · ~78 kcal each"). Honest
 * rounding: small foods per piece, others per typical serving.
 */
export function suggestionKcalHint(info: FoodInfo): string {
  if (info.unit === 'pieces') {
    const each = Math.round((info.per100 * info.serving) / 100);
    return `~${each} kcal each`;
  }
  const perServing = Math.round((info.per100 * info.serving) / 100);
  return `~${perServing} kcal per ${info.unit === 'cups' ? 'cup' : info.unit === 'slices' ? 'slice' : 'serving'}`;
}
