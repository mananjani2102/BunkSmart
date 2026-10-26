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
