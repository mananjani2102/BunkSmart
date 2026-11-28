# BunkSmart Theme Reference

All visual tokens live in [tokens.ts](../src/theme/tokens.ts) and are provided at runtime through [ThemeProvider.tsx](../src/theme/ThemeProvider.tsx). Plain hex values are used throughout so React Native and Android render consistently in both schemes.

## Theme Modes

- `system` (default): follows the device color scheme.
- `light`: forces the light monochrome palette (`#FCFCFC` background).
- `dark`: forces the dark monochrome palette (`#000000` background).

The selected mode is persisted under `bunksmart:theme-mode` in `AsyncStorage` and restored on launch before hiding the splash screen. `app.json` configures `userInterfaceStyle: "automatic"`, splash screen light `#FCFCFC` and dark `#000000` backgrounds, and Android notification color `#2D62EF`. Root layout views and screen containers apply `colors.background` so dark mode never flashes white during transitions.

The brand mark is a white check on black, with the Android adaptive icon background `"#000000"`.

## Color Tokens

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `background` | `#FCFCFC` | `#000000` | Screen background |
| `foreground` | `#000000` | `#FFFFFF` | Primary text, icons, percentage values |
| `card` | `#FFFFFF` | `#090909` | Card and grouped container surface |
| `popover` | `#FCFCFC` | `#121212` | Bottom sheets, modals, snackbars |
| `primary` | `#000000` | `#FFFFFF` | Primary button and selected control fill |
| `primaryForeground` | `#FFFFFF` | `#000000` | Text and icons on `primary` |
| `secondary` | `#EBEBEB` | `#222222` | Secondary control surface |
| `muted` | `#F5F5F5` | `#1D1D1D` | Subtle surfaces, chips, tracks |
| `mutedForeground` | `#525252` | `#A4A4A4` | Secondary labels and inactive icons |
| `accent` | `#EBEBEB` | `#313131` | Highlighted neutral surface fill |
| `border` | `#E4E4E4` | `#242424` | 1px borders and dividers |
| `input` | `#EBEBEB` | `#313131` | Text input borders and fill borders |
| `ring` | `#000000` | `#A4A4A4` | Focused input border highlight |
| `fieldBackground` | `#FFFFFF` | `#0A0A0A` | Text field background surface |
| `fieldBorder` | `#A4A4A4` | `#525252` | Text field resting 1px border |
| `destructive` | `#CC2830` | `#FF5B5B` | Destructive button fill, dots, alert bars |
| `destructiveForeground` | `#FFFFFF` | `#000000` | Text on destructive fill |
| `amber` | `#FFAF03` | `#FFAF03` | Borderline dots, bars, and ring stroke |
| `blue` | `#2558DF` | `#5B94FF` | Informational / cancelled accent and links |
| `success` | `#127034` | `#4ADE80` | Safe status text, dot, bar, and ring stroke |
| `successBg` | `#E6F4EA` | `#0F2A1A` | Tinted safe status background |
| `warningText` | `#8A4B00` | `#FFAF03` | Borderline text label (contrast safe) |
| `warningBg` | `#FFF4D6` | `#2A1F00` | Tinted warning background |
| `destructiveText` | `#B4232A` | `#FF5B5B` | At-risk text label and destructive icons |
| `destructiveBg` | `#FDECEC` | `#2A0E0E` | Tinted destructive background |
| `scrim` | `#00000073` | `#000000A6` | Modal backdrop overlay |
| `rippleNeutral` | `#00000014` | `#FFFFFF1A` | Android ripple on neutral surfaces |
| `ripplePrimary` | `#FFFFFF2E` | `#00000024` | Android ripple on primary surfaces |

## Status Rules

- Status is shown by a small dot (`radius.dot`) or a short text label paired with its semantic colors.
- Attendance percentage figures always use `colors.foreground` so numerical values stay readable in monochrome.
- `amber` and `destructive` fills are reserved for small dots, progress bars, chart strokes, and tinted backgrounds (`warningBg`, `destructiveBg`), never small body text on light backgrounds.
- Small colored text labels use `success`, `warningText`, `destructiveText`, or `blue` to maintain at least 4.5:1 contrast in both schemes.

## Radii, Spacing, and Elevation

- `radius.card`: `8` (cards and containers)
- `radius.control`: `8` (buttons, inputs, segmented tabs, icon boxes)
- `radius.small`: `6` (small badges, status pills, chips)
- `radius.dot`: `999` (only for small circular status dots and circular SVG indicators)
- `spacing`: 4-point grid (`xs: 4`, `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `xxl: 32`)
- Elevation / Shadows: none on cards and list rows (use a 1px `border` instead). Floating surfaces (`ConfirmModal`, bottom sheets, snackbars) may use `shadows.floating`.

## Typography (Geist Font)

Geist static font files live in `assets/fonts/` (`Geist-Regular.ttf`, `Geist-Medium.ttf`, `Geist-SemiBold.ttf`) and are loaded via `useFonts` in [src/app/_layout.tsx](../src/app/_layout.tsx). Never set `fontWeight` on text styles; map every style to its explicit `fontFamily` (`fontFamily.regular`, `fontFamily.medium`, `fontFamily.semibold`) so Android renders the intended weight reliably. All type styles set `letterSpacing: 0` and enable `tabular-nums`.

| Variant | Family | Size | Line Height |
| --- | --- | --- | --- |
| `display` | `Geist-SemiBold` | `44` | `48` |
| `title` | `Geist-SemiBold` | `24` | `30` |
| `heading` | `Geist-SemiBold` | `17` | `24` |
| `body` | `Geist-Regular` | `15` | `22` |
| `label` | `Geist-Medium` | `13` | `18` |
| `caption` | `Geist-Regular` | `12` | `16` |

## Shared Auth Components

- `BrandMark` ([BrandMark.tsx](../src/components/ui/BrandMark.tsx)): 36 px monochrome square mark (`radius.control`) with a `primary` fill and `primaryForeground` vector check mark, hidden from screen readers so the adjacent `"BunkSmart"` title reads cleanly.
- `AuthLayout` ([AuthLayout.tsx](../src/components/ui/AuthLayout.tsx)): Shared authentication screen shell with `SafeAreaView`, `KeyboardAvoidingView`, a `ScrollView` that keeps the focused field visible with 24 px padding when the keyboard is open, an optional 44 by 44 top-left back icon button (`onBack`), the brand row, a 420 px max-width centered column, and a bottom-pinned `footer`.
- `TextField` ([TextField.tsx](../src/components/ui/TextField.tsx)): Single-line 48 px height (`minHeight: 48` when multiline) input surface using `fieldBackground`, 1 px `fieldBorder` (`foreground` when focused, `destructiveText` on error, `muted` fill when disabled), `radius.control`, a 44 by 44 password visibility toggle button, and an accessible inline error row.
- `FormError` ([FormError.tsx](../src/components/ui/FormError.tsx)): Inline form-level alert banner rendered with `destructiveBg`, `destructiveText` icon and copy, `radius.control`, and `accessibilityRole="alert"`.
- `LinkRow` ([LinkRow.tsx](../src/components/ui/LinkRow.tsx)): Centered muted prompt paired with an adjacent `blue` (`tone="info"`) link control preserving at least a 44 dp touch target height.
