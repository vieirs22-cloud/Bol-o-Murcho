-- Super Bolao - reset tournament fixture data
-- Use before applying supabase_seed.sql when replacing the fixture source.
-- Preserves participants, sessions, admin settings and webhook/audit history.

begin;

delete from public.result_events;
delete from public.result_ingestion_runs;
delete from public.external_match_mappings;
delete from public.ranking_entries;
delete from public.ranking_snapshots;
delete from public.knockout_predictions;
delete from public.match_predictions;
delete from public.initial_predictions;
delete from public.match_results;
delete from public.matches;
delete from public.teams;

commit;
