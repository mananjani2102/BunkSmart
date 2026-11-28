# BunkSmart Performance Audit

Baseline audit conducted before redesign. No visuals, routes, database schema, copy, or attendance math were altered during audit.

## 1. Context Providers and Re-Render Scope

- `src/context/DataProvider.tsx`: Uses a single `DataContext` combining read-only data (`status`, `error`, `subjects`, `slots`, `trackedSince`), derived/aggregated values (`statsBySubject`, `overall`), and mutation callbacks (`reload`, `reloadStats`, `applyOptimisticAttendanceChange`, `addSubject`, `updateSubject`, `deleteSubject`, `deleteAllAttendanceData`, `addSlot`, `updateSlot`, `deleteSlot`, `importTimetable`).
  - Marking attendance in `src/app/(tabs)/today.tsx` mutates `statsBySubject` and `logsAfterBaseline`, recalculates `overall`, and changes the single `DataContext` value identity. This forces every `useData()` consumer to re-render, including unrelated screens (`src/app/(tabs)/profile.tsx`, `src/app/(tabs)/subjects.tsx`, `src/app/slot-form.tsx`, `src/app/timetable-import.tsx`, `src/app/past-attendance.tsx`, `src/components/PastAttendanceEstimate.tsx`).
  - `reload`, `reloadStats`, `applyOptimisticAttendanceChange`, and `importTimetable` include mutable state (`subjects`, `slots`, `profile`, `hasCollegeBaseline`, `baselineDate`) in their `useCallback` dependencies, causing callback identities to churn when data changes.
  - `reloadStats` (lines 324-334) nests `setSlots` inside a `setSubjects` state updater callback to read latest state for `writeCachedData`.
- `src/context/AuthProvider.tsx`: Combines auth/profile state (`session`, `user`, `profile`, `avatarUri`, `loading`) and action callbacks (`signIn`, `signUp`, `signOut`, `updateProfile`, `updateAvatar`, `refreshProfile`) in a single context, and rebuilds `updateProfile`, `updateAvatar`, and `refreshProfile` when `userId` or `metadataFullName` changes.

## 2. Unconditional Refetches on Focus

- `src/app/(tabs)/index.tsx` (lines 163-168): `useFocusEffect` calls `reloadStats()` (3 network queries: `subject_stats` + 2 `attendance_logs` head counts) and `fetchLogsForDate(today)` on every screen focus, even immediately after initial load or tab switching.
- `src/app/(tabs)/today.tsx` (lines 187-191): `useFocusEffect` calls `fetchLogsForDate(selectedDate)` unconditionally on every focus, even when `logsCacheRef` already holds fresh logs for that date, and does not share today's logs with `OverviewScreen`.
- `src/app/subject/[id].tsx` (lines 107-115): `useFocusEffect` calls `reloadStats()` and `fetchLogsForSubject(subjectId)` unconditionally on every focus.

## 3. Full Reloads After Small Changes and Sequential Awaits

- `src/context/DataProvider.tsx`: `addSubject`, `updateSubject`, `deleteSubject`, `deleteAllAttendanceData`, `addSlot`, `updateSlot`, `deleteSlot`, and `importTimetable` all call `await reload(true)` (full fetch of subjects, slots, stats, and baseline counts) after each mutation instead of updating local state directly.
- `src/app/(tabs)/today.tsx`:
  - `handleSelectStatus` (lines 336-353) awaits the database write and then sequentially awaits `reloadStats()` on every single class tap.
  - `handleBatchStatus` (lines 406-418) and `handleClearDay` (lines 450-455) wait for the network response before updating local UI/stats and sequentially await `reloadStats()`.
- `src/app/past-attendance.tsx` (lines 141-149) and `src/components/PastAttendanceEstimate.tsx` (lines 244-252): Call `await reload(true)` after batching subject starting-count updates instead of updating local subject/stats state.
- `src/lib/reminders.ts`:
  - `rescheduleClassReminders` (lines 185-186) awaits `ensureAndroidChannel` and `cancelAllScheduledNotificationsAsync` sequentially, then loops with `await api.scheduleNotificationAsync(...)` sequentially per slot instead of running in `Promise.all`.
  - `requestReminderPermission` (lines 180-185) awaits `ensureAndroidChannel` before `getPermissionsAsync`.
- `src/context/RemindersProvider.tsx` (lines 239-244): `setEnabled(false)` awaits `cancelAllClassReminders()` before `writeReminderSettings()`.
- `src/context/AuthProvider.tsx` (lines 292-299): `signOut` awaits `cancelAllClassReminders()` before `supabase.auth.signOut()`.

## 4. Non-Virtualized Long Lists Inside ScrollView

- `src/app/subject/[id].tsx` (line 205) renders `<Screen scroll>` (`ScrollView`) around `HistoryList`.
- `src/components/HistoryList.tsx` (lines 103-177) renders all month groups and up to 1,000 log rows (`fetchLogsForSubject` limit 1000 in `src/data/logs.ts`) via nested `.map()` calls, mounting every row's `PressableScale` and `Animated.Value` eagerly.

## 5. Unmemoized List Rows, Inline Callbacks, and Inline Styles

- `src/components/TodayClassCard.tsx`: Not wrapped in `React.memo`. Receives fresh `counts={{ attended, held }}` object literals and inline `onSelectStatus` arrows from `src/app/(tabs)/today.tsx` (lines 881-898), plus allocates inline `onPress` closures and inline style objects inside `STATUS_OPTIONS.map` (lines 217-261).
- `src/app/(tabs)/index.tsx`: Inline `.map()` for urgent recovery rows (lines 906-931) and subject breakdown cards (lines 1033-1186), with per-row inline navigation closures and inline style objects.
- `src/app/(tabs)/subjects.tsx`: Inline `.map()` for subject cards (lines 353-573), weekday selector chips (lines 605-653), and timetable slot cards (lines 699-819), with per-row inline closures and style objects.
- `src/components/HistoryList.tsx`: Inline `.map()` rows with inline `onPress` closures and inline dot color objects.
- `src/app/slot-form.tsx` (lines 213-254), `src/app/simulator.tsx` (lines 109-144), `src/app/past-attendance.tsx` (lines 180-224), and `src/components/PastAttendanceEstimate.tsx` (lines 361-414): Mapped rows/chips without `React.memo` and with inline handlers.

## 6. SVG Components Without Memoization or Primitive Props

- `src/components/ui/ProgressRing.tsx`: Not wrapped in `React.memo`; recalculates geometry and reconciles SVG `<Circle>` and `<Line>` elements whenever parent components re-render.
- `src/components/TrendChart.tsx`: Not wrapped in `React.memo` and accepts non-primitive `subject: Subject` and `logs: readonly AttendanceLog[]` props, causing point derivation and SVG reconciliation whenever the parent renders.

## 7. Tab Screen Freezing, Effects, and Timers

- `src/app/(tabs)/_layout.tsx`: `freezeOnBlur` is not enabled on `<Tabs screenOptions>`, so hidden tabs remain active while blurred.
- `src/app/(tabs)/index.tsx` (lines 301-347): Computes `todayWeekday`, `upcomingClassTeaser`, `greeting`, and `formattedDate` from `new Date()` during render without a 60-second ticker, so the upcoming class teaser does not advance as time passes while the screen remains mounted.
- `src/app/(tabs)/today.tsx` (lines 139-143): `useEffect` resets `paramDate` via `router.setParams({ date: undefined })`, adding a redundant render pass when opening Today from a history entry.
- `src/components/ui/Skeleton.tsx` (lines 29-54): Each `<Skeleton>` instance creates its own `Animated.Value` and starts its own `Animated.loop`, spawning 17 to 25 simultaneous JS-scheduled loops on loading screens.
- `src/components/ui/PressableScale.tsx`, `src/components/ui/FadeView.tsx`, `src/components/ui/Segmented.tsx`, `src/components/ui/TabBar.tsx`, and `src/components/ui/Skeleton.tsx`: None check `AccessibilityInfo.isReduceMotionEnabled()`.
- `src/components/ui/Segmented.tsx` (lines 216-219): Uses iOS `shadowColor`, `shadowOffset`, `shadowOpacity`, and `shadowRadius` on the moving thumb.

## 8. Console Statements, Unused Dependencies, and Engine Configuration

- Leftover `console.error` calls (24 total) in: `src/app/(tabs)/profile.tsx` (6), `src/app/(tabs)/today.tsx` (4), `src/app/(tabs)/subjects.tsx` (1), `src/app/past-attendance.tsx` (1), `src/app/slot-form.tsx` (2), `src/app/starting-attendance.tsx` (2), `src/app/subject/[id].tsx` (1), `src/app/subject-form.tsx` (2), `src/app/timetable-import.tsx` (1), `src/components/PastAttendanceEstimate.tsx` (2), and `src/context/RemindersProvider.tsx` (4).
- Unused files in `src/`: None found (`src/` contains only active routes, providers, components, data helpers, utilities, constants, theme tokens, and types).
- Unused dependencies in `package.json`:
  - Completely unreferenced in `src/` and `node_modules`: `expo-device`, `expo-web-browser`, `expo-system-ui`.
  - Unreferenced in `src/` and optional/template-only in `expo-router`: `@expo/ui`, `expo-symbols`, `react-native-worklets`, `react-native-reanimated` (forbidden by `docs/PROJECT_RULES.md`), `react-native-gesture-handler` (required peer only for unused `Drawer` in `react-native-drawer-layout`).
  - `npx expo-doctor` currently fails 1 of 20 checks because 7 SDK 58 packages (`expo`, `@expo/ui`, `expo-glass-effect`, `expo-image`, `expo-notifications`, `expo-router`, `expo-splash-screen`) have newer SDK 58 patch/minor versions.
- Engine configuration (`app.json`, `package.json`, Expo SDK 58 / React Native `0.88.1`):
  - Hermes is enabled by default (`jsEngine` is not overridden to `jsc`, and Metro/export compile Hermes bytecode).
  - New Architecture is permanently enabled in React Native `0.88.1` / Expo SDK 58.
  - `app.json` has `experiments.reactCompiler: true`.

## 9. Animations and Reduce-Motion Verification

Every animation in the app animates only `opacity` or `transform` (or uses native platform screen/modal transitions), runs with `useNativeDriver: USE_NATIVE_DRIVER` (`true` on Android and iOS, `false` on web where native driver is unsupported), and respects `AccessibilityInfo.isReduceMotionEnabled()` via `useReduceMotion()` in `src/lib/motion.ts`.

| Animation | File | Properties | Native Driver | Reduce Motion Behavior |
| --- | --- | --- | --- | --- |
| Shared skeleton pulse | `src/lib/motion.ts`, `src/components/ui/Skeleton.tsx` | `opacity` (`0.45` to `0.95` via one `Animated.Value`) | Yes (`USE_NATIVE_DRIVER`) | Stops `Animated.loop` and renders static `0.7` opacity blocks |
| Web skeleton pulse | `src/components/ui/Skeleton.web.tsx` | CSS `opacity` (`0.45` to `0.95`) | N/A (Web CSS) | `@media (prefers-reduced-motion: reduce)` sets `animation: none` and `opacity: 0.7` |
| Content arrival fade | `src/components/ui/ContentFade.tsx` | `opacity` (`0` to `1` over 150 ms) | Yes (`USE_NATIVE_DRIVER`) | Snaps `opacity` to `1` immediately; skips fade when data is already ready |
| View transition fade | `src/components/ui/FadeView.tsx` | `opacity`, `transform: [{ translateY }]` (180 ms) | Yes (`USE_NATIVE_DRIVER`) | Snaps `opacity` to `1` and `translateY` to `0` |
| Snackbar enter and exit | `src/components/ui/Snackbar.tsx` | `opacity`, `transform: [{ translateY }]` (180 ms in, 150 ms out) | Yes (`USE_NATIVE_DRIVER`) | Snaps `opacity` and `translateY` immediately without timing animations |
| Tab bar indicator and item crossfade | `src/components/ui/TabBar.tsx` | Shared indicator `transform: [{ translateX }]` (220 ms); per-tab icon/label `opacity` and active icon `transform: [{ scale }]` (`0.92` to `1`, 150 ms) | Yes (`USE_NATIVE_DRIVER`) | Sets indicator position, icon/label opacities, and icon scale immediately |
| Pressable scale feedback | `src/components/ui/PressableScale.tsx` | `transform: [{ scale }]` (90 ms in, 160 ms out) | Yes (`USE_NATIVE_DRIVER`) | Keeps `scale` fixed at `1` |
| Button and Card press feedback | `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx` | `opacity`, `transform: [{ scale }]` | Native press state | Uses `pressedReducedMotion` style without `scale` transform |
| Stack, modal, and auth transitions | `src/app/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `src/theme/navigation.ts` | Native `slide_from_right`, `slide_from_bottom`, `fade` | Native navigator | Sets `animation: 'none'` when `reduceMotion` is true |
| Tab screen transition | `src/app/(tabs)/_layout.tsx` | Native `fade` | Native navigator | Sets `animation: 'none'` when `reduceMotion` is true |
| Modal and sheet dialogs | `src/components/ui/ConfirmModal.tsx`, `src/components/ui/ActionSheet.tsx`, `src/components/GoToDateModal.tsx` | Native Modal `fade` / `slide` | Native Modal | Sets `animationType="none"` when `reduceMotion` is true |

## 10. Implemented Performance Measures

- **Split Contexts**: `AuthProvider` (`AuthStateContext`, `AuthActionsContext`) and `DataProvider` (`DataStateContext`, `DataStatsContext`, `DataDerivedContext`, `DataDateLogsContext`, `DataActionsContext`, plus `SnackbarActionsContext`) isolate state slices and keep action identities stable so marking attendance does not re-render unrelated screens.
- **30-Second Freshness and LRU Caches**: Initial data, stats, date logs (7-date LRU cache), and subject history logs (5-subject LRU cache) skip network reloads within 30 seconds (`FRESHNESS_WINDOW_MS`) and render cached data immediately with no skeleton.
- **Delayed Skeletons**: `useDelayedVisible` delays skeleton mounting by 200 ms (`SKELETON_DELAY_MS`) so fast local cache hits and quick responses never flash placeholders, and all skeleton blocks share a single `Animated.Value` pulse driver.
- **Optimistic Local-First Mutations**: Marking a class, running whole-day batch actions, clearing a day, and editing subjects/slots update local state and AsyncStorage snapshots immediately, debounce background stats refreshes (`1200 ms`), and roll back cleanly on failure.
- **List Virtualization and Memoization**: Subject detail history renders through a single virtualized `FlatList` (`initialNumToRender={16}`, `maxToRenderPerBatch={16}`, `windowSize={7}`, `removeClippedSubviews`), row components use `React.memo`, and SVG components (`ProgressRing`, `TrendChart`) memoize on primitive props.
- **Tab Freezing and Shared Ticker**: `(tabs)/_layout.tsx` sets `lazy: true`, `freezeOnBlur: true`, and `detachInactiveScreens: true`, and `src/lib/ticker.ts` shares one 60-second minute ticker across Overview and Today.
