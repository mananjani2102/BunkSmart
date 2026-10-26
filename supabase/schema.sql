-- BunkSmart schema. Run once on a fresh Supabase project.

-- Tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  default_target integer not null default 75 check (default_target between 50 and 95),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  target_percent integer not null default 75 check (target_percent between 50 and 95),
  initial_present integer not null default 0 check (initial_present >= 0),
  initial_total integer not null default 0 check (initial_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_initial_valid check (initial_present <= initial_total),
  constraint subjects_id_user_key unique (id, user_id)
);

create unique index subjects_user_name_key
  on public.subjects (user_id, lower(btrim(name)));

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  weekday integer not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time,
  created_at timestamptz not null default now(),
  constraint timetable_slots_time_valid check (end_time is null or end_time > start_time),
  constraint timetable_slots_subject_fk foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete cascade,
  constraint timetable_slots_user_day_start_key unique (user_id, weekday, start_time)
);

create table public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  slot_id uuid references public.timetable_slots (id) on delete set null,
  log_date date not null,
  status text not null check (status in ('present', 'absent', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_logs_subject_fk foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete cascade,
  constraint attendance_logs_slot_date_key unique (slot_id, log_date)
);

create index timetable_slots_user_weekday_idx on public.timetable_slots (user_id, weekday);
create index attendance_logs_user_date_idx on public.attendance_logs (user_id, log_date);
create index attendance_logs_subject_idx on public.attendance_logs (subject_id, log_date);

-- Per-subject counts. Cancelled classes are never counted as held.

create view public.subject_stats
with (security_invoker = true) as
select
  s.id as subject_id,
  s.user_id,
  (s.initial_present + count(l.id) filter (where l.status = 'present'))::integer as attended,
  (s.initial_total + count(l.id) filter (where l.status in ('present', 'absent')))::integer as conducted,
  (count(l.id) filter (where l.status = 'cancelled'))::integer as cancelled
from public.subjects s
left join public.attendance_logs l
  on l.subject_id = s.id and l.user_id = s.user_id
group by s.id, s.user_id, s.initial_present, s.initial_total;
