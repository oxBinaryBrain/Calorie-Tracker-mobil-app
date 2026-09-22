import { describe, expect, it } from 'vitest';
import { estimateEntries } from '../src/api/mock';
import { matchFood, searchFoods, suggestionKcalHint } from '../src/services/foodDb';

describe('estimateEntries — foods', () => {
  it('parses a simple single food with its serving assumption', () => {
    const [egg] = estimateEntries('an egg');
    expect(egg.type).toBe('food');
    expect(egg.title.toLowerCase()).toContain('egg');
    expect(egg.grams).toBe(50);
    expect(egg.calories).toBe(78); // 155 × 50 / 100
    expect(egg.note.toLowerCase()).toContain('one large egg');
  });

  it('parses number-word quantities ("two eggs")', () => {
    const [eggs] = estimateEntries('two eggs');
    expect(eggs.grams).toBe(100); // 50 g serving × 2
    expect(eggs.calories).toBe(155);
  });

  it('parses gram quantities ("200g rice")', () => {
    const [rice] = estimateEntries('200g rice');
    expect(rice.grams).toBe(200);
    expect(rice.calories).toBe(260); // 130 × 200 / 100
    expect(rice.carbs).toBe(56);
  });

  it('splits multi-item clauses and keeps per-item titles', () => {
    const entries = estimateEntries('two eggs, toast and a latte');
    expect(entries.length).toBe(3);
    const titles = entries.map((e) => e.title.toLowerCase());
    expect(titles.some((t) => t.includes('egg'))).toBe(true);
    expect(titles.some((t) => t.includes('toast'))).toBe(true);
    expect(titles.some((t) => t.includes('latte'))).toBe(true);
  });

  it('never produces zero items — unknown input falls back honestly', () => {
    const [fallback] = estimateEntries('something completely unrecognizable');
    expect(fallback.type).toBe('food');
    expect(fallback.calories).toBeGreaterThan(0);
    expect(fallback.note.toLowerCase()).toContain('adjust');
  });
});

describe('estimateEntries — exercise', () => {
  it('estimates burn from METs, a 70 kg body, and duration', () => {
    const [run] = estimateEntries('ran 30 minutes');
    expect(run.type).toBe('exercise');
    expect(run.caloriesBurned).toBe(360); // 9.8 × 3.5 × 70 / 200 × 30 = 360.15
    expect(run.title).toContain('Run');
    expect(run.title).toContain('30 min');
  });

  it('maps irregular verbs ("swam" → Swim)', () => {
    const [swim] = estimateEntries('swam for 1 hour');
    expect(swim.type).toBe('exercise');
    expect(swim.caloriesBurned).toBe(610); // 8.3 × 3.5 × 70 / 200 × 60 = 610.05
  });

  it('defaults to 30 minutes when no duration is given', () => {
    const [yoga] = estimateEntries('yoga');
    expect(yoga.caloriesBurned).toBe(92); // 2.5 × 3.5 × 70 / 200 × 30 = 91.875
  });
});

describe('estimateEntries — notes stay gentle', () => {
  it('never emits judgmental or warning language', () => {
    const banned = /warn|caution|careful|bad|unhealthy|too much|should not/i;
    const samples = ['two eggs toast and a latte', 'pizza and beer', 'ran 45 minutes', '200g chocolate'];
    for (const s of samples) {
      for (const e of estimateEntries(s)) {
        expect(e.note ?? '').not.toMatch(banned);
      }
    }
  });
});

describe('foodDb — search & match', () => {
  it('matches exact, prefix, and short-reverse queries', () => {
    expect(matchFood('egg')?.key).toBe('egg');
    expect(matchFood('eggs')?.key).toBe('eggs'); // its own entry now
    expect(matchFood('choc')?.key).toBe('chocolate'); // short reverse
    expect(matchFood('zzzz')).toBeNull();
  });

  it('ranks exact matches first and respects the limit', () => {
    const hits = searchFoods('egg', 5);
    expect(hits[0].key).toBe('egg');
    expect(hits.length).toBeLessThanOrEqual(5);
  });

  it('returns no suggestions for an empty query', () => {
    expect(searchFoods('')).toEqual([]);
    expect(searchFoods('   ')).toEqual([]);
  });

  it('formats kcal hints per piece or per serving', () => {
    expect(suggestionKcalHint(matchFood('egg')!.info)).toContain('kcal each');
    expect(suggestionKcalHint(matchFood('rice')!.info)).toContain('per cup');
    expect(suggestionKcalHint(matchFood('bread')!.info)).toContain('per slice');
  });
});
