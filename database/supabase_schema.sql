-- Super Bolao - Supabase schema
-- Run this file in Supabase SQL Editor.
-- The app should access these tables through a backend/API using the service role.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type participant_role as enum ('participant', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type participant_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type stage_name as enum (
    'initial_predictions',
    'group_stage',
    'ranking',
    'round_of_32',
    'round_of_16',
    'quarter_finals',
    'semi_finals',
    'final'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type match_status as enum ('scheduled', 'live', 'finished');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type webhook_status as enum ('pending', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext not null unique,
  password_hash text not null,
  status participant_status not null default 'active',
  role participant_role not null default 'participant',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_name_not_empty check (length(trim(name)) > 0),
  constraint participants_email_not_empty check (length(trim(email::text)) > 0)
);

create table if not exists public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  code text not null,
  flag_emoji text not null,
  flag_asset text,
  group_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_name_not_empty check (length(trim(name)) > 0),
  constraint teams_code_not_empty check (length(trim(code)) > 0),
  constraint teams_group_code_valid check (
    group_code is null or group_code in ('A','B','C','D','E','F','G','H','I','J','K','L')
  )
);

create table if not exists public.matches (
  id text primary key,
  stage stage_name not null default 'group_stage',
  group_code text,
  round integer not null,
  home_team_id text not null references public.teams(id),
  away_team_id text not null references public.teams(id),
  starts_at timestamptz not null,
  status match_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_round_positive check (round > 0),
  constraint matches_home_away_different check (home_team_id <> away_team_id),
  constraint matches_group_code_valid check (
    group_code is null or group_code in ('A','B','C','D','E','F','G','H','I','J','K','L')
  )
);

create table if not exists public.match_results (
  match_id text primary key references public.matches(id) on delete cascade,
  home_goals integer,
  away_goals integer,
  winner_team_id text references public.teams(id),
  status match_status not null default 'scheduled',
  source text,
  finished_at timestamptz,
  updated_by uuid references public.participants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_results_goals_valid check (
    (home_goals is null and away_goals is null)
    or (home_goals >= 0 and away_goals >= 0)
  ),
  constraint match_results_goals_together check (
    (home_goals is null and away_goals is null)
    or (home_goals is not null and away_goals is not null)
  )
);

alter table public.match_results
  drop constraint if exists match_results_goals_together;

create table if not exists public.stage_controls (
  id uuid primary key default gen_random_uuid(),
  stage stage_name not null unique,
  is_open boolean not null default false,
  is_visible boolean not null default true,
  deadline_at timestamptz,
  updated_by uuid references public.participants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.initial_predictions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  champion_team_id text not null references public.teams(id),
  runner_up_team_id text not null references public.teams(id),
  top_scorer text not null,
  best_player text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint initial_predictions_one_per_participant unique (participant_id),
  constraint initial_predictions_different_finalists check (champion_team_id <> runner_up_team_id),
  constraint initial_predictions_top_scorer_not_empty check (length(trim(top_scorer)) > 0),
  constraint initial_predictions_best_player_not_empty check (length(trim(best_player)) > 0)
);

create table if not exists public.match_predictions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  home_goals integer,
  away_goals integer,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint match_predictions_one_per_match unique (participant_id, match_id),
  constraint match_predictions_goals_valid check (
    (home_goals is null and away_goals is null)
    or (home_goals >= 0 and away_goals >= 0)
  ),
  constraint match_predictions_goals_together check (
    (home_goals is null and away_goals is null)
    or (home_goals is not null and away_goals is not null)
  )
);

create table if not exists public.knockout_predictions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  stage stage_name not null,
  match_id text not null,
  home_team_id text not null references public.teams(id),
  away_team_id text not null references public.teams(id),
  home_goals integer,
  away_goals integer,
  winner_team_id text references public.teams(id),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint knockout_predictions_one_per_match unique (participant_id, stage, match_id),
  constraint knockout_predictions_stage_valid check (stage in ('round_of_32','round_of_16','quarter_finals','semi_finals','final')),
  constraint knockout_predictions_home_away_different check (home_team_id <> away_team_id),
  constraint knockout_predictions_goals_valid check (
    (home_goals is null and away_goals is null)
    or (home_goals >= 0 and away_goals >= 0)
  ),
  constraint knockout_predictions_goals_together check (
    (home_goals is null and away_goals is null)
    or (home_goals is not null and away_goals is not null)
  ),
  constraint knockout_predictions_winner_valid check (
    winner_team_id is null or winner_team_id = home_team_id or winner_team_id = away_team_id
  )
);

create table if not exists public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Classificação Geral',
  calculation_version text not null default 'mvp-zero-points',
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ranking_entries (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.ranking_snapshots(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  position integer not null,
  points integer not null default 0,
  filled_predictions integer not null default 0,
  total_predictions integer not null default 0,
  last_prediction_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ranking_entries_position_positive check (position > 0),
  constraint ranking_entries_points_non_negative check (points >= 0),
  constraint ranking_entries_unique_participant unique (snapshot_id, participant_id),
  constraint ranking_entries_unique_position unique (snapshot_id, position)
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_participant_id uuid references public.participants(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_empty check (length(trim(action)) > 0),
  constraint audit_logs_entity_type_not_empty check (length(trim(entity_type)) > 0)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  participant_id uuid references public.participants(id) on delete set null,
  target_url text,
  payload jsonb not null default '{}'::jsonb,
  status webhook_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint webhook_events_event_type_not_empty check (length(trim(event_type)) > 0),
  constraint webhook_events_attempts_non_negative check (attempts >= 0)
);

create table if not exists public.external_match_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_match_id text not null,
  match_id text not null references public.matches(id) on delete cascade,
  stage stage_name not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_match_mappings_provider_not_empty check (length(trim(provider)) > 0),
  constraint external_match_mappings_provider_match_not_empty check (length(trim(provider_match_id)) > 0),
  constraint external_match_mappings_unique_provider_match unique (provider, provider_match_id),
  constraint external_match_mappings_unique_match unique (provider, match_id)
);

create table if not exists public.result_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'pending',
  matches_checked integer not null default 0,
  matches_updated integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint result_ingestion_runs_provider_not_empty check (length(trim(provider)) > 0),
  constraint result_ingestion_runs_status_valid check (status in ('pending','running','success','failed')),
  constraint result_ingestion_runs_counts_valid check (matches_checked >= 0 and matches_updated >= 0)
);

create table if not exists public.result_events (
  id bigserial primary key,
  match_id text not null references public.matches(id) on delete cascade,
  provider text,
  event_type text not null,
  old_result jsonb,
  new_result jsonb not null,
  created_at timestamptz not null default now(),
  constraint result_events_event_type_not_empty check (length(trim(event_type)) > 0)
);

create or replace function public.record_match_result(
  p_match_id text,
  p_home_goals integer,
  p_away_goals integer,
  p_winner_team_id text default null,
  p_status match_status default 'finished',
  p_source text default 'backend',
  p_finished_at timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_result jsonb;
  current_result jsonb;
begin
  if p_winner_team_id is not null and not exists (
    select 1
    from public.matches
    where id = p_match_id
      and p_winner_team_id in (home_team_id, away_team_id)
  ) then
    raise exception 'winner_team_id % is not valid for match %', p_winner_team_id, p_match_id;
  end if;

  select to_jsonb(mr)
    into previous_result
  from public.match_results mr
  where mr.match_id = p_match_id;

  insert into public.match_results (
    match_id,
    home_goals,
    away_goals,
    winner_team_id,
    status,
    source,
    finished_at
  )
  values (
    p_match_id,
    p_home_goals,
    p_away_goals,
    p_winner_team_id,
    p_status,
    p_source,
    coalesce(p_finished_at, case when p_status = 'finished' then now() else null end)
  )
  on conflict (match_id) do update set
    home_goals = excluded.home_goals,
    away_goals = excluded.away_goals,
    winner_team_id = excluded.winner_team_id,
    status = excluded.status,
    source = excluded.source,
    finished_at = excluded.finished_at,
    updated_at = now();

  select to_jsonb(mr)
    into current_result
  from public.match_results mr
  where mr.match_id = p_match_id;

  insert into public.result_events (
    match_id,
    provider,
    event_type,
    old_result,
    new_result
  )
  values (
    p_match_id,
    p_source,
    case when previous_result is null then 'created' else 'updated' end,
    previous_result,
    jsonb_build_object(
      'result', current_result,
      'payload', coalesce(p_payload, '{}'::jsonb)
    )
  );
end;
$$;

create index if not exists participants_status_role_idx on public.participants(status, role);
create index if not exists auth_sessions_participant_idx on public.auth_sessions(participant_id);
create index if not exists auth_sessions_expires_idx on public.auth_sessions(expires_at);
create index if not exists teams_group_code_idx on public.teams(group_code);
create index if not exists matches_stage_group_round_idx on public.matches(stage, group_code, round);
create index if not exists matches_starts_at_idx on public.matches(starts_at);
create index if not exists match_predictions_participant_idx on public.match_predictions(participant_id);
create index if not exists match_predictions_match_idx on public.match_predictions(match_id);
create index if not exists knockout_predictions_participant_stage_idx on public.knockout_predictions(participant_id, stage);
create index if not exists knockout_predictions_match_idx on public.knockout_predictions(match_id);
create index if not exists ranking_entries_snapshot_points_idx on public.ranking_entries(snapshot_id, points desc, position asc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_participant_id);
create index if not exists webhook_events_status_idx on public.webhook_events(status, created_at);
create index if not exists external_match_mappings_match_idx on public.external_match_mappings(match_id);
create index if not exists result_ingestion_runs_provider_started_idx on public.result_ingestion_runs(provider, started_at desc);
create index if not exists result_events_match_created_idx on public.result_events(match_id, created_at desc);

drop trigger if exists participants_set_updated_at on public.participants;
create trigger participants_set_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists match_results_set_updated_at on public.match_results;
create trigger match_results_set_updated_at
before update on public.match_results
for each row execute function public.set_updated_at();

drop trigger if exists stage_controls_set_updated_at on public.stage_controls;
create trigger stage_controls_set_updated_at
before update on public.stage_controls
for each row execute function public.set_updated_at();

drop trigger if exists initial_predictions_set_updated_at on public.initial_predictions;
create trigger initial_predictions_set_updated_at
before update on public.initial_predictions
for each row execute function public.set_updated_at();

drop trigger if exists match_predictions_set_updated_at on public.match_predictions;
create trigger match_predictions_set_updated_at
before update on public.match_predictions
for each row execute function public.set_updated_at();

drop trigger if exists knockout_predictions_set_updated_at on public.knockout_predictions;
create trigger knockout_predictions_set_updated_at
before update on public.knockout_predictions
for each row execute function public.set_updated_at();

drop trigger if exists webhook_events_set_updated_at on public.webhook_events;
create trigger webhook_events_set_updated_at
before update on public.webhook_events
for each row execute function public.set_updated_at();

drop trigger if exists external_match_mappings_set_updated_at on public.external_match_mappings;
create trigger external_match_mappings_set_updated_at
before update on public.external_match_mappings
for each row execute function public.set_updated_at();

insert into public.stage_controls (stage, is_open, is_visible, deadline_at)
values
  ('initial_predictions', true, true, '2026-06-11 12:00:00-03'),
  ('group_stage', true, true, '2026-06-11 12:00:00-03'),
  ('round_of_32', true, true, '2026-06-28 12:00:00-03'),
  ('round_of_16', true, true, '2026-07-04 12:00:00-03'),
  ('quarter_finals', true, true, '2026-07-09 12:00:00-03'),
  ('semi_finals', true, true, '2026-07-14 12:00:00-03'),
  ('final', true, true, '2026-07-19 12:00:00-03'),
  ('ranking', true, true, null)
on conflict (stage) do update set
  is_open = excluded.is_open,
  is_visible = excluded.is_visible,
  deadline_at = excluded.deadline_at,
  updated_at = now();

alter table public.participants enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.match_results enable row level security;
alter table public.stage_controls enable row level security;
alter table public.initial_predictions enable row level security;
alter table public.match_predictions enable row level security;
alter table public.knockout_predictions enable row level security;
alter table public.ranking_snapshots enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.external_match_mappings enable row level security;
alter table public.result_ingestion_runs enable row level security;
alter table public.result_events enable row level security;

drop policy if exists "Public read teams" on public.teams;
create policy "Public read teams"
on public.teams
for select
to anon, authenticated
using (true);

drop policy if exists "Public read matches" on public.matches;
create policy "Public read matches"
on public.matches
for select
to anon, authenticated
using (true);

drop policy if exists "Public read match results" on public.match_results;
create policy "Public read match results"
on public.match_results
for select
to anon, authenticated
using (true);

drop policy if exists "Public read stage controls" on public.stage_controls;
create policy "Public read stage controls"
on public.stage_controls
for select
to anon, authenticated
using (true);

-- Public read is enabled only for non-sensitive tournament data used by the static frontend.
-- Use a backend/API with the Supabase service role key to enforce:
-- 1. active participant only;
-- 2. admin-only participant/config updates;
-- 3. no edits after the shared deadline;
-- 4. initial champion and runner-up cannot be the same;
-- 5. match predictions must have both scores or both null.
-- 6. official results should be written by backend ingestion first, with admin editing as fallback.
