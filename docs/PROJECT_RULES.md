# BunkSmart Project Rules

## Stack

- Expo SDK 58, React Native, TypeScript strict mode, Expo Router, Supabase (Auth and Postgres), and EAS Build (APK).
- The app must run in Expo Go and in an EAS APK. No custom native code, no `expo prebuild`, and no development builds.
- Dependencies are limited to the packages installed in Prompt 1 (plus `@expo/vector-icons`, installed via `npx expo install` because the Expo default template does not bundle it). Add no other dependency. If one seems necessary, stop and ask the user first. Always install with `npx expo install`.
- Forbidden libraries and features: `react-native-maps`, `reanimated`, `datetimepicker`, `slider`, `camera`, remote push notifications, UI kits, animation libraries, state libraries, and chart libraries.
- No `any` and no `ts-ignore`. Type query results with the interfaces in `src/types/db.ts`.

## Data Rules

- Dates are local calendar dates built with `src/lib/dates.ts`. Never use `toISOString` for a date.
- Weekdays are stored in ISO format: Monday is 1 through Sunday is 7.
- Cancelled classes never count as held.
- The app uses only the Supabase publishable key (`EXPO_PUBLIC_SUPABASE_KEY`). Never reference a secret or `service_role` key.
- Reference Expo public environment variables literally as `process.env.EXPO_PUBLIC_NAME`. Never destructure or index `process.env`.

## Design Rules

- Monochrome theme from `src/theme/tokens.ts` supporting light (`#FCFCFC` background) and dark (`#000000` background) modes, following system appearance by default.
- No gradients anywhere. Use 1px `border` tokens on cards and rows instead of elevation shadows; soft shadows are allowed only on floating surfaces such as modals, bottom sheets, and snackbars.
- Radii: cards and controls `8`, small badges `6`, and round (`999`) only for small status dots. No pill-shaped buttons.
- Icons: Ionicons only. No emoji anywhere in UI, code, comments, or docs.
- Geist font only (`Geist-Regular`, `Geist-Medium`, `Geist-SemiBold` loaded from `assets/fonts/`). Never use `fontWeight` on text styles; map each variant to its `fontFamily` and keep letter spacing at `0`.
- Status is indicated by a small dot plus a short text label. Percentage numbers always use `foreground`. Amber and destructive fills are used only for dots, bars, and tinted backgrounds, while small text labels use `warningText` and `destructiveText`.
- Copy is short, literal, and second person, using a single clear wording for each fact. No exclamation marks. No marketing words such as seamless, effortless, unlock, supercharge, or journey. No em dash or en dash characters in any text, string, comment, or file. Use commas, colons, or periods.
- No fake data: no sample subjects, testimonials, user counts, ratings, or statistics. Every number on screen comes from the user's own data.
- No photographs, stock photos, or generated images. The app has no user avatars or photo uploads.
- Minimum touch target size is 44 dp. Text contrast must be at least 4.5 to 1 in both light and dark modes.
- Android is edge-to-edge, so use `react-native-safe-area-context` for insets.

## Performance rules

- Animate only opacity and transform, always with the native driver. Never animate layout, width, height, shadows or SVG props on the JS thread.
- Use the navigator's built-in native transitions for screens and tabs. No custom JavaScript page transitions.
- No staggered entrance animations and no animation on list mount.
- Skeletons share one single pulse driver.
- No shadows or elevation on list rows, use 1px borders instead. No blur, no gradients, no large images.
- A mutation updates local state first and syncs in the background.
- Loaded data is fresh for 30 seconds.
- Memoize rows. Virtualize long lists. Never nest a virtualized list inside a ScrollView.
- Respect the system reduce-motion setting.
- Judge speed on a preview APK, never in Expo Go development mode.

## Code Rules

- Function components and hooks only. Effects that fetch must not set state after unmount.
- No `console.log`. Use `console.error` only inside a `catch` block that also shows the user a message.
- Every async action has a loading state, a readable error message, and blocks double submission.
- Keep files under about 300 lines and extract components when larger.

## Quality Gate

Before finishing any task, run these commands in order, fix every error and warning introduced, and re-run until all pass:

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npx expo-doctor`
