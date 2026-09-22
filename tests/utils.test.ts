import { describe, expect, it } from 'vitest';
import { addDays, clamp, dateFromKey, dateKey, formatDuration, formatGrams, formatKcal, formatMl, greeting, monthKeyOf, toNum } from '../src/utils';

describe('dateKey / dateFromKey', () => {
  it('formats local time as YYYY-MM-DD with zero padding', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('round-trips through dateFromKey at local midnight', () => {
    const d = dateFromKey('2026-09-22');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(22);
    expect(d.getHours()).toBe(0);
    expect(dateKey(d)).toBe('2026-09-22');
  });
});

describe('addDays', () => {
  it('adds and subtracts within a month', () => {
    expect(addDays('2026-09-15', 1)).toBe('2026-09-16');
    expect(addDays('2026-09-15', -1)).toBe('2026-09-14');
    expect(addDays('2026-09-15', 0)).toBe('2026-09-15');
  });

  it('crosses month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap years', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('monthKeyOf', () => {
  it('snaps any day to the first of its month', () => {
    expect(monthKeyOf('2026-09-22')).toBe('2026-09-01');
    expect(monthKeyOf('2026-12-31')).toBe('2026-12-01');
    expect(monthKeyOf('2026-01-01')).toBe('2026-01-01');
  });
});

describe('formatKcal', () => {
  it('rounds to a whole number', () => {
    expect(formatKcal(78)).toBe('78');
    expect(formatKcal(1234.4)).toBe(Math.round(1234.4).toLocaleString());
  });
});

describe('formatGrams', () => {
  it('rounds and appends the unit', () => {
    expect(formatGrams(155.4)).toBe('155 g');
    expect(formatGrams(155.6)).toBe('156 g');
    expect(formatGrams(0)).toBe('0 g');
  });

  it('returns null for missing or invalid values', () => {
    expect(formatGrams(null)).toBeNull();
    expect(formatGrams(undefined)).toBeNull();
    expect(formatGrams(Number.NaN)).toBeNull();
  });
});

describe('formatMl', () => {
  it('keeps millilitres below one litre', () => {
    expect(formatMl(0)).toBe('0 ml');
    expect(formatMl(250)).toBe('250 ml');
    expect(formatMl(999)).toBe('999 ml');
  });

  it('switches to litres at 1000 ml, whole when exact', () => {
    expect(formatMl(1000)).toBe('1 L');
    expect(formatMl(2000)).toBe('2 L');
    expect(formatMl(1500)).toBe('1.5 L');
    expect(formatMl(2500)).toBe('2.5 L');
  });
});

describe('toNum', () => {
  it('parses finite numbers from strings and numbers', () => {
    expect(toNum('42')).toBe(42);
    expect(toNum(3.5)).toBe(3.5);
    expect(toNum(0)).toBe(0);
    expect(toNum('0')).toBe(0);
  });

  it('returns undefined for missing or non-finite values', () => {
    expect(toNum(undefined)).toBeUndefined();
    expect(toNum(null)).toBeUndefined();
    expect(toNum('abc')).toBeUndefined();
    expect(toNum(Number.NaN)).toBeUndefined();
    expect(toNum(Infinity)).toBeUndefined();
  });
});

describe('clamp', () => {
  it('bounds a value between min and max', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('formatDuration', () => {
  it('formats minutes under an hour', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(45)).toBe('45 min');
  });

  it('formats hours with a minute remainder', () => {
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(80)).toBe('1 h 20 min');
    expect(formatDuration(1440)).toBe('24 h');
  });
});

describe('greeting', () => {
  const at = (hour: number) => new Date(2026, 8, 22, hour, 0, 0);

  it('picks the label for each time-of-day band', () => {
    expect(greeting(at(3))).toBe('Late night');
    expect(greeting(at(5))).toBe('Good morning');
    expect(greeting(at(11))).toBe('Good morning');
    expect(greeting(at(12))).toBe('Good afternoon');
    expect(greeting(at(17))).toBe('Good afternoon');
    expect(greeting(at(18))).toBe('Good evening');
    expect(greeting(at(23))).toBe('Good evening');
  });
});
