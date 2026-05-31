-- Super Bolao - static app API
-- RPC layer used by the Cloudflare static frontend through the Supabase publishable key.

create or replace function public.app_participant_json(p_participant public.participants)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', (p_participant).id::text,
    'name', (p_participant).name,
    'nickname', (p_participant).name,
    'email', (p_participant).email::text,
    'status', (p_participant).status,
    'role', (p_participant).role,
    'createdAt', (p_participant).created_at,
    'updatedAt', (p_participant).updated_at
  );
$$;

create or replace function public.app_current_participant(p_session_token text)
returns public.participants
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token_hash text;
  v_participant public.participants%rowtype;
begin
  if p_session_token is null or length(trim(p_session_token)) = 0 then
    return null;
  end if;

  v_token_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  select p.*
    into v_participant
  from public.auth_sessions s
  join public.participants p on p.id = s.participant_id
  where s.token_hash = v_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and p.status = 'active'
  limit 1;

  if v_participant.id is not null then
    update public.auth_sessions
       set last_seen_at = now()
     where token_hash = v_token_hash;
  end if;

  return v_participant;
end;
$$;

create or replace function public.app_get_state(p_session_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
  v_participants jsonb := '[]'::jsonb;
  v_teams jsonb := '[]'::jsonb;
  v_matches jsonb := '[]'::jsonb;
  v_initial_predictions jsonb := '[]'::jsonb;
  v_match_predictions jsonb := '[]'::jsonb;
  v_knockout_predictions jsonb := '[]'::jsonb;
  v_official_results jsonb := '[]'::jsonb;
  v_stage_controls jsonb := '[]'::jsonb;
begin
  select *
    into v_actor
  from public.app_current_participant(p_session_token);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'code', t.code,
      'flagEmoji', t.flag_emoji,
      'flagAsset', t.flag_asset,
      'group', t.group_code
    )
    order by t.group_code, t.name
  ), '[]'::jsonb)
    into v_teams
  from public.teams t;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'group', m.group_code,
      'round', m.round,
      'homeTeamId', m.home_team_id,
      'awayTeamId', m.away_team_id,
      'startsAt', m.starts_at,
      'status', m.status
    )
    order by m.group_code, m.round, case when m.id ~ '^jogo-[0-9]+$' then substring(m.id from 6)::integer else 999999 end, m.id
  ), '[]'::jsonb)
    into v_matches
  from public.matches m
  where m.stage = 'group_stage';

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sc.id::text,
      'stage', sc.stage,
      'isOpen', sc.is_open,
      'deadlineAt', sc.deadline_at,
      'updatedAt', sc.updated_at
    )
    order by sc.stage
  ), '[]'::jsonb)
    into v_stage_controls
  from public.stage_controls sc
  where sc.is_visible = true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', 'result-' || mr.match_id,
      'stage', m.stage,
      'matchId', mr.match_id,
      'homeTeamId', m.home_team_id,
      'awayTeamId', m.away_team_id,
      'homeGoals', mr.home_goals,
      'awayGoals', mr.away_goals,
      'winnerTeamId', mr.winner_team_id,
      'updatedAt', mr.updated_at
    )
    order by m.stage, mr.match_id
  ), '[]'::jsonb)
    into v_official_results
  from public.match_results mr
  join public.matches m on m.id = mr.match_id;

  if v_actor.id is not null then
    select coalesce(jsonb_agg(public.app_participant_json(p) order by p.name), '[]'::jsonb)
      into v_participants
    from public.participants p
    where v_actor.role = 'admin'
       or p.status = 'active';

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', ip.id::text,
        'participantId', ip.participant_id::text,
        'championTeamId', ip.champion_team_id,
        'runnerUpTeamId', ip.runner_up_team_id,
        'topScorer', ip.top_scorer,
        'bestPlayer', ip.best_player,
        'submittedAt', ip.submitted_at,
        'updatedAt', ip.updated_at
      )
      order by ip.updated_at
    ), '[]'::jsonb)
      into v_initial_predictions
    from public.initial_predictions ip
    join public.participants p on p.id = ip.participant_id
    where v_actor.role = 'admin'
       or p.status = 'active';

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', mp.id::text,
        'participantId', mp.participant_id::text,
        'matchId', mp.match_id,
        'homeGoals', mp.home_goals,
        'awayGoals', mp.away_goals,
        'submittedAt', mp.submitted_at,
        'updatedAt', mp.updated_at
      )
      order by mp.match_id
    ), '[]'::jsonb)
      into v_match_predictions
    from public.match_predictions mp
    join public.participants p on p.id = mp.participant_id
    where v_actor.role = 'admin'
       or p.status = 'active';

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', kp.id::text,
        'participantId', kp.participant_id::text,
        'stage', kp.stage,
        'matchId', kp.match_id,
        'homeTeamId', kp.home_team_id,
        'awayTeamId', kp.away_team_id,
        'homeGoals', kp.home_goals,
        'awayGoals', kp.away_goals,
        'winnerTeamId', kp.winner_team_id,
        'submittedAt', kp.submitted_at,
        'updatedAt', kp.updated_at
      )
      order by kp.stage, kp.match_id
    ), '[]'::jsonb)
      into v_knockout_predictions
    from public.knockout_predictions kp
    join public.participants p on p.id = kp.participant_id
    where v_actor.role = 'admin'
       or p.status = 'active';
  end if;

  return jsonb_build_object(
    'currentParticipantId', case when v_actor.id is null then null else v_actor.id::text end,
    'participants', v_participants,
    'teams', v_teams,
    'matches', v_matches,
    'initialPredictions', v_initial_predictions,
    'matchPredictions', v_match_predictions,
    'knockoutPredictions', v_knockout_predictions,
    'officialResults', v_official_results,
    'stageControls', v_stage_controls
  );
end;
$$;

create or replace function public.app_login(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_participant public.participants%rowtype;
  v_session_token text;
begin
  select *
    into v_participant
  from public.participants
  where lower(email::text) = lower(trim(p_email))
  limit 1;

  if v_participant.id is null
     or v_participant.status <> 'active'
     or v_participant.password_hash <> crypt(p_password, v_participant.password_hash) then
    raise exception 'invalid_credentials' using errcode = '28000';
  end if;

  v_session_token := encode(gen_random_bytes(32), 'hex');

  insert into public.auth_sessions (
    participant_id,
    token_hash,
    expires_at,
    last_seen_at
  )
  values (
    v_participant.id,
    encode(digest(v_session_token, 'sha256'), 'hex'),
    now() + interval '30 days',
    now()
  );

  update public.participants
     set last_login_at = now()
   where id = v_participant.id;

  return jsonb_build_object(
    'sessionToken', v_session_token,
    'participant', public.app_participant_json(v_participant),
    'state', public.app_get_state(v_session_token)
  );
end;
$$;

create or replace function public.app_stage_has_started(p_stage stage_name)
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_result_stage stage_name;
begin
  if p_stage = 'initial_predictions' then
    v_result_stage := 'group_stage';
  elsif p_stage = 'ranking' then
    return false;
  else
    v_result_stage := p_stage;
  end if;

  return exists (
    select 1
    from public.match_results mr
    join public.matches m on m.id = mr.match_id
    where m.stage = v_result_stage
      and (
        mr.home_goals is not null
        or mr.away_goals is not null
        or mr.winner_team_id is not null
        or mr.status in ('live', 'finished')
      )
  );
end;
$$;

create or replace function public.app_stage_accepts_predictions(p_stage stage_name)
returns boolean
language plpgsql
security definer
stable
set search_path = public, extensions
as $$
declare
  v_control public.stage_controls%rowtype;
  v_previous_stage stage_name;
  v_total_matches integer;
  v_complete_results integer;
begin
  select *
    into v_control
  from public.stage_controls
  where stage = p_stage;

  if not coalesce(v_control.is_open, false) then
    return false;
  end if;

  if v_control.deadline_at is not null and now() >= v_control.deadline_at then
    return false;
  end if;

  v_previous_stage := case p_stage
    when 'round_of_32' then 'group_stage'::stage_name
    when 'round_of_16' then 'round_of_32'::stage_name
    when 'quarter_finals' then 'round_of_16'::stage_name
    when 'semi_finals' then 'quarter_finals'::stage_name
    when 'final' then 'semi_finals'::stage_name
    else null
  end;

  if v_previous_stage is not null then
    select count(*)
      into v_total_matches
    from public.matches
    where stage = v_previous_stage;

    if coalesce(v_total_matches, 0) = 0 then
      return false;
    end if;

    select count(*)
      into v_complete_results
    from public.match_results mr
    join public.matches m on m.id = mr.match_id
    where m.stage = v_previous_stage
      and mr.home_goals is not null
      and mr.away_goals is not null
      and (
        v_previous_stage = 'group_stage'
        or mr.home_goals <> mr.away_goals
        or mr.winner_team_id is not null
      );

    if coalesce(v_complete_results, 0) < v_total_matches then
      return false;
    end if;
  end if;

  if public.app_stage_has_started(p_stage) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.app_save_initial_prediction(
  p_session_token text,
  p_champion_team_id text,
  p_runner_up_team_id text,
  p_top_scorer text,
  p_best_player text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
  v_control public.stage_controls%rowtype;
begin
  select * into v_actor from public.app_current_participant(p_session_token);
  if v_actor.id is null then
    raise exception 'invalid_session' using errcode = '28000';
  end if;

  if not public.app_stage_accepts_predictions('initial_predictions') then
    raise exception 'stage_locked';
  end if;

  if p_champion_team_id is null
     or p_runner_up_team_id is null
     or length(trim(p_top_scorer)) = 0
     or length(trim(p_best_player)) = 0 then
    raise exception 'missing_required_fields';
  end if;

  if p_champion_team_id = p_runner_up_team_id then
    raise exception 'same_finalists';
  end if;

  insert into public.initial_predictions (
    participant_id,
    champion_team_id,
    runner_up_team_id,
    top_scorer,
    best_player,
    submitted_at
  )
  values (
    v_actor.id,
    p_champion_team_id,
    p_runner_up_team_id,
    trim(p_top_scorer),
    trim(p_best_player),
    now()
  )
  on conflict (participant_id) do update set
    champion_team_id = excluded.champion_team_id,
    runner_up_team_id = excluded.runner_up_team_id,
    top_scorer = excluded.top_scorer,
    best_player = excluded.best_player,
    updated_at = now();

  return public.app_get_state(p_session_token);
end;
$$;

create or replace function public.app_save_match_predictions(
  p_session_token text,
  p_predictions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
  v_control public.stage_controls%rowtype;
  v_item jsonb;
  v_match_id text;
  v_home_goals integer;
  v_away_goals integer;
begin
  select * into v_actor from public.app_current_participant(p_session_token);
  if v_actor.id is null then
    raise exception 'invalid_session' using errcode = '28000';
  end if;

  if not public.app_stage_accepts_predictions('group_stage') then
    raise exception 'stage_locked';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_predictions, '[]'::jsonb))
  loop
    v_match_id := v_item->>'matchId';
    v_home_goals := nullif(v_item->>'homeGoals', '')::integer;
    v_away_goals := nullif(v_item->>'awayGoals', '')::integer;

    if not exists (select 1 from public.matches where id = v_match_id and stage = 'group_stage') then
      raise exception 'invalid_match %', v_match_id;
    end if;

    insert into public.match_predictions (
      participant_id,
      match_id,
      home_goals,
      away_goals,
      submitted_at
    )
    values (
      v_actor.id,
      v_match_id,
      v_home_goals,
      v_away_goals,
      case when v_home_goals is not null and v_away_goals is not null then now() else null end
    )
    on conflict (participant_id, match_id) do update set
      home_goals = excluded.home_goals,
      away_goals = excluded.away_goals,
      submitted_at = coalesce(public.match_predictions.submitted_at, excluded.submitted_at),
      updated_at = now();
  end loop;

  return public.app_get_state(p_session_token);
end;
$$;

create or replace function public.app_save_knockout_predictions(
  p_session_token text,
  p_stage stage_name,
  p_predictions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
  v_control public.stage_controls%rowtype;
  v_item jsonb;
  v_match_id text;
  v_home_team_id text;
  v_away_team_id text;
  v_home_goals integer;
  v_away_goals integer;
  v_winner_team_id text;
begin
  select * into v_actor from public.app_current_participant(p_session_token);
  if v_actor.id is null then
    raise exception 'invalid_session' using errcode = '28000';
  end if;

  if p_stage not in ('round_of_32','round_of_16','quarter_finals','semi_finals','final') then
    raise exception 'invalid_stage';
  end if;

  if not public.app_stage_accepts_predictions(p_stage) then
    raise exception 'stage_locked';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_predictions, '[]'::jsonb))
  loop
    v_match_id := v_item->>'matchId';
    v_home_team_id := v_item->>'homeTeamId';
    v_away_team_id := v_item->>'awayTeamId';
    v_home_goals := nullif(v_item->>'homeGoals', '')::integer;
    v_away_goals := nullif(v_item->>'awayGoals', '')::integer;
    v_winner_team_id := nullif(v_item->>'winnerTeamId', '');

    insert into public.knockout_predictions (
      participant_id,
      stage,
      match_id,
      home_team_id,
      away_team_id,
      home_goals,
      away_goals,
      winner_team_id,
      submitted_at
    )
    values (
      v_actor.id,
      p_stage,
      v_match_id,
      v_home_team_id,
      v_away_team_id,
      v_home_goals,
      v_away_goals,
      v_winner_team_id,
      case when v_home_goals is not null and v_away_goals is not null then now() else null end
    )
    on conflict (participant_id, stage, match_id) do update set
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      home_goals = excluded.home_goals,
      away_goals = excluded.away_goals,
      winner_team_id = excluded.winner_team_id,
      submitted_at = coalesce(public.knockout_predictions.submitted_at, excluded.submitted_at),
      updated_at = now();
  end loop;

  return public.app_get_state(p_session_token);
end;
$$;

create or replace function public.app_admin_upsert_participant(
  p_session_token text,
  p_participant_id uuid default null,
  p_name text default null,
  p_email text default null,
  p_password text default null,
  p_status participant_status default 'active'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
  v_participant_id uuid;
begin
  select * into v_actor from public.app_current_participant(p_session_token);
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'admin_required' using errcode = '28000';
  end if;

  if length(trim(coalesce(p_name, ''))) = 0 or length(trim(coalesce(p_email, ''))) = 0 then
    raise exception 'missing_required_fields';
  end if;

  if p_participant_id is null then
    if length(trim(coalesce(p_password, ''))) = 0 then
      raise exception 'password_required';
    end if;

    insert into public.participants (
      name,
      email,
      password_hash,
      status,
      role
    )
    values (
      trim(p_name),
      trim(p_email),
      crypt(p_password, gen_salt('bf')),
      p_status,
      'participant'
    )
    returning id into v_participant_id;

    insert into public.webhook_events (
      event_type,
      participant_id,
      payload
    )
    values (
      'participant.created',
      v_participant_id,
      jsonb_build_object(
        'name', trim(p_name),
        'email', trim(p_email),
        'integration', 'n8n'
      )
    );
  else
    update public.participants
       set name = trim(p_name),
           email = trim(p_email),
           password_hash = case
             when length(trim(coalesce(p_password, ''))) > 0 then crypt(p_password, gen_salt('bf'))
             else password_hash
           end,
           status = p_status,
           updated_at = now()
     where id = p_participant_id
       and role = 'participant'
     returning id into v_participant_id;

    if v_participant_id is null then
      raise exception 'participant_not_found';
    end if;
  end if;

  return public.app_get_state(p_session_token);
end;
$$;

create or replace function public.app_admin_toggle_participant(
  p_session_token text,
  p_participant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
begin
  select * into v_actor from public.app_current_participant(p_session_token);
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'admin_required' using errcode = '28000';
  end if;

  update public.participants
     set status = case when status = 'active' then 'inactive'::participant_status else 'active'::participant_status end,
         updated_at = now()
   where id = p_participant_id
     and role = 'participant';

  return public.app_get_state(p_session_token);
end;
$$;

create or replace function public.app_admin_update_stage_control(
  p_session_token text,
  p_stage stage_name,
  p_is_open boolean,
  p_deadline_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
begin
  select * into v_actor from public.app_current_participant(p_session_token);
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'admin_required' using errcode = '28000';
  end if;

  update public.stage_controls
     set is_open = p_is_open,
         deadline_at = p_deadline_at,
         updated_by = v_actor.id,
         updated_at = now()
   where stage = p_stage;

  if p_stage in ('initial_predictions','group_stage') and p_deadline_at is not null then
    update public.stage_controls
       set deadline_at = p_deadline_at,
           updated_by = v_actor.id,
           updated_at = now()
     where stage in ('initial_predictions','group_stage');
  end if;

  return public.app_get_state(p_session_token);
end;
$$;

create or replace function public.app_admin_record_official_result(
  p_session_token text,
  p_stage stage_name,
  p_match_id text,
  p_home_team_id text,
  p_away_team_id text,
  p_home_goals integer default null,
  p_away_goals integer default null,
  p_winner_team_id text default null,
  p_round integer default 1,
  p_group_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor public.participants%rowtype;
  v_winner_team_id text;
  v_status match_status;
begin
  select * into v_actor from public.app_current_participant(p_session_token);
  if v_actor.id is null or v_actor.role <> 'admin' then
    raise exception 'admin_required' using errcode = '28000';
  end if;

  if p_stage <> 'group_stage' and p_winner_team_id is null and p_home_goals is not null and p_home_goals <> p_away_goals then
    v_winner_team_id := case when p_home_goals > p_away_goals then p_home_team_id else p_away_team_id end;
  else
    v_winner_team_id := p_winner_team_id;
  end if;

  insert into public.matches (
    id,
    stage,
    group_code,
    round,
    home_team_id,
    away_team_id,
    starts_at,
    status
  )
  values (
    p_match_id,
    p_stage,
    p_group_code,
    greatest(coalesce(p_round, 1), 1),
    p_home_team_id,
    p_away_team_id,
    now(),
    case
      when p_home_goals is null and p_away_goals is null then 'scheduled'::match_status
      when p_home_goals is null or p_away_goals is null then 'live'::match_status
      else 'finished'::match_status
    end
  )
  on conflict (id) do update set
    stage = excluded.stage,
    group_code = excluded.group_code,
    round = excluded.round,
    home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id,
    status = excluded.status,
    updated_at = now();

  v_status := case
    when p_home_goals is null and p_away_goals is null then 'scheduled'::match_status
    when p_home_goals is null or p_away_goals is null then 'live'::match_status
    else 'finished'::match_status
  end;

  perform public.record_match_result(
    p_match_id,
    p_home_goals,
    p_away_goals,
    v_winner_team_id,
    v_status,
    'admin-fallback',
    case when v_status = 'finished' then now() else null end,
    jsonb_build_object('updatedBy', v_actor.id::text)
  );

  update public.match_results
     set updated_by = v_actor.id
   where match_id = p_match_id;

  return public.app_get_state(p_session_token);
end;
$$;

revoke execute on function public.record_match_result(text, integer, integer, text, match_status, text, timestamptz, jsonb) from anon, authenticated, public;

grant execute on function public.app_get_state(text) to anon, authenticated;
grant execute on function public.app_login(text, text) to anon, authenticated;
grant execute on function public.app_stage_has_started(stage_name) to anon, authenticated;
grant execute on function public.app_stage_accepts_predictions(stage_name) to anon, authenticated;
grant execute on function public.app_save_initial_prediction(text, text, text, text, text) to anon, authenticated;
grant execute on function public.app_save_match_predictions(text, jsonb) to anon, authenticated;
grant execute on function public.app_save_knockout_predictions(text, stage_name, jsonb) to anon, authenticated;
grant execute on function public.app_admin_upsert_participant(text, uuid, text, text, text, participant_status) to anon, authenticated;
grant execute on function public.app_admin_toggle_participant(text, uuid) to anon, authenticated;
grant execute on function public.app_admin_update_stage_control(text, stage_name, boolean, timestamptz) to anon, authenticated;
grant execute on function public.app_admin_record_official_result(text, stage_name, text, text, text, integer, integer, text, integer, text) to anon, authenticated;

notify pgrst, 'reload schema';
