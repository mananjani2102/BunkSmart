# BunkSmart

BunkSmart tracks class attendance per subject against your target percentage and calculates how many upcoming classes you can skip or must attend in a row.

[Screenshots](#screenshots) | [Download](#download-and-demo) | [Features](#features) | [How it works](#how-the-numbers-work) | [Getting started](#getting-started)

## Screenshots

| <img src="docs/screenshots/01-overview.jpg" width="240" alt="Overview screen" /> | <img src="docs/screenshots/02-today.jpg" width="240" alt="Today screen" /> | <img src="docs/screenshots/07-subjects.jpg" width="240" alt="Subjects screen" /> |
| :---: | :---: | :---: |
| Overview dashboard | Today attendance marking | Subjects list |
| <img src="docs/screenshots/05-timetable.jpg" width="240" alt="Timetable screen" /> | <img src="docs/screenshots/08-profile.jpg" width="240" alt="Profile screen" /> | <img src="docs/screenshots/04-what-if.jpg" width="240" alt="What-if simulator screen" /> |
| Weekly timetable | Profile and settings | What-if simulator |

## Download and demo

Download the Android preview build to try BunkSmart on a physical Android device:

[Download Android APK](https://github.com/mananjani2102/BunkSmart/releases/download/v1.0.0/BunkSmart-v1.0.0.apk)

[Alternative link (may expire)](https://expo.dev/artifacts/eas/qai9_SRMkO6XgheR2ggHKNREMZMo8fZ-G5eUZWev7tI.apk)

On Android, allow installs from unknown sources when prompted before opening the APK.

You can sign in immediately using the demo account below or create a new account in the app:

| Field | Value |
| --- | --- |
| Email | `demo@bunksmart.app` |
| Password | `BunkSmart@2026` |

This is a shared account used for demonstration, and its data may be reset at any time.

## Overview

If your college portal shows only an overall attendance percentage, you cannot see how many classes you can skip in each subject before dropping below your required threshold. Calculating those skip limits manually across different weekly schedules and cancelled classes quickly becomes error-prone.

BunkSmart tracks each subject against its own target percentage. The app never connects to any college system, and you can enter your portal's overall attended and held counts once, as numbers, so the overall figure matches the portal. When you mark a class, the app updates the screen immediately and syncs your records in the background over an active network connection.

## Features

### Tracking

- Mark each scheduled class as present, absent, or cancelled with one tap, or tap the active status again to clear it.
- Mark a whole day at once (all present, all absent, holiday, or clear day) with an undo option if you tap by mistake.
- Navigate to earlier dates or jump straight to a typed date to log or edit past days.
- Enter your college portal's overall attended and held counts up to a chosen date so your overall matches from day one.
- Add past subject counts directly or estimate held and attended counts from your weekly timetable.

### Planning

- See how many upcoming classes you can skip, or must attend in a row, for each subject target from 50% to 95%.
- Test skip and attend choices in the What-if simulator before skipping a class.
- Paste plain-text schedules into the timetable importer to create subjects and weekly classes in one step.
- Manage your weekly schedule by day with start times and optional end times.

### Insights

- Check your overall percentage, today's unmarked count, upcoming class preview, and subjects sorted by urgency on Overview.
- Filter subjects to show only those below target when you track more than eight subjects.
- Open any subject to review attended, held, and cancelled totals, a percentage trend chart, and month-grouped history.
- Spot your current or next class on Today with live status badges.

### Settings and experience

- Choose a default target percentage (50% to 95%) for new subjects and override targets per subject.
- Enable local class reminders 5, 10, 15, or 30 minutes before scheduled classes (tested on Android only).
- Switch between System, Light, and Dark monochrome themes at any time.
- View the Privacy Policy and Terms and Conditions, or delete all attendance data while keeping your account.

## How the numbers work

### Subject percentage

Each subject tracks attended classes (`A`), held classes (`H`), and a target percentage (`T`, from `50` to `95`). Cancelled classes are recorded in your subject totals and history, but they are never counted as held and never counted as attended.

When `H` is `0`, no percentage or allowance is shown yet. When `H > 0` and your attendance meets or exceeds the target (`100 * A >= T * H`), the skip allowance in [`src/lib/attendance.ts`](src/lib/attendance.ts) is:

```text
skip = floor((100 * A - T * H) / T)
```

When `H > 0` and your attendance is below the target (`100 * A < T * H`), the number of consecutive classes you must attend to recover is:

```text
need = T * H - 100 * A
denominator = 100 - T
attend = ceil(need / denominator)
```

In [`src/lib/attendance.ts`](src/lib/attendance.ts), this ceiling division is computed using whole numbers only.

Worked examples at a 75% target:

- **Skipping**: With `18` attended of `22` held (`81.8%`), `100 * 18 - 75 * 22 = 150`, and `floor(150 / 75) = 2`. You can skip `2` classes (`18` of `24` is `75%`) and stay on target.
- **Recovering**: With `15` attended of `22` held (`68.1%`), `need = 75 * 22 - 100 * 15 = 150` and `denominator = 25`, giving `ceil(150 / 25) = 6`. Attending the next `6` classes in a row brings you to `21` of `28`, which is `75%`.

### Overall percentage

In **college figure mode**, used when you enter a college overall count (`baseline_held > 0`) and a cutoff date (`baseline_date`), [`src/lib/overall.ts`](src/lib/overall.ts) starts from your entered attended and held counts and adds only `present` and `absent` logs dated strictly after the cutoff date. Classes marked on or before the cutoff date still count inside each subject, not again in overall, and cancelled classes are never added. For example, `96` attended of `120` held up to the cutoff date, followed by `5` present and `1` absent afterwards, gives `101` attended of `126` held (`80.1%`).

In **tracked mode**, used when no college baseline is set (`baseline_held` is `0` or `baseline_date` is empty), overall attendance sums `attended` and `held` across all tracked subjects, including each subject's starting counts and marked classes.

### Precision

Percentages shown on screen are calculated in integer tenths using `floor((A * 1000) / H)` and truncated to one decimal place (dropping `.0` on whole percentages). Because values are truncated rather than rounded, an attendance ratio below target such as `749` of `1000` displays as `74.9%` and never appears as `75%`. All target checks, skip counts, and recovery counts use whole-number arithmetic so floating-point errors cannot change a boundary result.

### What-if simulator

The What-if simulator in [`src/components/WhatIfSimulator.tsx`](src/components/WhatIfSimulator.tsx) projects upcoming attendance before you skip a class. It prefills the upcoming class count from the next 7 days of your timetable for that subject (or `4` when no slots exist, adjustable from `0` to `60`), lets you choose how many classes to skip, adds `(upcoming - skip)` to attended and `upcoming` to held, and displays the projected percentage, points difference, and updated skip or recovery target.

## Tech stack

Versions below come directly from [`package.json`](package.json) and [`app.json`](app.json).

| Area | Technology | Purpose |
| --- | --- | --- |
| Framework | Expo SDK 58 (`expo` `~58.1.0`) | Managed React Native runtime, asset loading, and Expo Go support |
| UI runtime | React Native `0.88.1`, React `19.3.0` | Built and tested on Android with New Architecture enabled |
| Language | TypeScript `~6.0.3` | Strict static typing across screens, state, and database rows |
| Navigation | Expo Router `~58.0.33` | File-based stack, modal, protected auth, and tab routes under `src/app` |
| Backend | `@supabase/supabase-js` `^2.119.0` | Email/password authentication and Postgres data access with RLS |
| Graphics | `react-native-svg` `15.16.0` | Circular progress rings and per-subject attendance trend charts |
| Notifications | `expo-notifications` `~58.1.10` | Weekly local class reminders (tested on Android only) |
| Haptics | `expo-haptics` `~58.0.8` | Tactile feedback on attendance marks and destructive confirmations |
| Builds | EAS Build (`eas.json` `preview` profile) | Cloud Android APK generation for internal distribution |
| Typography | Geist via `expo-font` `~58.0.12` | Static `Geist-Regular`, `Geist-Medium`, and `Geist-SemiBold` font weights |

## Architecture

Screens in [`src/app`](src/app) never call Supabase directly. Instead, [`src/app/_layout.tsx`](src/app/_layout.tsx) mounts split providers from [`src/context`](src/context) (`AuthProvider`, `DataProvider`, `RemindersProvider`, and `SnackbarProvider`) so screens subscribe only to the state slices or stable action hooks they need. When a student marks a class or edits a subject, `DataProvider` updates local React state and cached `AsyncStorage` snapshots immediately, then dispatches the database call through typed helpers in [`src/data`](src/data).

The data modules (`subjects.ts`, `slots.ts`, and `logs.ts`) and `AuthProvider` share the single client configured in [`src/lib/supabase.ts`](src/lib/supabase.ts). Supabase Auth manages sessions and user metadata, while Postgres enforces per-user ownership on every query through row level security and maps database errors to readable messages via [`src/lib/errors.ts`](src/lib/errors.ts).

```mermaid
flowchart LR
  Screens["Screens (src/app)"] --> Providers["Context providers (src/context)"]
  Providers --> DataLayer["Data layer (src/data)"]
  Providers --> Auth["Supabase Auth"]
  DataLayer --> Postgres["Supabase Postgres (row level security)"]
  Auth --> Postgres
```

Important directories and files in the repository:

```text
app.json                  Expo config, icons, splash screens, and Android settings
eas.json                  EAS Build preview profile for Android APK builds
package.json              Dependencies and verification scripts
supabase/schema.sql       Postgres schema, view, triggers, RLS policies, and grants
scripts/                  Math, date, and parser verification scripts plus repo audit
docs/                     Architecture, data model, theme, performance, rules, and screenshots
assets/fonts/             Bundled Geist static font files (Regular, Medium, SemiBold)
assets/images/            App icon, adaptive foreground, splash, and notification icon
src/app/                  Expo Router screens, tabs, auth flow, and modal forms
src/components/           Feature views, skeletons, and reusable UI primitives
src/constants/            In-app Privacy Policy and Terms and Conditions text
src/context/              Split Auth, Data, Reminders, and Snackbar providers
src/data/                 Typed Supabase CRUD and aggregation helpers
src/lib/                  Math engine, overall logic, dates, parser, errors, reminders
src/theme/                Monochrome light/dark tokens, theme provider, navigation options
src/types/                Database row interfaces and asset declarations
```

## Database

Schema definitions live in [`supabase/schema.sql`](supabase/schema.sql), and field constraints are documented in [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

| Object | Kind | Purpose |
| --- | --- | --- |
| `profiles` | Table | Stores per-user `full_name`, `default_target` (50 to 95), and optional college baseline counts (`baseline_attended`, `baseline_held`, `baseline_date`) |
| `subjects` | Table | Stores tracked courses, unique case-insensitive names per user, targets, and starting counts |
| `timetable_slots` | Table | Stores weekly class slots (`weekday` 1 to 7, `start_time`, optional `end_time`) |
| `attendance_logs` | Table | Stores daily `present`, `absent`, or `cancelled` records keyed by local `log_date` and `slot_id` |
| `subject_stats` | View | Aggregates `attended`, `conducted` (excluding `cancelled`), and `cancelled` per subject with `security_invoker = true` |
| `on_auth_user_created` and `set_updated_at` | Triggers | Creates a `profiles` row on sign-up via `handle_new_user()` and keeps `updated_at` current on updates |
| `profiles_*_own`, `subjects_own`, `timetable_slots_own`, `attendance_logs_own` | RLS policies | Restricts authenticated queries and writes so users access only rows matching `auth.uid()` |

## Technical decisions

- **Whole-number attendance math**: [`src/lib/attendance.ts`](src/lib/attendance.ts) uses integer boundary checks (`100 * A >= T * H`) and truncates display percentages to tenths so rounding cannot flip a target result.
- **Local calendar dates**: [`src/lib/dates.ts`](src/lib/dates.ts) builds `YYYY-MM-DD` strings from local `Date` components instead of `toISOString` so midnight timezone offsets do not shift dates.
- **Immediate local updates with background sync**: [`src/context/DataProvider.tsx`](src/context/DataProvider.tsx) splits contexts, caches per-user snapshots for 30 seconds, updates screens immediately, and rolls back on errors.
- **Per-user row level security**: [`supabase/schema.sql`](supabase/schema.sql) enables RLS on all tables and fills `user_id` from `auth.uid()`, so client inserts never supply `user_id`.
- **Native-driven animations with custom tab bar**: [`src/components/ui/TabBar.tsx`](src/components/ui/TabBar.tsx) and motion helpers animate only `opacity` and `transform` on the native driver while respecting reduce-motion.
- **On-device timetable parser**: [`src/lib/timetableParser.ts`](src/lib/timetableParser.ts) parses pasted schedules locally in TypeScript with no network calls so raw timetable text stays on the device.

## Getting started

### Prerequisites

- Node.js `22.13` or newer
- A free Supabase project
- An Android phone with Expo Go matching Expo SDK 58 (`~58.1.0` in [`package.json`](package.json)), or an Android emulator

### Setup steps

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/mananjani2102/BunkSmart.git
   cd BunkSmart
   npm install
   ```

2. Copy [`.env.example`](.env.example) to `.env` and fill in the environment variables from your Supabase dashboard:

   | Variable | Where to find in Supabase dashboard | Expected format |
   | --- | --- | --- |
   | `EXPO_PUBLIC_SUPABASE_URL` | **Project Settings**, then **Data API** (Project URL) | `https://<project-ref>.supabase.co` |
   | `EXPO_PUBLIC_SUPABASE_KEY` | **Project Settings**, then **API Keys** (Publishable key) | `sb_publishable_<token>` |

   The publishable key is designed to be used in a client app because row level security restricts every table per user, and a secret or `service_role` key must never be put in the app.

3. Run [`supabase/schema.sql`](supabase/schema.sql) once in the Supabase SQL Editor on a fresh project.
4. In the Supabase dashboard, open **Authentication**, **Sign In / Providers**, **Email**, and turn off **Confirm email** if you want immediate sign-in after account creation.
5. Start the Metro development server:

   ```bash
   npm start
   ```

6. Scan the terminal QR code with Expo Go (SDK 58) on Android, or press `a` to launch an Android emulator.

## Verification

[`package.json`](package.json) provides seven check and verification scripts:

| Command | What it checks |
| --- | --- |
| `npm run typecheck` | Strict TypeScript types across the project |
| `npm run lint` | ESLint rules via Expo configuration across source and script files |
| `npm run audit` | Forbidden patterns (em/en dashes, emoji, `console.log`, gradients, unfinished task markers) across `src`, `scripts`, `docs`, and `README.md` |
| `npm run verify:math` | Skip allowances, recovery counts, truncated percentages, projections, and attendance levels in [`scripts/verify-attendance.ts`](scripts/verify-attendance.ts) |
| `npm run verify:overall` | Overall attendance calculations in college figure mode and tracked mode in [`scripts/verify-overall.ts`](scripts/verify-overall.ts) |
| `npm run verify:dates` | Typed `DD/MM/YYYY` parsing, formatting, and weekday occurrence counts in [`scripts/verify-dates.ts`](scripts/verify-dates.ts) |
| `npm run verify:parser` | Plain-text timetable parsing, time inference, break ignoring, duplicate checks, and error reporting in [`scripts/verify-timetable-parser.ts`](scripts/verify-timetable-parser.ts) |

## Build the APK

1. Install EAS CLI if needed, then log in to Expo Application Services:

   ```bash
   eas login
   ```

2. Open [`eas.json`](eas.json) and replace the `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` values inside `build.preview.env` with your own Supabase project URL and publishable key.
3. Build the installable Android APK using the `preview` profile:

   ```bash
   eas build --platform android --profile preview
   ```

On your first Android build, EAS offers to generate and store a signing keystore automatically. When the build completes, the finished APK download link and QR code appear in the terminal output and on the build page in your Expo dashboard.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Database `"permission denied"` or `"The database refused access"` (code `42501`) | Table or view `GRANT` statements were skipped | Open the Supabase SQL Editor and rerun the `grant` statements in [`supabase/schema.sql`](supabase/schema.sql) |
| Startup error `"Missing Supabase configuration"` | `.env` is missing or one of the two Supabase keys is empty | Copy [`.env.example`](.env.example) to `.env`, set both values, and restart the dev server |
| Network timeouts or failed requests on an existing project | Free-tier Supabase projects pause after a week of inactivity | Open the Supabase dashboard and restore the paused project |
| Expo Go refuses to open the project | Expo Go on the phone does not match Expo SDK 58 | Install Expo Go for SDK 58 or build the preview APK with EAS Build |
| Class reminders do not appear | Notification permission is turned off for the app | Open **Profile**, turn reminders on, and use the **Open settings** button to enable notifications |

## Limitations and roadmap

### Known limitations

- Timetable estimates do not know about holidays or cancelled classes, so adjust estimated held counts manually when needed.
- Past dates on the Today screen display your current timetable rather than a historical snapshot of past timetable changes.
- Class reminders are scheduled locally on one device only, do not sync across devices, and were tested on Android only.
- Free Supabase projects pause automatically after a week of inactivity.

### Not included yet

- Password reset flow and self-service account deletion inside the app (account deletion is currently handled by email).
- Automatic syncing with college attendance portals.
- Remote push notifications.
- Offline write queueing (a network connection is required to persist changes).

## Privacy and terms

Both the Privacy Policy and Terms and Conditions are available inside the app under **Profile** (and linked from the Sign up screen). BunkSmart stores your account details, subjects, timetable slots, attendance logs, and optional starting counts in Supabase Postgres. On your device, it stores your login session, the theme mode, reminder settings, and a cached copy of your profile, subjects, timetable, and attendance for faster loading. When you log out, all of that user data is removed and only the theme mode stays on your device.

## Credits and license

- Typography uses the Geist font by Vercel under the SIL Open Font License, bundled in [`assets/fonts`](assets/fonts).
- This project is licensed under the MIT License; see [`LICENSE`](LICENSE).

## Author

- Name: Manan Jani
- Email: `manan.jani.cg@gmail.com`
- GitHub: https://github.com/mananjani2102
