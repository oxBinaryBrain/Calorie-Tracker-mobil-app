# Caloria — Backend contract

The app ships with a built-in **mock API** (`src/api/mock.ts`) so every flow
works with no server. Point it at a real backend by setting:

```
EXPO_PUBLIC_API_BASE_URL=https://api.example.com
```

The HTTP client (`src/api/http.ts`) sends `Authorization: Bearer <token>` on
every request after login/signup. All endpoints are `POST` and return JSON.

---

## Auth

### `POST /auth/login`
Request: `{ "email": string, "password": string }`
Response: `{ "token": string, "userId": string, "email": string }`

### `POST /auth/signup`
Same shape as login. Creates the account and returns a session.

### `POST /auth/forgot-password`
Request: `{ "email": string }` — Response: `200 {}` (sends email out of band).

---

## Onboarding & targets

### `POST /onboarding`
Request:

```json
{
  "heightCm": 175,
  "weightKg": 70,
  "age": 30,
  "sex": "female" | "male" | "other",
  "activityLevel": "sedentary" | "light" | "moderate" | "active" | "athlete",
  "goal": "lose" | "maintain" | "gain",
  "targetWeightKg": 65
}
```

Response: `{ "targets": { "dailyCalories": 2100, "carbsGrams": 230, "proteinGrams": 120, "fatGrams": 70 } }`

The client shows a **Mifflin-St Jeor preview** while this request is in flight,
but the server response is the source of truth and replaces the preview.

### `POST /targets`
Request: any subset of `{ dailyCalories, carbsGrams, proteinGrams, fatGrams }`.
Response: the full updated `UserTargets` object.

---

## AI parsing

### `POST /entries/parse`
Request: `{ "input": string }` — a plain-language sentence.
Response:

```json
{
  "entries": [
    {
      "type": "food" | "exercise",
      "title": "string",
      "grams": 150,
      "calories": 248,
      "carbs": 0,
      "protein": 47,
      "fat": 5,
      "caloriesBurned": null,
      "note": "one short plain-language sentence"
    }
  ]
}
```

### `POST /entries/parse-photo`
Request: `{ "photoBase64": string }` (JPEG, already resized/compressed client-side).
Response: same shape as `/entries/parse`.

### Server-side prompt

The endpoints should send this prompt to whichever LLM the backend uses —
never call an LLM from the client with an embedded key:

```
You are a nutrition and exercise entry parser. The user will describe what they
ate and/or a physical activity they did, either as text or alongside a photo of
a plate of food. Break the input into one entry per distinct food item or
activity. Return ONLY valid JSON matching this shape, with no prose before or
after:

{
  "entries": [
    {
      "type": "food" | "exercise",
      "title": string,
      "grams": number | null,
      "calories": number,
      "carbs": number | null,
      "protein": number | null,
      "fat": number | null,
      "caloriesBurned": number | null,
      "note": string
    }
  ]
}

Rules:
- For "food" entries, estimate grams, calories, carbs, protein and fat for the
  portion described or shown. If no quantity is given, assume a typical single
  serving and say so in "note".
- For "exercise" entries, estimate caloriesBurned based on the activity and
  duration mentioned; leave grams/carbs/protein/fat null.
- "note" is one short, plain-language sentence about the entry. Never use
  scoring language, warnings, or guilt-inducing phrasing (no "bad",
  "unhealthy", "you should avoid", etc.) — describe, don't judge.
- If the input mentions both food and an activity, return separate entries for
  each, correctly typed.
- If a photo is provided, identify each distinct food item visible and estimate
  its portion size in grams from the image.
```

---

## Notes

- The client stores everything locally (expo-sqlite) as well; the backend is
  free to be stateless per-request (auth + parse only) or to add sync.
- Error responses should be `{ "message": string }` with a 4xx/5xx status; the
  client surfaces `message` verbatim.
