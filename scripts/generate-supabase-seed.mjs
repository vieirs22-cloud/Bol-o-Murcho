import { readFile, writeFile } from "node:fs/promises";

const fixture = JSON.parse(
  await readFile(new URL("../src/lib/bolao-fixture.json", import.meta.url), "utf8"),
);

const teamRows = fixture.teams;
const matches = fixture.groupMatches;

function sql(value) {
  if (value === null || value === undefined) {
    return "null";
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function values(rows) {
  return rows.map((row) => `  (${row.map(sql).join(", ")})`).join(",\n");
}

const teamValues = values(teamRows.map((team) => [
  team.id,
  team.name,
  team.code,
  team.flagEmoji,
  team.flagAsset,
  team.group,
]));
const matchValues = values(matches.map((match) => [
  match.id,
  "group_stage",
  match.group,
  match.round,
  match.homeTeamId,
  match.awayTeamId,
  match.startsAt,
  "scheduled",
]));

const output = `-- Super Bolao - initial backend seed
-- Fixture source: ${fixture.source} / ${fixture.sourceSheet}
-- Run after database/supabase_schema.sql in Supabase SQL Editor.
-- This script is idempotent. It upserts base data and preserves existing match_results.

begin;

insert into public.participants (id, name, email, password_hash, status, role)
values
  ('00000000-0000-0000-0000-000000000001', 'Leonardo Vieira', 'leonardo.v.vieira@gmail.com', crypt('Adm-xjMu4tR$nd%%rM', gen_salt('bf')), 'active', 'admin')
on conflict (email) do update set
  name = excluded.name,
  password_hash = excluded.password_hash,
  status = excluded.status,
  role = excluded.role,
  updated_at = now();

delete from public.participants
where lower(email::text) = 'participante@superbolao.com'
  and role = 'participant';

insert into public.teams (id, name, code, flag_emoji, flag_asset, group_code)
values
${teamValues}
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  flag_emoji = excluded.flag_emoji,
  flag_asset = excluded.flag_asset,
  group_code = excluded.group_code,
  updated_at = now();

insert into public.matches (id, stage, group_code, round, home_team_id, away_team_id, starts_at, status)
values
${matchValues}
on conflict (id) do update set
  stage = excluded.stage,
  group_code = excluded.group_code,
  round = excluded.round,
  home_team_id = excluded.home_team_id,
  away_team_id = excluded.away_team_id,
  starts_at = excluded.starts_at,
  status = excluded.status,
  updated_at = now();

insert into public.match_results (match_id, status, source)
select id, 'scheduled', 'seed'
from public.matches
on conflict (match_id) do nothing;

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

commit;
`;

await writeFile(new URL("../database/supabase_seed.sql", import.meta.url), output, "utf8");
await writeFile(new URL("../database/supabase_seed.txt", import.meta.url), output, "utf8");

console.log(`Generated seed with ${teamRows.length} teams and ${matches.length} matches.`);
