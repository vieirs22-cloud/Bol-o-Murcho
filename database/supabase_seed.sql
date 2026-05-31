-- Super Bolao - initial backend seed
-- Fixture source: Placares.xlsx / Placares
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
  ('mexico', 'México', 'MX', '', '/flags/mx.svg', 'A'),
  ('africa-do-sul', 'África do Sul', 'ZA', '', '/flags/za.svg', 'A'),
  ('coreia-do-sul', 'Coreia do Sul', 'KR', '', '/flags/kr.svg', 'A'),
  ('tchequia', 'Tchéquia', 'CZ', '', '/flags/cz.svg', 'A'),
  ('canada', 'Canadá', 'CA', '', '/flags/ca.svg', 'B'),
  ('bosnia-herzegovina', 'Bósnia-Herzegovina', 'BA', '', '/flags/ba.svg', 'B'),
  ('catar', 'Catar', 'QA', '', '/flags/qa.svg', 'B'),
  ('suica', 'Suíça', 'CH', '', '/flags/ch.svg', 'B'),
  ('brasil', 'Brasil', 'BR', '', '/flags/br.svg', 'C'),
  ('marrocos', 'Marrocos', 'MA', '', '/flags/ma.svg', 'C'),
  ('haiti', 'Haiti', 'HT', '', '/flags/ht.svg', 'C'),
  ('escocia', 'Escócia', 'GB-SCT', '', '/flags/gb-sct.svg', 'C'),
  ('estados-unidos', 'Estados Unidos', 'US', '', '/flags/us.svg', 'D'),
  ('paraguai', 'Paraguai', 'PY', '', '/flags/py.svg', 'D'),
  ('australia', 'Austrália', 'AU', '', '/flags/au.svg', 'D'),
  ('turquia', 'Turquia', 'TR', '', '/flags/tr.svg', 'D'),
  ('alemanha', 'Alemanha', 'DE', '', '/flags/de.svg', 'E'),
  ('curacao', 'Curaçao', 'CW', '', '/flags/cw.svg', 'E'),
  ('costa-do-marfim', 'Costa do Marfim', 'CI', '', '/flags/ci.svg', 'E'),
  ('equador', 'Equador', 'EC', '', '/flags/ec.svg', 'E'),
  ('holanda', 'Holanda', 'NL', '', '/flags/nl.svg', 'F'),
  ('japao', 'Japão', 'JP', '', '/flags/jp.svg', 'F'),
  ('suecia', 'Suécia', 'SE', '', '/flags/se.svg', 'F'),
  ('tunisia', 'Tunísia', 'TN', '', '/flags/tn.svg', 'F'),
  ('belgica', 'Bélgica', 'BE', '', '/flags/be.svg', 'G'),
  ('egito', 'Egito', 'EG', '', '/flags/eg.svg', 'G'),
  ('ira', 'Irã', 'IR', '', '/flags/ir.svg', 'G'),
  ('nova-zelandia', 'Nova Zelândia', 'NZ', '', '/flags/nz.svg', 'G'),
  ('espanha', 'Espanha', 'ES', '', '/flags/es.svg', 'H'),
  ('cabo-verde', 'Cabo Verde', 'CV', '', '/flags/cv.svg', 'H'),
  ('arabia-saudita', 'Arábia Saudita', 'SA', '', '/flags/sa.svg', 'H'),
  ('uruguai', 'Uruguai', 'UY', '', '/flags/uy.svg', 'H'),
  ('franca', 'França', 'FR', '', '/flags/fr.svg', 'I'),
  ('senegal', 'Senegal', 'SN', '', '/flags/sn.svg', 'I'),
  ('iraque', 'Iraque', 'IQ', '', '/flags/iq.svg', 'I'),
  ('noruega', 'Noruega', 'NO', '', '/flags/no.svg', 'I'),
  ('argentina', 'Argentina', 'AR', '', '/flags/ar.svg', 'J'),
  ('argelia', 'Argélia', 'DZ', '', '/flags/dz.svg', 'J'),
  ('austria', 'Áustria', 'AT', '', '/flags/at.svg', 'J'),
  ('jordania', 'Jordânia', 'JO', '', '/flags/jo.svg', 'J'),
  ('portugal', 'Portugal', 'PT', '', '/flags/pt.svg', 'K'),
  ('rd-congo', 'RD Congo', 'CD', '', '/flags/cd.svg', 'K'),
  ('uzbequistao', 'Uzbequistão', 'UZ', '', '/flags/uz.svg', 'K'),
  ('colombia', 'Colômbia', 'CO', '', '/flags/co.svg', 'K'),
  ('inglaterra', 'Inglaterra', 'GB-ENG', '', '/flags/gb-eng.svg', 'L'),
  ('croacia', 'Croácia', 'HR', '', '/flags/hr.svg', 'L'),
  ('gana', 'Gana', 'GH', '', '/flags/gh.svg', 'L'),
  ('panama', 'Panamá', 'PA', '', '/flags/pa.svg', 'L')
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  flag_emoji = excluded.flag_emoji,
  flag_asset = excluded.flag_asset,
  group_code = excluded.group_code,
  updated_at = now();

insert into public.matches (id, stage, group_code, round, home_team_id, away_team_id, starts_at, status)
values
  ('jogo-1', 'group_stage', 'A', '1', 'mexico', 'africa-do-sul', '2026-06-11T16:00:00-03:00', 'scheduled'),
  ('jogo-2', 'group_stage', 'A', '1', 'coreia-do-sul', 'tchequia', '2026-06-11T23:00:00-03:00', 'scheduled'),
  ('jogo-3', 'group_stage', 'A', '2', 'tchequia', 'africa-do-sul', '2026-06-18T13:00:00-03:00', 'scheduled'),
  ('jogo-4', 'group_stage', 'A', '2', 'mexico', 'coreia-do-sul', '2026-06-18T22:00:00-03:00', 'scheduled'),
  ('jogo-5', 'group_stage', 'A', '3', 'tchequia', 'mexico', '2026-06-24T22:00:00-03:00', 'scheduled'),
  ('jogo-6', 'group_stage', 'A', '3', 'africa-do-sul', 'coreia-do-sul', '2026-06-24T22:00:00-03:00', 'scheduled'),
  ('jogo-7', 'group_stage', 'B', '1', 'canada', 'bosnia-herzegovina', '2026-06-12T16:00:00-03:00', 'scheduled'),
  ('jogo-8', 'group_stage', 'B', '1', 'catar', 'suica', '2026-06-13T16:00:00-03:00', 'scheduled'),
  ('jogo-9', 'group_stage', 'B', '2', 'suica', 'bosnia-herzegovina', '2026-06-18T16:00:00-03:00', 'scheduled'),
  ('jogo-10', 'group_stage', 'B', '2', 'canada', 'catar', '2026-06-18T19:00:00-03:00', 'scheduled'),
  ('jogo-11', 'group_stage', 'B', '3', 'suica', 'canada', '2026-06-24T16:00:00-03:00', 'scheduled'),
  ('jogo-12', 'group_stage', 'B', '3', 'bosnia-herzegovina', 'catar', '2026-06-24T16:00:00-03:00', 'scheduled'),
  ('jogo-13', 'group_stage', 'C', '1', 'brasil', 'marrocos', '2026-06-13T19:00:00-03:00', 'scheduled'),
  ('jogo-14', 'group_stage', 'C', '1', 'haiti', 'escocia', '2026-06-13T22:00:00-03:00', 'scheduled'),
  ('jogo-15', 'group_stage', 'C', '2', 'escocia', 'marrocos', '2026-06-19T19:00:00-03:00', 'scheduled'),
  ('jogo-16', 'group_stage', 'C', '2', 'brasil', 'haiti', '2026-06-19T21:30:00-03:00', 'scheduled'),
  ('jogo-17', 'group_stage', 'C', '3', 'escocia', 'brasil', '2026-06-24T19:00:00-03:00', 'scheduled'),
  ('jogo-18', 'group_stage', 'C', '3', 'marrocos', 'haiti', '2026-06-24T19:00:00-03:00', 'scheduled'),
  ('jogo-19', 'group_stage', 'D', '1', 'estados-unidos', 'paraguai', '2026-06-12T22:00:00-03:00', 'scheduled'),
  ('jogo-20', 'group_stage', 'D', '1', 'australia', 'turquia', '2026-06-14T01:00:00-03:00', 'scheduled'),
  ('jogo-21', 'group_stage', 'D', '2', 'estados-unidos', 'australia', '2026-06-19T16:00:00-03:00', 'scheduled'),
  ('jogo-22', 'group_stage', 'D', '2', 'turquia', 'paraguai', '2026-06-20T00:00:00-03:00', 'scheduled'),
  ('jogo-23', 'group_stage', 'D', '3', 'paraguai', 'australia', '2026-06-25T23:00:00-03:00', 'scheduled'),
  ('jogo-24', 'group_stage', 'D', '3', 'turquia', 'estados-unidos', '2026-06-25T23:00:00-03:00', 'scheduled'),
  ('jogo-25', 'group_stage', 'E', '1', 'alemanha', 'curacao', '2026-06-14T14:00:00-03:00', 'scheduled'),
  ('jogo-26', 'group_stage', 'E', '1', 'costa-do-marfim', 'equador', '2026-06-14T20:00:00-03:00', 'scheduled'),
  ('jogo-27', 'group_stage', 'E', '2', 'alemanha', 'costa-do-marfim', '2026-06-20T17:00:00-03:00', 'scheduled'),
  ('jogo-28', 'group_stage', 'E', '2', 'equador', 'curacao', '2026-06-20T21:00:00-03:00', 'scheduled'),
  ('jogo-29', 'group_stage', 'E', '3', 'equador', 'alemanha', '2026-06-25T17:00:00-03:00', 'scheduled'),
  ('jogo-30', 'group_stage', 'E', '3', 'curacao', 'costa-do-marfim', '2026-06-25T17:00:00-03:00', 'scheduled'),
  ('jogo-31', 'group_stage', 'F', '1', 'holanda', 'japao', '2026-06-14T17:00:00-03:00', 'scheduled'),
  ('jogo-32', 'group_stage', 'F', '1', 'suecia', 'tunisia', '2026-06-14T23:00:00-03:00', 'scheduled'),
  ('jogo-33', 'group_stage', 'F', '2', 'holanda', 'suecia', '2026-06-20T14:00:00-03:00', 'scheduled'),
  ('jogo-34', 'group_stage', 'F', '2', 'tunisia', 'japao', '2026-06-21T01:00:00-03:00', 'scheduled'),
  ('jogo-35', 'group_stage', 'F', '3', 'tunisia', 'holanda', '2026-06-25T20:00:00-03:00', 'scheduled'),
  ('jogo-36', 'group_stage', 'F', '3', 'japao', 'suecia', '2026-06-25T20:00:00-03:00', 'scheduled'),
  ('jogo-37', 'group_stage', 'G', '1', 'belgica', 'egito', '2026-06-15T16:00:00-03:00', 'scheduled'),
  ('jogo-38', 'group_stage', 'G', '1', 'ira', 'nova-zelandia', '2026-06-15T22:00:00-03:00', 'scheduled'),
  ('jogo-39', 'group_stage', 'G', '2', 'belgica', 'ira', '2026-06-21T16:00:00-03:00', 'scheduled'),
  ('jogo-40', 'group_stage', 'G', '2', 'nova-zelandia', 'egito', '2026-06-21T22:00:00-03:00', 'scheduled'),
  ('jogo-41', 'group_stage', 'G', '3', 'egito', 'ira', '2026-06-27T00:00:00-03:00', 'scheduled'),
  ('jogo-42', 'group_stage', 'G', '3', 'nova-zelandia', 'belgica', '2026-06-27T00:00:00-03:00', 'scheduled'),
  ('jogo-43', 'group_stage', 'H', '1', 'espanha', 'cabo-verde', '2026-06-15T13:00:00-03:00', 'scheduled'),
  ('jogo-44', 'group_stage', 'H', '1', 'arabia-saudita', 'uruguai', '2026-06-15T19:00:00-03:00', 'scheduled'),
  ('jogo-45', 'group_stage', 'H', '2', 'espanha', 'arabia-saudita', '2026-06-21T13:00:00-03:00', 'scheduled'),
  ('jogo-46', 'group_stage', 'H', '2', 'uruguai', 'cabo-verde', '2026-06-21T19:00:00-03:00', 'scheduled'),
  ('jogo-47', 'group_stage', 'H', '3', 'uruguai', 'espanha', '2026-06-26T21:00:00-03:00', 'scheduled'),
  ('jogo-48', 'group_stage', 'H', '3', 'cabo-verde', 'arabia-saudita', '2026-06-26T21:00:00-03:00', 'scheduled'),
  ('jogo-49', 'group_stage', 'I', '1', 'franca', 'senegal', '2026-06-16T16:00:00-03:00', 'scheduled'),
  ('jogo-50', 'group_stage', 'I', '1', 'iraque', 'noruega', '2026-06-16T19:00:00-03:00', 'scheduled'),
  ('jogo-51', 'group_stage', 'I', '2', 'franca', 'iraque', '2026-06-22T18:00:00-03:00', 'scheduled'),
  ('jogo-52', 'group_stage', 'I', '2', 'noruega', 'senegal', '2026-06-22T21:00:00-03:00', 'scheduled'),
  ('jogo-53', 'group_stage', 'I', '3', 'noruega', 'franca', '2026-06-26T16:00:00-03:00', 'scheduled'),
  ('jogo-54', 'group_stage', 'I', '3', 'senegal', 'iraque', '2026-06-26T16:00:00-03:00', 'scheduled'),
  ('jogo-55', 'group_stage', 'J', '1', 'argentina', 'argelia', '2026-06-16T22:00:00-03:00', 'scheduled'),
  ('jogo-56', 'group_stage', 'J', '1', 'austria', 'jordania', '2026-06-17T01:00:00-03:00', 'scheduled'),
  ('jogo-57', 'group_stage', 'J', '2', 'argentina', 'austria', '2026-06-22T14:00:00-03:00', 'scheduled'),
  ('jogo-58', 'group_stage', 'J', '2', 'jordania', 'argelia', '2026-06-23T00:00:00-03:00', 'scheduled'),
  ('jogo-59', 'group_stage', 'J', '3', 'jordania', 'argentina', '2026-06-27T23:00:00-03:00', 'scheduled'),
  ('jogo-60', 'group_stage', 'J', '3', 'argelia', 'austria', '2026-06-27T23:00:00-03:00', 'scheduled'),
  ('jogo-61', 'group_stage', 'K', '1', 'portugal', 'rd-congo', '2026-06-17T14:00:00-03:00', 'scheduled'),
  ('jogo-62', 'group_stage', 'K', '1', 'uzbequistao', 'colombia', '2026-06-17T23:00:00-03:00', 'scheduled'),
  ('jogo-63', 'group_stage', 'K', '2', 'portugal', 'uzbequistao', '2026-06-23T14:00:00-03:00', 'scheduled'),
  ('jogo-64', 'group_stage', 'K', '2', 'colombia', 'rd-congo', '2026-06-23T23:00:00-03:00', 'scheduled'),
  ('jogo-65', 'group_stage', 'K', '3', 'colombia', 'portugal', '2026-06-27T20:30:00-03:00', 'scheduled'),
  ('jogo-66', 'group_stage', 'K', '3', 'rd-congo', 'uzbequistao', '2026-06-27T20:30:00-03:00', 'scheduled'),
  ('jogo-67', 'group_stage', 'L', '1', 'inglaterra', 'croacia', '2026-06-17T17:00:00-03:00', 'scheduled'),
  ('jogo-68', 'group_stage', 'L', '1', 'gana', 'panama', '2026-06-17T20:00:00-03:00', 'scheduled'),
  ('jogo-69', 'group_stage', 'L', '2', 'inglaterra', 'gana', '2026-06-23T17:00:00-03:00', 'scheduled'),
  ('jogo-70', 'group_stage', 'L', '2', 'panama', 'croacia', '2026-06-23T20:00:00-03:00', 'scheduled'),
  ('jogo-71', 'group_stage', 'L', '3', 'panama', 'inglaterra', '2026-06-27T18:00:00-03:00', 'scheduled'),
  ('jogo-72', 'group_stage', 'L', '3', 'croacia', 'gana', '2026-06-27T18:00:00-03:00', 'scheduled')
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
