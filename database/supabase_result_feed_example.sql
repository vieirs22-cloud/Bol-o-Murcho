-- Super Bolao - result feed examples
-- The real backend/worker should call public.record_match_result(...)
-- after reading the official score from the external football API.

-- Group stage example:
select public.record_match_result(
  p_match_id => 'jogo-1',
  p_home_goals => 2,
  p_away_goals => 1,
  p_winner_team_id => null,
  p_status => 'finished',
  p_source => 'manual_admin_fallback',
  p_finished_at => now(),
  p_payload => '{"note":"Example payload"}'::jsonb
);

-- Knockout stages need the backend to create the official match first.
-- Example:
-- insert into public.matches (id, stage, round, home_team_id, away_team_id, starts_at, status)
-- values ('jogo-73', 'round_of_32', 1, 'mexico', 'catar', '2026-06-28 16:00:00-03', 'scheduled')
-- on conflict (id) do update set
--   home_team_id = excluded.home_team_id,
--   away_team_id = excluded.away_team_id,
--   starts_at = excluded.starts_at,
--   status = excluded.status,
--   updated_at = now();
--
-- select public.record_match_result(
--   p_match_id => 'jogo-73',
--   p_home_goals => 1,
--   p_away_goals => 1,
--   p_winner_team_id => 'brasil',
--   p_status => 'finished',
--   p_source => 'backend_api',
--   p_finished_at => now(),
--   p_payload => '{"provider":"external-api","providerMatchId":"123"}'::jsonb
-- );
