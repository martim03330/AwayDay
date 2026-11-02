-- Access tests for Casas (supporters' clubs): supporters_club, supporters_club_manager, supporters_club_follower,
-- supporters_club_invite and their functions.
--
-- People: O (Óscar) asks to register a Casa and becomes its owner; X (Xana) is another signed-in fan; M (Marta) joins
-- as a manager with an invite; ADM is an admin with the second factor.
--
-- Runs inside a transaction that is always rolled back. Every check raises an exception when it fails.
--
--   supabase db query --linked -f supabase/tests/acesso_casas_do_clube.test.sql

begin;

create temporary table expect_log (name text) on commit drop;
create temporary table t_ids (key text primary key, id uuid) on commit drop;
create temporary table t_codes (key text primary key, code text) on commit drop;
grant insert, select, update on expect_log, t_ids, t_codes to authenticated, anon;

create function pg_temp.expect(p_name text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAILED %: got %, expected %', p_name, p_actual, p_expected;
  end if;
  insert into expect_log values (p_name);
end;
$$;

create function pg_temp.id(p_key text)
returns uuid
language sql
as $$
  select id from t_ids where key = p_key;
$$;

create function pg_temp.code(p_key text)
returns text
language sql
as $$
  select code from t_codes where key = p_key;
$$;

create function pg_temp.as_user(p_id text)
returns void
language sql
as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal2')::text, true);
$$;

-- Runs a call that must be refused, and returns 'message (sqlstate)', or 'accepted'.
create function pg_temp.refusal(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return 'accepted';
exception when others then
  return sqlerrm || ' (' || sqlstate || ')';
end;
$$;

insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('ca500000-0000-4000-8000-000000000001', 'casas-o@test.invalid', '{"display_name":"Óscar"}', 'authenticated', 'authenticated'),
  ('ca500000-0000-4000-8000-000000000002', 'casas-x@test.invalid', '{"display_name":"Xana"}', 'authenticated', 'authenticated'),
  ('ca500000-0000-4000-8000-000000000003', 'casas-m@test.invalid', '{"display_name":"Marta"}', 'authenticated', 'authenticated'),
  ('ca500000-0000-4000-8000-0000000000ad', 'casas-adm@test.invalid', '{"display_name":"Admin Casas"}', 'authenticated', 'authenticated');
update public.profile set is_admin = true where id = 'ca500000-0000-4000-8000-0000000000ad';

-- Any real club and municipality will do.
select set_config('test.club', (select id from public.club order by id limit 1), true);
select set_config('test.municipality', (select id from public.municipality order by id limit 1), true);

set local role authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Óscar asks to register a Casa: it is pending and he is its owner.

select pg_temp.as_user('ca500000-0000-4000-8000-000000000001');
insert into t_ids (key, id) values ('casa', public.request_supporters_club(
  current_setting('test.club'), '  Casa de Teste Acesso  ', current_setting('test.municipality'), 'Casa@Teste.invalid'));

select pg_temp.expect('the request returns an id', pg_temp.id('casa') is not null, true);
select pg_temp.expect('the new Casa is pending, its name trimmed',
  (select status || '|' || name from public.supporters_club where id = pg_temp.id('casa')),
  'pending|Casa de Teste Acesso');
select pg_temp.expect('whoever asked is its owner',
  (select role from public.supporters_club_manager
   where club_id = pg_temp.id('casa') and profile_id = 'ca500000-0000-4000-8000-000000000001'),
  'owner');
select pg_temp.expect('the owner is a manager', public.is_supporters_club_manager(pg_temp.id('casa')), true);
select pg_temp.expect('the same name in the same club is refused, whatever the case',
  pg_temp.refusal(format('select public.request_supporters_club(%L, %L, %L, null)',
    current_setting('test.club'), 'CASA DE TESTE ACESSO', current_setting('test.municipality'))),
  'name_taken (23505)');
select pg_temp.expect('a name too short is refused',
  pg_temp.refusal(format('select public.request_supporters_club(%L, %L, %L, null)',
    current_setting('test.club'), ' ab ', current_setting('test.municipality'))),
  'bad_name (22023)');
insert into t_ids (key, id) values ('casa2', public.request_supporters_club(
  current_setting('test.club'), 'Casa de Teste Acesso Dois', current_setting('test.municipality'), null));
select pg_temp.expect('a third pending request from the same person is refused',
  pg_temp.refusal(format('select public.request_supporters_club(%L, %L, %L, null)',
    current_setting('test.club'), 'Casa de Teste Acesso Tres', current_setting('test.municipality'))),
  'too_many_pending (22023)');

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Nobody else sees a pending Casa; an admin does.

select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('another fan cannot see the pending Casa',
  (select count(*)::integer from public.supporters_club where id = pg_temp.id('casa')), 0);
select pg_temp.expect('nor its managers',
  (select count(*)::integer from public.supporters_club_manager where club_id = pg_temp.id('casa')), 0);
select pg_temp.expect('another fan is not a manager', public.is_supporters_club_manager(pg_temp.id('casa')), false);
select pg_temp.expect('the app cannot write the table directly',
  pg_temp.refusal(format('update public.supporters_club set status = ''verified'' where id = %L', pg_temp.id('casa'))),
  'permission denied for table supporters_club (42501)');
select pg_temp.expect('nor make itself a manager',
  pg_temp.refusal(format('insert into public.supporters_club_manager (club_id, profile_id, role) values (%L, %L, ''owner'')',
    pg_temp.id('casa'), 'ca500000-0000-4000-8000-000000000002')),
  'permission denied for table supporters_club_manager (42501)');
select pg_temp.expect('a pending Casa cannot be followed',
  pg_temp.refusal(format('select public.set_supporters_club_follow(%L, true)', pg_temp.id('casa'))),
  'not_found (P0002)');

select pg_temp.as_user('ca500000-0000-4000-8000-0000000000ad');
select pg_temp.expect('an admin with the second factor sees the pending Casa',
  (select count(*)::integer from public.supporters_club where id = pg_temp.id('casa')), 1);

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Only an admin decides. Once verified, everyone sees it.

select pg_temp.as_user('ca500000-0000-4000-8000-000000000001');
select pg_temp.expect('the owner cannot verify their own Casa',
  pg_temp.refusal(format('select public.decide_supporters_club(%L, ''verified'')', pg_temp.id('casa'))),
  'not_admin (42501)');
select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('another fan cannot verify it',
  pg_temp.refusal(format('select public.decide_supporters_club(%L, ''verified'')', pg_temp.id('casa'))),
  'not_admin (42501)');

select pg_temp.as_user('ca500000-0000-4000-8000-0000000000ad');
select pg_temp.expect('an unknown status is refused',
  pg_temp.refusal(format('select public.decide_supporters_club(%L, ''pending'')', pg_temp.id('casa'))),
  'bad_status (22023)');
select public.decide_supporters_club(pg_temp.id('casa'), 'verified');
select pg_temp.expect('verifying records when and by whom',
  (select status = 'verified' and verified_at is not null
          and verified_by = 'ca500000-0000-4000-8000-0000000000ad'::uuid
   from public.supporters_club where id = pg_temp.id('casa')),
  true);

select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('once verified, another fan sees the Casa',
  (select count(*)::integer from public.supporters_club where id = pg_temp.id('casa')), 1);
select pg_temp.expect('but still not its managers',
  (select count(*)::integer from public.supporters_club_manager where club_id = pg_temp.id('casa')), 0);
select pg_temp.expect('nor the other, still pending, Casa',
  (select count(*)::integer from public.supporters_club where id = pg_temp.id('casa2')), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Managers: the owner invites Marta; the code works once; only the owner invites, edits and removes.

select pg_temp.as_user('ca500000-0000-4000-8000-000000000001');
insert into t_codes (key, code) values ('m', public.create_supporters_club_invite(pg_temp.id('casa')));
select pg_temp.expect('the invite code has 10 lowercase letters or digits', pg_temp.code('m') ~ '^[a-z0-9]{10}$', true);
select pg_temp.expect('the invite lasts 7 days',
  (select expires_at between now() + interval '7 days' - interval '1 minute' and now() + interval '7 days'
   from public.supporters_club_invite where code = pg_temp.code('m')),
  true);

select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('another fan cannot see the invite codes',
  (select count(*)::integer from public.supporters_club_invite where club_id = pg_temp.id('casa')), 0);
select pg_temp.expect('a non-owner cannot create an invite',
  pg_temp.refusal(format('select public.create_supporters_club_invite(%L)', pg_temp.id('casa'))),
  'not_owner (42501)');

select pg_temp.as_user('ca500000-0000-4000-8000-000000000003');
select pg_temp.expect('accepting returns the Casa',
  public.accept_supporters_club_invite(upper(pg_temp.code('m'))), pg_temp.id('casa'));
select pg_temp.expect('Marta is now a manager',
  (select role from public.supporters_club_manager
   where club_id = pg_temp.id('casa') and profile_id = 'ca500000-0000-4000-8000-000000000003'),
  'manager');
select pg_temp.expect('a manager sees all the managers of the Casa',
  (select count(*)::integer from public.supporters_club_manager where club_id = pg_temp.id('casa')), 2);
select pg_temp.expect('a manager gets the names of the other managers, owner first',
  (select string_agg(display_name || ':' || role, ',')
   from public.supporters_club_managers(pg_temp.id('casa'))),
  'Óscar:owner,Marta:manager');
select pg_temp.expect('a manager (not owner) cannot create an invite',
  pg_temp.refusal(format('select public.create_supporters_club_invite(%L)', pg_temp.id('casa'))),
  'not_owner (42501)');
select pg_temp.expect('a manager (not owner) cannot edit the Casa',
  pg_temp.refusal(format('select public.update_supporters_club(%L, %L, null)', pg_temp.id('casa'), 'Outro Nome')),
  'not_owner (42501)');
select pg_temp.expect('a manager (not owner) cannot remove the owner',
  pg_temp.refusal(format('select public.remove_supporters_club_manager(%L, %L)',
    pg_temp.id('casa'), 'ca500000-0000-4000-8000-000000000001')),
  'not_owner (42501)');

select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('reusing the code is refused',
  pg_temp.refusal(format('select public.accept_supporters_club_invite(%L)', pg_temp.code('m'))),
  'invite_used (22023)');
select pg_temp.expect('an unknown code is refused',
  pg_temp.refusal('select public.accept_supporters_club_invite(''zzzzzzzzzz'')'),
  'invite_not_found (P0002)');
select pg_temp.expect('and Xana did not become a manager',
  public.is_supporters_club_manager(pg_temp.id('casa')), false);
select pg_temp.expect('someone who does not manage the Casa cannot list its managers',
  pg_temp.refusal(format('select public.supporters_club_managers(%L)', pg_temp.id('casa'))),
  'not_manager (42501)');

-- An expired code is refused.
select pg_temp.as_user('ca500000-0000-4000-8000-000000000001');
insert into t_codes (key, code) values ('old', public.create_supporters_club_invite(pg_temp.id('casa')));
reset role;
update public.supporters_club_invite set expires_at = now() - interval '1 minute' where code = pg_temp.code('old');
set local role authenticated;
select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('an expired code is refused',
  pg_temp.refusal(format('select public.accept_supporters_club_invite(%L)', pg_temp.code('old'))),
  'invite_expired (22023)');

-- The owner edits the Casa, cannot remove themselves as sole owner, and removes Marta.
select pg_temp.as_user('ca500000-0000-4000-8000-000000000001');
select public.update_supporters_club(pg_temp.id('casa'), ' Casa de Teste Acesso Renomeada ', null);
select pg_temp.expect('the owner renames and clears the email',
  (select name || '|' || coalesce(contact_email, '-') from public.supporters_club where id = pg_temp.id('casa')),
  'Casa de Teste Acesso Renomeada|-');
select pg_temp.expect('the only owner cannot remove themselves',
  pg_temp.refusal(format('select public.remove_supporters_club_manager(%L, %L)',
    pg_temp.id('casa'), 'ca500000-0000-4000-8000-000000000001')),
  'last_owner (22023)');
select public.remove_supporters_club_manager(pg_temp.id('casa'), 'ca500000-0000-4000-8000-000000000003');
select pg_temp.expect('the owner removed Marta',
  (select count(*)::integer from public.supporters_club_manager where club_id = pg_temp.id('casa')), 1);
-- A code handed out before the Casa is suspended (used in 6).
insert into t_codes (key, code) values ('late', public.create_supporters_club_invite(pg_temp.id('casa')));

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Following: on, then off. The managers see who follows; other fans do not.

select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select public.set_supporters_club_follow(pg_temp.id('casa'), true);
select public.set_supporters_club_follow(pg_temp.id('casa'), true);
select pg_temp.expect('following twice leaves one row, which I see',
  (select count(*)::integer from public.supporters_club_follower where club_id = pg_temp.id('casa')), 1);

select pg_temp.as_user('ca500000-0000-4000-8000-000000000001');
select pg_temp.expect('the owner sees the follower',
  (select count(*)::integer from public.supporters_club_follower where club_id = pg_temp.id('casa')), 1);

select pg_temp.as_user('ca500000-0000-4000-8000-000000000003');
select pg_temp.expect('a removed manager no longer sees the followers',
  (select count(*)::integer from public.supporters_club_follower where club_id = pg_temp.id('casa')), 0);

select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select public.set_supporters_club_follow(pg_temp.id('casa'), false);
select pg_temp.expect('unfollowing removes the row',
  (select count(*)::integer from public.supporters_club_follower where club_id = pg_temp.id('casa')), 0);

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Suspended: hidden again from other fans; still visible to its managers.

select pg_temp.as_user('ca500000-0000-4000-8000-0000000000ad');
select public.decide_supporters_club(pg_temp.id('casa'), 'suspended');
select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('a suspended Casa is hidden from other fans',
  (select count(*)::integer from public.supporters_club where id = pg_temp.id('casa')), 0);
select pg_temp.as_user('ca500000-0000-4000-8000-000000000001');
select pg_temp.expect('its owner still sees it, suspended',
  (select status from public.supporters_club where id = pg_temp.id('casa')), 'suspended');
select pg_temp.as_user('ca500000-0000-4000-8000-000000000002');
select pg_temp.expect('a manager code of a suspended Casa no longer works',
  pg_temp.refusal(format('select public.accept_supporters_club_invite(%L)', pg_temp.code('late'))),
  'club_suspended (22023)');

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Signed-out visitors cannot call any of the functions.

reset role;
select pg_temp.expect('anon cannot execute any Casa function',
  (select bool_or(has_function_privilege('anon', f, 'execute'))
   from unnest(array[
     'public.is_supporters_club_manager(uuid)',
     'public.is_supporters_club_owner(uuid)',
     'public.request_supporters_club(text, text, text, text)',
     'public.decide_supporters_club(uuid, text)',
     'public.create_supporters_club_invite(uuid)',
     'public.accept_supporters_club_invite(text)',
     'public.remove_supporters_club_manager(uuid, uuid)',
     'public.supporters_club_managers(uuid)',
     'public.update_supporters_club(uuid, text, text)',
     'public.set_supporters_club_follow(uuid, boolean)'
   ]) as f),
  false);
select pg_temp.expect('authenticated can execute them all',
  (select bool_and(has_function_privilege('authenticated', f, 'execute'))
   from unnest(array[
     'public.is_supporters_club_manager(uuid)',
     'public.request_supporters_club(text, text, text, text)',
     'public.decide_supporters_club(uuid, text)',
     'public.create_supporters_club_invite(uuid)',
     'public.accept_supporters_club_invite(text)',
     'public.remove_supporters_club_manager(uuid, uuid)',
     'public.supporters_club_managers(uuid)',
     'public.update_supporters_club(uuid, text, text)',
     'public.set_supporters_club_follow(uuid, boolean)'
   ]) as f),
  true);
select pg_temp.expect('anon has no access to the tables',
  (select bool_or(has_table_privilege('anon', t, 'select'))
   from unnest(array['public.supporters_club', 'public.supporters_club_manager',
                     'public.supporters_club_follower', 'public.supporters_club_invite']) as t),
  false);

select count(*) as checks_passed from expect_log;

rollback;
