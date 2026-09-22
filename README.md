# Caloria

An AI-powered food and exercise diary for iOS and Android. Log meals with a
sentence or a photo; an itemized calorie/macro breakdown comes back for you to
confirm and save. Calm by design: no streaks, no red warnings, no shaming
copy — just a clear, neutral picture of your day.

Built with Expo (managed workflow) + TypeScript.

## Run it

```bash
npm install
npm start          # then press i (iOS) / a (Android) or scan with Expo Go
```

No backend needed to try it — a built-in mock API parses entries locally.
Copy `.env.example` to `.env` to configure a real API or RevenueCat keys.

## What works out of the box

- **Text logging** — type "two eggs and toast" on the Home bar, confirm the
  itemized cards, save. Two taps from thought to saved.
- **Photo logging** — camera or gallery, compressed before the parse request,
  same confirm step.
- **Edit / re-analyze / delete** any entry.
- **Diary** — calendar of logged days with a day detail view.
- **Trackers** — water quick-adds, weight trend chart, sleep hours + quality.
- **Weekly summary** — stat tiles and a bar chart of the week's calories.
- **Account** — profile, editable targets, paywall, settings (units, reminder).
- **Light & dark mode**, following the OS.

## Architecture

```
src/
  api/        ApiClient contract; HttpApi (real) + MockApi (local) implementations
  db/         expo-sqlite repositories — the sync-ready persistence boundary
  services/   Mifflin-St Jeor preview, RevenueCat wrapper, notifications
  stores/     zustand: session, preferences, toasts
  hooks/      react-query hooks over the repos
  theme/      light/dark Paper themes; no alarm red anywhere
  screens/    auth, onboarding, home, logging, entries, diary, trackers, summary, account
  components/ shared UI (calorie ring, macro bars, entry list, ...)
  types/      shared TypeScript contracts
docs/BACKEND.md  exact endpoints + the server-side parse prompt
```

Swap the mock for a real backend by setting `EXPO_PUBLIC_API_BASE_URL` — see
`docs/BACKEND.md` for the full contract. All LLM calls belong server-side.

## Design principles

- **Describe, don't judge.** Over target reads as "2,300 of 2,100 today" in a
  muted tone — never a warning, never red.
- **No gamification.** No streaks, no badges, no guilt.
- **Speed is the product.** Logging is the shortest possible flow.
