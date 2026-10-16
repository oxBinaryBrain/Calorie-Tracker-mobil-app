// Capture the README screenshots from the running Expo web build.
//
//   npm run start -- --web        # Metro on http://localhost:8081
//   node scripts/capture-screens.mjs
//
// The app is a single-page build with no URL linking: tab screens have to be
// opened by clicking their tab (earlier versions of this script went to
// /DiaryTab and silently captured Home five times over). Seeded data is
// generated relative to the day the script runs, because entries are filed by
// the local calendar day they were logged on.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = process.env.CAPTURE_BROWSER
  ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.CAPTURE_BASE_URL ?? 'http://localhost:8081';
const OUT = path.resolve('docs/screenshots');

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
/** ISO timestamp for a local wall-clock time today (or n days back). */
const at = (n, hour, minute = 0) => {
  const d = daysAgo(n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const food = (id, title, grams, calories, macros, loggedAt) => ({
  id,
  type: 'food',
  rawInput: title.toLowerCase(),
  title,
  grams,
  calories,
  carbs: macros[0],
  protein: macros[1],
  fat: macros[2],
  loggedAt,
});

const exercise = (id, title, burned, loggedAt) => ({
  id,
  type: 'exercise',
  rawInput: title.toLowerCase(),
  title,
  calories: 0,
  caloriesBurned: burned,
  loggedAt,
});

// Today plus the six days before it, so the week strip, the summary chart and
// the seven-day water history all have something to show.
const entries = [
  food('e1', 'Oatmeal and banana', 320, 380, [68, 12, 7], at(0, 8, 10)),
  food('e2', 'Greek yogurt', 170, 150, [9, 17, 5], at(0, 10, 45)),
  food('e3', 'Chicken rice bowl', 450, 640, [72, 44, 16], at(0, 13, 20)),
  exercise('e4', 'Ran 5k', 320, at(0, 18, 5)),
  food('e5', 'Salmon and greens', 380, 520, [22, 38, 28], at(0, 20, 10)),
  food('e6', 'Two eggs and toast', 210, 310, [26, 18, 14], at(1, 8, 30)),
  food('e7', 'Lentil soup and bread', 400, 470, [62, 21, 11], at(1, 13, 5)),
  food('e8', 'Pasta with tomatoes', 380, 610, [88, 20, 14], at(1, 19, 40)),
  food('e9', 'Porridge with berries', 300, 340, [58, 11, 6], at(2, 8, 15)),
  food('e10', 'Rice and beans', 420, 560, [86, 22, 9], at(2, 13, 30)),
  food('e11', 'Toast and peanut butter', 120, 340, [30, 12, 19], at(3, 9, 0)),
  food('e12', 'Vegetable curry', 430, 590, [78, 19, 20], at(3, 19, 15)),
  food('e13', 'Eggs and greens', 240, 300, [12, 22, 15], at(4, 8, 40)),
  exercise('e14', 'Walked 40 min', 180, at(4, 17, 30)),
  food('e15', 'Chicken salad', 350, 430, [24, 36, 18], at(5, 12, 50)),
  food('e16', 'Oatmeal and banana', 320, 380, [68, 12, 7], at(6, 8, 20)),
  food('e17', 'Salmon and greens', 380, 520, [22, 38, 28], at(6, 19, 55)),
];

const trackers = [0, 1, 2, 3, 4, 5, 6].map((n) => ({
  date: dayKey(daysAgo(n)),
  waterMl: [1250, 2100, 1800, 2400, 1600, 900, 1750][n],
  ...(n % 2 === 0 ? { weightKg: Number((70.4 + n * 0.1).toFixed(1)) } : {}),
  ...(n % 3 !== 2 ? { sleepHours: [7.5, 6.8, 8, 7.2, 6.5, 7.8, 7.1][n], sleepQuality: ['good', 'fair', 'good', 'good', 'poor', 'fair', 'good'][n] } : {}),
}));

const SEED = {
  'caloria.session.v1': '{"token":"mock-token","userId":"demo-user","email":"test@gmail.com"}',
  'caloria.onboarded.v1': '1',
  'caloria.targets.v1': '{"dailyCalories":2100,"carbsGrams":236,"proteinGrams":131,"fatGrams":70}',
  'caloria.profile.v1': '{"heightCm":170,"weightKg":56,"age":23,"sex":"male","activityLevel":"sedentary","goal":"gain","targetWeightKg":70}',
  'caloria.prefs.v1': '{"theme":"light"}',
  'caloria.entries.v1': JSON.stringify(entries),
  'caloria.trackers.v1': JSON.stringify(trackers),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Case-insensitive: some headings are uppercased by textTransform, which
// innerText reports transformed.
async function waitForText(page, text, timeout = 20000) {
  await page.waitForFunction(
    (needle) => document.body.innerText.toLowerCase().includes(needle.toLowerCase()),
    { timeout },
    text,
  ).catch(() => console.warn(`  (timed out waiting for "${text}")`));
}

async function clickTab(page, label) {
  const clicked = await page.evaluate((name) => {
    const tab = [...document.querySelectorAll('[role="tab"]')].find((el) =>
      (el.textContent || '').trim().endsWith(name),
    );
    if (!tab) return false;
    tab.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`no tab button labelled ${label}`);
  await sleep(700);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--window-size=380,860', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });

  // First load lets the origin exist, then seed and reload into the tabs.
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await page.evaluate((seed) => {
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, SEED);
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await waitForText(page, 'kcal');
  await sleep(2500);

  const shot = async (name, expect) => {
    if (expect) await waitForText(page, expect);
    await sleep(900);
    await page.screenshot({ path: path.join(OUT, name) });
    console.log('captured', name);
  };

  await shot('home.png', 'Today');
  await clickTab(page, 'Diary');
  await shot('diary.png', 'Recent days');
  await clickTab(page, 'Trackers');
  await shot('trackers.png', 'Gentle trackers');
  await clickTab(page, 'Summary');
  await shot('summary.png', 'Weekly average');
  await clickTab(page, 'Account');
  await shot('account.png', 'Your details');

  // Confirm entries: type a sentence, run the parse, capture the review screen.
  await clickTab(page, 'Home');
  await sleep(600);
  await page.evaluate(() => {
    const el = document.querySelector('input, textarea');
    if (el) {
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement : window.HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
      setter?.call(el, 'grilled chicken salad and a black coffee');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await sleep(500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      (b.getAttribute('aria-label') || '').includes('Log what you typed'),
    );
    btn?.click();
  });
  await shot('confirm-entries.png', 'Confirm entries');

  // Login: no session, so the auth stack renders. Restored by the next run's seed.
  await page.evaluate(() => localStorage.removeItem('caloria.session.v1'));
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await shot('login.png', 'Welcome back');

  await browser.close();
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
