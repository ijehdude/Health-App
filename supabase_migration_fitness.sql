-- health-app — Fitness expansion migration (exercise + race coaching)
-- Run this in the Supabase SQL editor AFTER supabase_schema.sql.
--
-- Adds three per-user tables mirroring the new Dexie stores. Like the existing
-- tables, full records live in JSONB `data`; indexed columns expose the keys
-- the sync engine queries by. Row Level Security restricts every row to its
-- owner. Re-runnable: uses IF NOT EXISTS / idempotent policy drops.

-- ---------------------------------------------------------------------------
-- exercise_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.exercise_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, created_at)
);

create index if not exists exercise_sessions_user_date_idx
  on public.exercise_sessions (user_id, date);

alter table public.exercise_sessions enable row level security;

drop policy if exists "Users manage own exercise sessions" on public.exercise_sessions;
create policy "Users manage own exercise sessions"
  on public.exercise_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists exercise_sessions_updated_at on public.exercise_sessions;
create trigger exercise_sessions_updated_at
  before update on public.exercise_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- race_goals  (one active goal per user, keyed by created_at)
-- ---------------------------------------------------------------------------
create table if not exists public.race_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, created_at)
);

alter table public.race_goals enable row level security;

drop policy if exists "Users manage own race goals" on public.race_goals;
create policy "Users manage own race goals"
  on public.race_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists race_goals_updated_at on public.race_goals;
create trigger race_goals_updated_at
  before update on public.race_goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- training_plans  (one active plan per user, keyed by created_at)
-- ---------------------------------------------------------------------------
create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, created_at)
);

alter table public.training_plans enable row level security;

drop policy if exists "Users manage own training plans" on public.training_plans;
create policy "Users manage own training plans"
  on public.training_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists training_plans_updated_at on public.training_plans;
create trigger training_plans_updated_at
  before update on public.training_plans
  for each row execute function public.set_updated_at();
