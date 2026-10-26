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

- Light theme only. Use colors only from `src/theme/tokens.ts`.
- One accent color (teal). No purple, violet, or indigo. No gradients anywhere.
- Radii: cards 14, controls 10. No radius above 16 on any button. No pill-shaped or fully rounded buttons.
- Icons: Ionicons only. No emoji anywhere in UI, code, comments, or docs.
- System font only.
- Motion: only a 150 to 200 ms opacity or layout change on state change, plus the skeleton pulse. No looping, parallax, or scroll-driven animation.
- Copy is short, literal, and second person, and it states what the screen does. No exclamation marks. No marketing words such as seamless, effortless, unlock, supercharge, or journey. No em dash or en dash characters in any text, string, comment, or file. Use commas, colons, or periods.
- No fake data: no sample subjects, testimonials, user counts, ratings, or statistics. Every number on screen comes from the user's own data.
- No stock photos or generated images. The app has no photographs.
- Touch targets must be at least 44 dp. Text contrast must be at least 4.5 to 1. Never show status by color alone; always include a text label.
- Android is edge-to-edge, so use `react-native-safe-area-context` for insets.

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
