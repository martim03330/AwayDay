-- Aguentar mais gente sem pagar mais.
--
-- 1. Índices nas 43 colunas de ligação que ainda não os tinham. Sem eles, apagar uma conta ou abrir uma conversa
--    percorre tabelas inteiras; com muita gente, tudo fica lento.
-- 2. Cache das rotas e das pesquisas de sítios. Os serviços de mapas usados pelas boleias (Valhalla e Nominatim da
--    comunidade OpenStreetMap) são gratuitos mas pedem uso moderado. A mesma rota (de perto do mesmo sítio para o
--    mesmo estádio) e a mesma pesquisa servem-se daqui durante 30 e 7 dias, e cotar e criar a boleia já só pede a rota
--    uma vez. Só o servidor lê e escreve estas tabelas: RLS ligado, sem políticas.
-- 3. O concelho de onde sai uma boleia passa a ser o concelho mais próximo (tabela `municipality`, 308 concelhos),
--    calculado aqui: deixa de haver um pedido ao Nominatim por cada boleia criada.

-- --- 1. Índices ---------------------------------------------------------------------------------------------------

create index if not exists content_report_group_id_idx on public.content_report (group_id);
create index if not exists content_report_reported_profile_id_idx on public.content_report (reported_profile_id);
create index if not exists content_report_resolved_by_idx on public.content_report (resolved_by);
create index if not exists content_report_ride_id_idx on public.content_report (ride_id);
create index if not exists fan_group_created_by_idx on public.fan_group (created_by);
create index if not exists feedback_profile_id_idx on public.feedback (profile_id);
create index if not exists fixture_plan_created_by_idx on public.fixture_plan (created_by);
create index if not exists fixture_plan_fixture_id_idx on public.fixture_plan (fixture_id);
create index if not exists fixture_plan_session_id_idx on public.fixture_plan (session_id);
create index if not exists fixture_plan_answer_profile_id_idx on public.fixture_plan_answer (profile_id);
create index if not exists fixture_plan_group_group_id_idx on public.fixture_plan_group (group_id);
create index if not exists fixture_plan_group_shared_by_idx on public.fixture_plan_group (shared_by);
create index if not exists fixture_plan_house_vote_profile_id_idx on public.fixture_plan_house_vote (profile_id);
create index if not exists group_invite_invited_by_idx on public.group_invite (invited_by);
create index if not exists group_message_hidden_by_idx on public.group_message (hidden_by);
create index if not exists group_message_place_id_idx on public.group_message (place_id);
create index if not exists group_message_plan_id_idx on public.group_message (plan_id);
create index if not exists group_message_profile_id_idx on public.group_message (profile_id);
create index if not exists group_message_read_profile_id_idx on public.group_message_read (profile_id);
create index if not exists home_fan_report_reporter_id_idx on public.home_fan_report (reporter_id);
create index if not exists place_photo_moderated_by_idx on public.place_photo (moderated_by);
create index if not exists ride_parking_spot_id_idx on public.ride (parking_spot_id);
create index if not exists ride_attendance_reporter_id_idx on public.ride_attendance (reporter_id);
create index if not exists ride_attendance_subject_id_idx on public.ride_attendance (subject_id);
create index if not exists ride_incident_profile_id_idx on public.ride_incident (profile_id);
create index if not exists ride_incident_vote_voter_id_idx on public.ride_incident_vote (voter_id);
create index if not exists ride_invite_invited_by_idx on public.ride_invite (invited_by);
create index if not exists ride_message_hidden_by_idx on public.ride_message (hidden_by);
create index if not exists ride_message_profile_id_idx on public.ride_message (profile_id);
create index if not exists ride_message_read_profile_id_idx on public.ride_message_read (profile_id);
create index if not exists stadium_visit_fixture_id_idx on public.stadium_visit (fixture_id);
create index if not exists stay_plan_profile_id_idx on public.stay_plan (profile_id);
create index if not exists trip_expense_created_by_idx on public.trip_expense (created_by);
create index if not exists trip_expense_payer_id_idx on public.trip_expense (payer_id);
create index if not exists trip_expense_share_profile_id_idx on public.trip_expense_share (profile_id);
create index if not exists trip_photo_profile_id_idx on public.trip_photo (profile_id);
create index if not exists trip_session_fixture_id_idx on public.trip_session (fixture_id);
create index if not exists trip_session_opened_by_idx on public.trip_session (opened_by);
create index if not exists trip_session_member_added_by_idx on public.trip_session_member (added_by);
create index if not exists trip_settlement_confirmed_by_idx on public.trip_settlement (confirmed_by);
create index if not exists trip_settlement_created_by_idx on public.trip_settlement (created_by);
create index if not exists trip_settlement_from_profile_id_idx on public.trip_settlement (from_profile_id);
create index if not exists trip_settlement_to_profile_id_idx on public.trip_settlement (to_profile_id);

-- --- 2. Cache de rotas e pesquisas ----------------------------------------------------------------------------------

create table public.route_cache (
  key text primary key,
  distance_m integer not null check (distance_m > 0),
  duration_s integer not null check (duration_s > 0),
  toll_segments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.route_cache enable row level security;
revoke all on public.route_cache from anon, authenticated;

create table public.place_search_cache (
  key text primary key,
  results jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.place_search_cache enable row level security;
revoke all on public.place_search_cache from anon, authenticated;

/** Apaga as rotas com mais de 30 dias e as pesquisas com mais de 7: as estradas e os sítios mudam. */
create function public.delete_old_map_cache()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.route_cache where created_at < now() - interval '30 days';
  delete from public.place_search_cache where created_at < now() - interval '7 days';
$$;
revoke execute on function public.delete_old_map_cache() from public, anon, authenticated;

select cron.schedule('delete-old-map-cache', '47 3 * * *', $$ select public.delete_old_map_cache(); $$);

-- --- 3. O concelho mais próximo -------------------------------------------------------------------------------------

/** O concelho cujo centro fica mais perto do ponto (para a etiqueta «volta para …» das boleias). */
create function public.nearest_municipality_name(p_latitude double precision, p_longitude double precision)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.name
  from public.municipality as m
  where m.location is not null
  order by m.location operator(extensions.<->) extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
  limit 1;
$$;
revoke execute on function public.nearest_municipality_name(double precision, double precision) from public, anon, authenticated;
grant execute on function public.nearest_municipality_name(double precision, double precision) to service_role;
