-- NutriCoach — Supabase schema for optional cloud sync
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Tables mirror the local Dexie.js stores. Full records are kept as JSONB
-- (the device remains the source of truth); indexed columns expose the keys
-- the app queries by. Row Level Security restricts every row to its owner.

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users manage own profile"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- food_logs
-- ---------------------------------------------------------------------------
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, created_at)
);

create index if not exists food_logs_user_date_idx on public.food_logs (user_id, date);

alter table public.food_logs enable row level security;

create policy "Users manage own food logs"
  on public.food_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger food_logs_updated_at
  before update on public.food_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- daily_summaries
-- ---------------------------------------------------------------------------
create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_summaries enable row level security;

create policy "Users manage own summaries"
  on public.daily_summaries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger daily_summaries_updated_at
  before update on public.daily_summaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- weekly_insights
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_insights enable row level security;

create policy "Users manage own insights"
  on public.weekly_insights for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger weekly_insights_updated_at
  before update on public.weekly_insights
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth providers
-- ---------------------------------------------------------------------------
-- Email/password is enabled by default in Supabase.
-- For Google OAuth: Dashboard → Authentication → Providers → Google,
-- then add your OAuth client ID/secret from Google Cloud Console and set the
-- authorised redirect URI shown by Supabase.
