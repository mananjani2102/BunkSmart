# BunkSmart

BunkSmart tracks your class attendance per subject against a target percentage you choose. It calculates how many upcoming classes you can still skip, or how many you must attend in a row, to stay at your target.

## How the numbers work

Subject percentages count only the classes marked in BunkSmart plus any starting counts the student enters. When a college overall number is entered, the overall number is that college figure plus the classes marked after the chosen date; otherwise, the overall number sums the tracked subjects.

Each subject tracks attended classes (`A`), held classes (`H`), and a target percentage (`T`, from 50 to 95). Cancelled classes are recorded in your history and totals, but they never count toward held classes.

When your attendance is at or above target (`100 * A >= T * H`):

```text
skip = floor((100 * A - T * H) / T)
```

When your attendance is below target (`100 * A < T * H`):

```text
attend = ceil((T * H - 100 * A) / (100 - T))
```

Example: with 18 attended out of 22 held classes and a 75 percent target, `100 * 18 - 75 * 22 = 1800 - 1650 = 150`, and `floor(150 / 75) = 2`. You can skip 2 classes and still stay at 75 percent (18 of 24).

## Features

- Email and password sign up, login, and sign out backed by Supabase Auth.
- Subject management with per-subject target percentages and optional starting attended and held counts.
- Weekly timetable organized by weekday with start and optional end times, plus timetable import from pasted text.
- Optional past attendance entry, either by entering known attended and held counts or by estimating from the timetable and missed classes.
- Daily attendance marking on Today (present, absent, or cancelled), with whole-day quick actions (all present, all absent, holiday, clear day), date navigation, a go-to-date option, and tap-again to clear.
- Overview dashboard showing an overall number that can start from your college portal figure (or sum tracked classes), today's unmarked count, subjects below target, and per-subject progress rings.
- Subject detail view with skip or recovery guidance, present/absent/cancelled totals, attendance trend chart, and filterable log history.
- What-if simulator (both per-subject and standalone) to test skipping or attending upcoming classes before they happen.
- Local class reminders scheduled on the device before scheduled timetable slots, with configurable lead time.
- Profile settings for default target percentage, appearance mode (system, light, or dark), Privacy Policy and Terms and Conditions, and deleting all attendance data.
- Monochrome light (`#FCFCFC`) and dark (`#000000`) themes following system appearance by default, rendered with the Geist font family (`Geist-Regular`, `Geist-Medium`, `Geist-SemiBold`).
- Fast local-first feedback with a shared-driver skeleton loader (shown only after 200 ms), undoable snackbar notifications for class and whole-day actions, and targeted haptic feedback on supported devices.

## Tech stack

- Expo (SDK 58), React Native, TypeScript (strict mode)
- Expo Router for file-based navigation
- Supabase (Auth and Postgres with row level security)
- `expo-notifications` for local device reminders
- `react-native-svg` for progress rings and trend charts
- EAS Build for installable Android APK builds

## Project structure

```text
app.json                  Expo app configuration
eas.json                  EAS Build profile for Android APK
metro.config.js           Metro bundler configuration
supabase/schema.sql       Postgres tables, view, trigger, and RLS policies
scripts/                  Math verification and repository audit scripts
docs/                     Project rules, data model, theme, performance, and architecture notes
assets/fonts/             Bundled Geist static font files (Regular, Medium, SemiBold)
src/app/                  Expo Router screens and layouts
src/components/           Feature components, skeleton layouts, and UI primitives
src/constants/            In-app Privacy Policy and Terms copy
src/context/              Auth, data, reminder, and snackbar providers
src/data/                 Supabase query and mutation helpers
src/lib/                  Attendance math, date helpers, error mapping, haptics, motion, reminders
src/theme/                Color, spacing, radius, navigation, and typography tokens
src/types/                Database and asset TypeScript types
```

## Run locally

1. Install Node 22.13 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your Supabase project URL (`EXPO_PUBLIC_SUPABASE_URL`) and publishable key (`EXPO_PUBLIC_SUPABASE_KEY`).
4. Open the Supabase SQL Editor for your project, run `supabase/schema.sql`, and then also run the Migration 2 section of the same file.
5. In the Supabase dashboard, open **Authentication**, **Sign In / Providers**, **Email**, and turn off **Confirm email**.
6. Start the development server:

   ```bash
   npx expo start
   ```

7. Open the app in Expo Go (SDK 58).

Notes:
- Appearance follows your device theme (`system`) by default, and can be switched between **System**, **Light**, and **Dark** in **Profile**.
- Typography uses the Geist font files bundled in `assets/fonts/` under its open license, loaded at startup with `expo-font`.

## Build the APK

1. Sign in to Expo Application Services:

   ```bash
   eas login
   ```

2. Replace the placeholder values in `eas.json` with your Supabase project URL and publishable key, then run:

   ```bash
   eas build --platform android --profile preview
   ```

## Known limitations

- Timetable estimates do not know about holidays or cancelled classes, so adjust estimated held counts manually when needed.
- Past dates on the Today screen display your current timetable rather than a historical snapshot of past timetable changes.
- Class reminders are scheduled locally on one device only and do not sync across devices.
- Free Supabase projects pause automatically after a week of inactivity.

## Privacy and terms

The Privacy Policy and Terms and Conditions are available inside the app under **Profile**.
