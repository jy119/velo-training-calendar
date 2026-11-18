-- VELO initial persistent backend
-- Apply to a Supabase project using the SQL Editor or CLI.
-- The application uses only the public anon key in the browser.
-- All personalized rows are restricted by auth.uid() via RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table if not exists public.athlete_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint athlete_state_json check (jsonb_typeof(payload) = 'object')
);
create index if not exists athlete_state_updated_idx on public.athlete_state(updated_at desc);
alter table public.athlete_state enable row level security;
create policy "state_select_own" on public.athlete_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "state_insert_own" on public.athlete_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "state_update_own" on public.athlete_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "state_delete_own" on public.athlete_state for delete to authenticated using ((select auth.uid()) = user_id);

-- Normalized ride records for a later Garmin / Strava sync.
-- Do not store OAuth secrets in this public table.
create table if not exists public.ride_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'manual')),
  provider_activity_id text not null,
  activity_date date not null,
  name text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_meters numeric,
  elevation_meters numeric,
  average_watts numeric,
  normalized_watts numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, provider, provider_activity_id)
);
create index if not exists ride_activities_owner_date_idx on public.ride_activities(user_id, activity_date desc);
alter table public.ride_activities enable row level security;
create policy "rides_select_own" on public.ride_activities for select to authenticated using ((select auth.uid()) = user_id);
create policy "rides_insert_own" on public.ride_activities for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "rides_update_own" on public.ride_activities for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "rides_delete_own" on public.ride_activities for delete to authenticated using ((select auth.uid()) = user_id);

-- Server-only token vault. No user-facing RLS policies on purpose.
-- Future provider OAuth handlers must execute on the trusted server,
-- encrypt token material before storage, and scope queries to the
-- authenticated user. Do not give the browser service_role access.
create table if not exists public.provider_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('strava', 'garmin', 'google_calendar')),
  encrypted_token_data text,
  scopes text[],
  provider_account_id text,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.provider_connections enable row level security;
revoke all on public.provider_connections from anon, authenticated;

-- Grant the user only access to their RLS-restricted tables.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.athlete_state to authenticated;
grant select, insert, update, delete on public.ride_activities to authenticated;

-- Disable anonymous access even if table grants change later.
revoke all on public.profiles from anon;
revoke all on public.athlete_state from anon;
revoke all on public.ride_activities from anon;

-- Important: RLS protects rows between athletes; authenticated users
-- can only access their own data. The public anon key is intentionally
-- browser-readable, while service-role keys MUST remain server-side.
