# BunkSmart Data Model

All tables live in Supabase Postgres with row level security enabled so every row is restricted to its owner.

## Tables

### `profiles`
One row per signed-in user. Created automatically by a database trigger on sign up using `full_name` from the sign-up metadata.

- `id`: uuid, equals the auth user id
- `full_name`: text, max 80 characters
- `default_target`: integer, 50 to 95, default 75
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

### `subjects`
Courses tracked by a user. Deleting a subject also deletes its timetable slots and attendance logs.

- `id`: uuid
- `user_id`: uuid (filled automatically by the database)
- `name`: text, 1 to 60 characters, unique per user ignoring case
- `target_percent`: integer, 50 to 95, default 75
- `initial_present`: integer, at least 0 and never above `initial_total` (classes already attended before using the app)
- `initial_total`: integer, at least 0 (classes already held before using the app)
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

### `timetable_slots`
Weekly schedule entries for a subject. A user cannot have two slots with the same `weekday` and `start_time`.

- `id`: uuid
- `user_id`: uuid (filled automatically by the database)
- `subject_id`: uuid, references `subjects.id`
- `weekday`: integer, 1 to 7 (ISO weekday: Monday is 1, Sunday is 7)
- `start_time`: time, returned as `"HH:MM:SS"`
- `end_time`: nullable time, returned as `"HH:MM:SS"` or null, must be later than `start_time`
- `created_at`: timestamp with time zone

### `attendance_logs`
Daily attendance records. Unique on `(slot_id, log_date)`.

- `id`: uuid
- `user_id`: uuid (filled automatically by the database)
- `subject_id`: uuid, references `subjects.id`
- `slot_id`: nullable uuid, references `timetable_slots.id` (set to null if the slot is deleted)
- `log_date`: date, stored and handled as local calendar date `"YYYY-MM-DD"`
- `status`: text enum, one of `present`, `absent`, or `cancelled`
- `created_at`: timestamp with time zone
- `updated_at`: timestamp with time zone

## Read-Only Views

### `subject_stats`
One row per subject with aggregated attendance totals. Cancelled classes never count toward `conducted`.

- `subject_id`: uuid
- `user_id`: uuid
- `attended`: integer (`initial_present` plus number of `present` logs)
- `conducted`: integer (`initial_total` plus number of `present` and `absent` logs)
- `cancelled`: integer (number of `cancelled` logs)

## Security and Behavior

- The `user_id` column is filled automatically by the database for the signed-in user. The app never sends `user_id` on insert.
- Row level security limits every row to its owner.
- A database trigger creates the `profiles` row on sign up using `full_name` from the sign-up metadata.
- Deleting a subject cascades and deletes its `timetable_slots` and `attendance_logs`.

## Constraint Names Mapped to Friendly Messages

- `subjects_user_name_key`: duplicate subject name for the same user.
- `timetable_slots_user_day_start_key`: two classes scheduled at the same weekday and start time.
