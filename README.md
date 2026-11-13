# BunkSmart

BunkSmart tracks your class attendance per subject against a target percentage you choose. It calculates how many upcoming classes you can still skip, or how many you must attend in a row, to stay at your target.

## How the numbers work

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

## Run locally


1. Install Node 22.13 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your Supabase project URL (`EXPO_PUBLIC_SUPABASE_URL`) and publishable key (`EXPO_PUBLIC_SUPABASE_KEY`).
4. Open the Supabase SQL Editor for your project and run `supabase/schema.sql`.
5. In the Supabase dashboard, open **Authentication**, **Sign In / Providers**, **Email**, and turn off **Confirm email**.
6. Start the development server:

   ```bash
   npx expo start
   ```

7. Open the app in Expo Go (SDK 58).
