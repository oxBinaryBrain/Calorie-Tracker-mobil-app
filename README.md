<p align="center">
  <img src="assets/icon.png" width="72" alt="Caloria icon" />
</p>

<h1 align="center">Caloria</h1>

<p align="center">
  <strong>An AI food and exercise diary that turns a sentence into a logged meal.</strong>
</p>

<p align="center">
  Built with Expo, React Native, and TypeScript. Log meals with one sentence or a
  photo, confirm the itemized calorie and macro breakdown, and save. Runs fully
  offline against a built-in mock API — no backend needed to try it. Calm by
  design: no streaks, no red warnings, no shaming copy.
</p>

<p align="center">
  <img src="docs/screenshots/login.png" width="190" alt="Login screen" />
  <img src="docs/screenshots/home.png" width="190" alt="Home screen" />
  <img src="docs/screenshots/confirm-entries.png" width="190" alt="Confirm entries screen" />
  <img src="docs/screenshots/summary.png" width="190" alt="Weekly summary screen" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.86-000000?logo=react&logoColor=white" alt="React Native 0.86" />
  <img src="https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white" alt="Expo SDK 57" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <img src="https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-5B5F64" alt="Platform iOS, Android, Web" />
  <img src="https://img.shields.io/badge/license-MIT-2EA44F" alt="License MIT" />
</p>

---

## Features

**Text and photo logging**

Type "two eggs, toast and a latte" on the Home bar, or snap a photo of your
plate — compressed before the parse request. Either way you get itemized cards
with calories, carbs, protein, and fat. Every number is editable before you
save. Two taps from thought to saved.

![Confirm entries screen](docs/screenshots/confirm-entries.png)

**Edit, re-analyze, delete**

Open any entry to adjust its numbers, re-run the parse on new input, or remove
it. Nothing is locked once saved.

**Diary**

A month calendar marks days with entries. Tap a day for its detail view with
meals, movement, and tracker notes.

![Diary screen](docs/screenshots/diary.png)

**Trackers**

Water with one-tap amounts, weight with a trend chart, sleep with hours and
quality. Everything is optional and nothing nags.

![Trackers screen](docs/screenshots/trackers.png)

**Weekly summary**

Stat tiles and a calories-by-day bar chart for the week, with your target as a
faint reference line — not a ceiling. A week-over-week comparison sits below.

![Weekly summary screen](docs/screenshots/summary.png)

**Account**

Profile, editable calorie and macro targets, the Pro paywall, and settings for
units and the daily reminder. Light and dark mode follow the OS or can be set
explicitly.

![Account screen](docs/screenshots/account.png)

**Meal templates**

Save a day's meals as a template and reuse it on days you eat the same thing.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Language | TypeScript (strict) |
| Navigation | React Navigation 7 (bottom tabs + native stacks) |
| Server state | TanStack React Query 5 |
| Client state | Zustand 5 |
| UI | React Native Paper (MD3), Poppins type |
| Persistence | expo-sqlite on native, AsyncStorage on web |
| Payments | RevenueCat (simulated paywall without keys) |
| Tests | Vitest |

## Project structure

```
src/
  api/          ApiClient contract; HttpApi (real) + MockApi (local)
  db/           expo-sqlite repositories — the persistence boundary
  services/     Mifflin-St Jeor targets, RevenueCat, notifications, food DB
  stores/       zustand: session, preferences, toasts
  hooks/        react-query hooks over the repos
  theme/        light/dark Paper themes; no alarm red anywhere
  screens/      auth, onboarding, home, logging, diary, trackers, summary, account
  components/   shared UI (calorie ring, macro tiles, entry list)
  types/        shared TypeScript contracts
docs/BACKEND.md   exact endpoints and the server-side parse prompt
```

## Run it

```bash
npm install
npm start
```

Then press `i` for the iOS simulator, `a` for Android, or scan the QR code with
Expo Go. For the web build:

```bash
npm start -- --web
```

Metro serves on `http://localhost:8081`. No backend is needed — the mock API
parses entries locally.

## Configuration

Copy `.env.example` to `.env` and fill in what you need:

```
EXPO_PUBLIC_API_BASE_URL=        # leave empty for the built-in mock API
EXPO_PUBLIC_REVENUECAT_IOS_KEY=  # leave empty for the simulated paywall
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=
```

Setting `EXPO_PUBLIC_API_BASE_URL` switches the whole app to the HTTP client;
the exact request and response shapes are in
[`docs/BACKEND.md`](docs/BACKEND.md). All LLM calls belong server-side.

## Tests

```bash
npm test
```

Vitest covers the parser and the target calculations.

## Design principles

- **Describe, don't judge.** Over-target reads as "2,300 of 2,100 today" in a
  muted tone — never a warning, never red.
- **No gamification.** No streaks, no badges, no guilt.
- **Speed is the product.** Logging is the shortest possible flow.

## License

See [LICENSE](LICENSE).
