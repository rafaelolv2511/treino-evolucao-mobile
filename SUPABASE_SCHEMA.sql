-- ============================================================
-- Treino Evolução Mobile — Schema do Supabase
-- Já aplicado no projeto "musculacao projeto" via migration
-- "treino_evolucao_schema_inicial". Use este arquivo apenas se
-- precisar recriar o banco em outro projeto Supabase.
-- ============================================================
create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  plan_name text not null,
  source_json jsonb not null,
  start_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_training_plans_profile on training_plans(profile_id);
create index if not exists idx_training_plans_active on training_plans(profile_id, active);

create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  date date not null,
  weight_kg numeric(6,2) not null,
  created_at timestamptz not null default now(),
  unique (profile_id, date)
);
create index if not exists idx_body_metrics_profile on body_metrics(profile_id, date);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  training_plan_id uuid not null references training_plans(id) on delete cascade,
  session_key text not null,
  workout_date date not null,
  week_number integer not null,
  created_at timestamptz not null default now(),
  unique (training_plan_id, session_key, workout_date)
);
create index if not exists idx_workout_sessions_profile on workout_sessions(profile_id, workout_date);
create index if not exists idx_workout_sessions_plan on workout_sessions(training_plan_id);

create table if not exists exercise_logs (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id text not null,
  exercise_name_snapshot text not null,
  primary_muscle_group_snapshot text not null,
  target_rir integer,
  notes text default '',
  created_at timestamptz not null default now(),
  unique (workout_session_id, exercise_id)
);
create index if not exists idx_exercise_logs_session on exercise_logs(workout_session_id);
create index if not exists idx_exercise_logs_exercise on exercise_logs(exercise_id);

create table if not exists set_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null references exercise_logs(id) on delete cascade,
  set_number integer not null,
  load_kg numeric(7,2),
  reps_done integer,
  rir_done integer,
  carried_forward boolean not null default false,
  created_at timestamptz not null default now(),
  unique (exercise_log_id, set_number)
);
create index if not exists idx_set_logs_exercise_log on set_logs(exercise_log_id);

create table if not exists profile_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  note text not null default '',
  note_type text not null default 'geral',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, note_type)
);

create table if not exists exported_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  training_plan_id uuid references training_plans(id) on delete set null,
  report_json jsonb not null,
  report_markdown text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_exported_reports_profile on exported_reports(profile_id);

-- App sem autenticação (por escopo): RLS habilitado com política aberta para anon.
alter table profiles enable row level security;
alter table training_plans enable row level security;
alter table body_metrics enable row level security;
alter table workout_sessions enable row level security;
alter table exercise_logs enable row level security;
alter table set_logs enable row level security;
alter table profile_notes enable row level security;
alter table exported_reports enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','training_plans','body_metrics','workout_sessions','exercise_logs','set_logs','profile_notes','exported_reports']
  loop
    execute format('create policy "acesso_publico_%s" on %I for all using (true) with check (true)', t, t);
  end loop;
end $$;
