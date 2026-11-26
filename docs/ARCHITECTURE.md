# BunkSmart Architecture

## Stack

- Framework: Expo SDK 58, React Native, TypeScript strict mode
- Routing: Expo Router
- Backend: Supabase (Auth and Postgres)
- Distribution: Expo Go for development and EAS Build for installable Android APK

## Routes Directory

`ROUTES_DIR` is `src/app`.

## Folder Map

- `src/app`: Expo Router screen files and `_layout.tsx` navigators
- `src/lib`: Core utilities and service clients (`supabase.ts`, `dates.ts`)
- `src/types`: TypeScript interfaces and shared types (`db.ts`)
- `src/theme`: Design tokens for colors, radii, spacing, and typography (`tokens.ts`)
- `src/components/ui`: Reusable primitive UI components (`AppText`, `Button`, `TextField`, `Card`, `Screen`)
- `src/context`: React context providers (auth, profile, and app state, added in later prompts)
- `src/data`: Supabase query and mutation helpers (added in later prompts)

## Planned Routes

- `(auth)/login`
- `(auth)/signup`
- `(tabs)/index`
- `(tabs)/today`
- `(tabs)/subjects`
- `(tabs)/profile`
- `subject-form`
- `slot-form`
- `subject/[id]`
- `simulator`
- `timetable-import`
- `starting-attendance`
- `past-attendance`
- `legal/privacy`
- `legal/terms`

## Build Log

- Prompt 1: Scaffolded Expo project, installed core dependencies and `@expo/vector-icons`, removed starter demo content, configured `app.json` and env files, created Supabase client, DB types, date helpers, theme tokens, base UI components, and project documentation. Upgraded from Expo SDK 57 to SDK 58 to match Expo Go.
- Prompt 2: Added error mapping and Supabase result unwrappers (`src/lib/errors.ts`), auth and profile session context (`src/context/AuthProvider.tsx`), splash-gated protected root navigation (`src/app/_layout.tsx`), email and password login and signup flows (`src/app/(auth)/`), and the signed-in bottom tab shell with a live Profile screen (`src/app/(tabs)/`). Removed the placeholder root index screen.
- Prompt 3: Added subjects and timetable slots data helpers (`src/data/subjects.ts`, `src/data/slots.ts`), app data context (`src/context/DataProvider.tsx`), shared header options (`src/theme/navigation.ts`), reusable UI controls (`Segmented`, `Stepper`, `TimeField`, `EmptyState`, `ErrorState`), modal subject and class form routes (`src/app/subject-form.tsx`, `src/app/slot-form.tsx`), full Subjects and Timetable views in `src/app/(tabs)/subjects.tsx`, and the default target attendance card in `src/app/(tabs)/profile.tsx`.
- Prompt 4: Added the integer-arithmetic attendance math engine (`src/lib/attendance.ts`) and verification script (`scripts/verify-attendance.ts`), daily log data helpers (`src/data/logs.ts`), `ProgressRing`, `LevelBadge`, `TodayClassCard`, and `WhatIfSimulator` components, the Today attendance screen (`src/app/(tabs)/today.tsx`), the Overview bento dashboard (`src/app/(tabs)/index.tsx`), subject detail route (`src/app/subject/[id].tsx`), standalone What-if simulator route (`src/app/simulator.tsx`), root stack header registration (`src/app/_layout.tsx`), and updated subject card navigation in `src/app/(tabs)/subjects.tsx`.
- Prompt 5: Added local class reminder preferences (`src/lib/prefs.ts`), local notification scheduling and Android channel setup (`src/lib/reminders.ts`), reminder sync context (`src/context/RemindersProvider.tsx`), and the Profile reminders card (`src/components/RemindersCard.tsx`) with sign-out cancellation; added per-subject log history fetching (`src/data/logs.ts`), `TrendChart`, `HistoryList`, and present/absent/cancelled totals on `src/app/subject/[id].tsx`; added the `Skeleton` pulse component (`src/components/ui/Skeleton.tsx`), replaced loading text across screens, and exported a root `ErrorBoundary` in `src/app/_layout.tsx`; added plain-English Privacy Policy and Terms and Conditions (`src/constants/legal.ts`, `src/components/LegalDocument.tsx`, `src/app/legal/privacy.tsx`, `src/app/legal/terms.tsx`), signup legal links, Profile legal links, and the delete-all-attendance-data action.
- Prompt 7: Added plain-text timetable parser module (`src/lib/timetableParser.ts`) and verification script (`scripts/verify-timetable-parser.ts`) supporting day headers, inline day prefixes, 12-hour and 24-hour time ranges, assumed end times, and break skipping; added batch subject and slot mutation helpers (`src/data/subjects.ts`, `src/data/slots.ts`) and log counting helper (`src/data/logs.ts`); added `importTimetable` action in `src/context/DataProvider.tsx` with case-insensitive subject reconciliation and attendance-safe timetable replacement checks; added modal timetable import route (`src/app/timetable-import.tsx`) with day-grouped preview, status badges, problem diagnostics, and segmented import modes; updated `EmptyState` (`src/components/ui/EmptyState.tsx`) to support secondary actions; added import entry points across the Subjects view, Timetable view, and Overview empty state.
- Prompt 8: Added overall college baseline fields (`baseline_attended`, `baseline_held`, `baseline_date`) to `docs/DATA_MODEL.md`, `src/types/db.ts`, `AuthProvider` (`src/context/AuthProvider.tsx`), and `profiles_baseline_valid` error mapping (`src/lib/errors.ts`); added pure overall calculation helper (`src/lib/overall.ts`) and verification script (`scripts/verify-overall.ts`); added count-only post-baseline log query (`countLogsAfterDate` in `src/data/logs.ts`) and exposed `overall` and `trackedSince` in `DataProvider` (`src/context/DataProvider.tsx`) with updates on Today marks, stats reload, and profile baseline changes; added `starting-attendance` modal route (`src/app/starting-attendance.tsx`) and registered it in `src/app/_layout.tsx`; updated Overview (`src/app/(tabs)/index.tsx`) with overall mode captions, engine insight line, college-number button, and per-user AsyncStorage dismissible hint card (`src/lib/prefs.ts`); added subject counts source caption in `src/app/subject/[id].tsx` and the Starting attendance card in `src/app/(tabs)/profile.tsx`.
- Prompt 9: Extended `src/lib/dates.ts` with typed `DD/MM/YYYY` parsing (`parseTypedDate`), `DD/MM/YYYY` formatting (`formatDateDDMMYYYY`), and inclusive weekday occurrence counting (`countWeekdayOccurrences`), verified by `scripts/verify-dates.ts`; added `DateField` (`src/components/ui/DateField.tsx`) with numeric keyboard and blur validation; added batch log upsert (`setDateLogsStatusBatch`), date deletion (`deleteLogsForDate`), and earliest log date query (`fetchEarliestLogDate`) in `src/data/logs.ts`; added the `past-attendance` modal route (`src/app/past-attendance.tsx`) and `PastAttendanceEstimate` (`src/components/PastAttendanceEstimate.tsx`) supporting direct starting count entry and timetable-based estimation, with entry points in Subjects, Subject Detail, and Profile; added Today screen quick actions (`All present`, `All absent`, `Holiday (all cancelled)`, `Clear day`) and the `"Go to date"` header button with `GoToDateModal` (`src/components/GoToDateModal.tsx`).
