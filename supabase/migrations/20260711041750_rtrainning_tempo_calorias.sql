alter table public.workout_sessions
  add column if not exists started_at timestamptz null,
  add column if not exists duration_seconds integer null,
  add column if not exists calories_estimate numeric null;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_duration_seconds_nonnegative,
  add constraint workout_sessions_duration_seconds_nonnegative
    check (duration_seconds is null or duration_seconds >= 0);

alter table public.workout_sessions
  drop constraint if exists workout_sessions_calories_estimate_nonnegative,
  add constraint workout_sessions_calories_estimate_nonnegative
    check (calories_estimate is null or calories_estimate >= 0);
