alter table public.workout_sessions
  add column if not exists cardio_type text null,
  add column if not exists cardio_minutes integer null,
  add column if not exists cardio_km numeric null;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_cardio_type_valid,
  add constraint workout_sessions_cardio_type_valid
    check (cardio_type is null or cardio_type in ('esteira', 'bike', 'escada'));

alter table public.workout_sessions
  drop constraint if exists workout_sessions_cardio_minutes_positive,
  add constraint workout_sessions_cardio_minutes_positive
    check (cardio_minutes is null or cardio_minutes > 0);

alter table public.workout_sessions
  drop constraint if exists workout_sessions_cardio_km_positive,
  add constraint workout_sessions_cardio_km_positive
    check (cardio_km is null or cardio_km > 0);
