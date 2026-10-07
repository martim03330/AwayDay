-- A casa entra nas contas da viagem, como a boleia.
--
-- Até agora a casa tinha a conta dela no plano («120 € cada, 90 € com a casa cheia») mas não chegava às contas da
-- viagem: quem a reservava tinha de a lançar à mão, e era fácil ficar de fora ou aparecer duas vezes.
--
-- Agora, quando a casa do plano está **reservada** e o plano já tem a sessão aberta, entra sozinha uma despesa:
--   · **quem pagou** é quem propôs a casa (foi quem a reservou), se estiver na sessão;
--   · **o valor** é o preço total da casa;
--   · **entram** as pessoas da sessão com cama na casa (quem a propôs e quem tem o lugar aceite); se a casa não
--     tiver nenhuma cama marcada, entra a sessão toda.
--
-- Como a da boleia, esta despesa não se escreve nem se apaga à mão: **segue a casa**. Gatilhos refazem-na sempre que
-- muda a reserva ou o preço, a casa do plano, as pessoas da sessão ou as camas. Se a casa deixar de estar reservada
-- (ou quem a propôs não estiver na sessão), a despesa sai.

alter table public.trip_expense drop constraint trip_expense_source_check;
alter table public.trip_expense
  add constraint trip_expense_source_check check (source in ('manual', 'boleia', 'casa'));

-- Uma despesa da casa por sessão, e só uma.
create unique index trip_expense_stay_idx
  on public.trip_expense (session_id) where source = 'casa';

/** Põe, refaz ou tira a despesa da casa nestas contas. */
create function public.sync_stay_trip_expense(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  casa public.stay_plan;
  dono text;
  despesa uuid;
  com_cama integer;
begin
  -- Contas a ser apagadas (em cascata) já não existem: não há nada a refazer.
  if not exists (select 1 from public.trip_session where id = p_session_id) then
    return;
  end if;

  select s.* into casa
  from public.fixture_plan as fp
  join public.stay_plan as s on s.id = fp.stay_plan_id
  where fp.session_id = p_session_id and fp.status <> 'cancelado'
  order by fp.closed_at desc nulls last, fp.created_at desc
  limit 1;

  if casa.id is null
    or casa.status <> 'reservada'
    or casa.total_cents < 1
    or not exists (
      select 1 from public.trip_session_member as m
      where m.session_id = p_session_id and m.profile_id = casa.profile_id
    )
  then
    delete from public.trip_expense where session_id = p_session_id and source = 'casa';
    return;
  end if;

  -- Camas marcadas na casa, estejam ou não nestas contas: quem tem cama e saiu da viagem não faz a casa
  -- passar a ser de toda a gente.
  select count(*) into com_cama
  from public.stay_place as sp
  where sp.plan_id = casa.id and sp.status = 'aceite';

  select p.display_name into dono from public.profile as p where p.id = casa.profile_id;

  insert into public.trip_expense (session_id, payer_id, description, category, cents, created_by, source)
  values (
    p_session_id,
    casa.profile_id,
    left('Casa de ' || coalesce(dono, 'um adepto'), 80),
    'casa',
    casa.total_cents,
    casa.profile_id,
    'casa'
  )
  on conflict (session_id) where source = 'casa'
  do update set
    cents = excluded.cents,
    payer_id = excluded.payer_id,
    created_by = excluded.created_by,
    description = excluded.description
  returning id into despesa;

  -- Quem divide agora: quem tem cama (com quem a propôs), ou a sessão toda se a casa não tiver camas marcadas.
  delete from public.trip_expense_share as sh
  where sh.expense_id = despesa
    and not (
      com_cama = 0
      or sh.profile_id = casa.profile_id
      or exists (
        select 1 from public.stay_place as sp
        where sp.plan_id = casa.id and sp.profile_id = sh.profile_id and sp.status = 'aceite'
      )
    );
  delete from public.trip_expense_share as sh
  where sh.expense_id = despesa
    and not exists (
      select 1 from public.trip_session_member as m
      where m.session_id = p_session_id and m.profile_id = sh.profile_id
    );

  insert into public.trip_expense_share (expense_id, profile_id)
  select despesa, m.profile_id
  from public.trip_session_member as m
  where m.session_id = p_session_id
    and (
      com_cama = 0
      or m.profile_id = casa.profile_id
      or exists (
        select 1 from public.stay_place as sp
        where sp.plan_id = casa.id and sp.profile_id = m.profile_id and sp.status = 'aceite'
      )
    )
  on conflict (expense_id, profile_id) do nothing;
end;
$$;

revoke execute on function public.sync_stay_trip_expense(uuid) from public, anon, authenticated;

-- --- Gatilhos: a despesa segue a casa ----------------------------------------------------------------------------

/** A reserva, o preço ou o dono da casa mudaram: refaz as contas dos planos que a usam. */
create function public.stay_plan_sync_trip_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sessao uuid;
begin
  for sessao in
    select distinct fp.session_id from public.fixture_plan as fp
    where fp.stay_plan_id = new.id and fp.session_id is not null
  loop
    perform public.sync_stay_trip_expense(sessao);
  end loop;
  return null;
end;
$$;

create trigger stay_plan_sync_trip_expense
  after update of status, total_cents, profile_id on public.stay_plan
  for each row
  when (old.status is distinct from new.status
    or old.total_cents is distinct from new.total_cents
    or old.profile_id is distinct from new.profile_id)
  execute function public.stay_plan_sync_trip_expense();

/** A casa do plano, a sessão ou o estado do plano mudaram. */
create function public.fixture_plan_sync_trip_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.session_id is not null then
    perform public.sync_stay_trip_expense(new.session_id);
  end if;
  if tg_op = 'UPDATE' and old.session_id is not null and old.session_id is distinct from new.session_id then
    perform public.sync_stay_trip_expense(old.session_id);
  end if;
  return null;
end;
$$;

create trigger fixture_plan_sync_trip_expense
  after insert or update of stay_plan_id, session_id, status on public.fixture_plan
  for each row
  execute function public.fixture_plan_sync_trip_expense();

/** Entrou ou saiu alguém das contas. */
create function public.trip_member_sync_stay_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_stay_trip_expense(coalesce(new.session_id, old.session_id));
  return null;
end;
$$;

create trigger trip_member_sync_stay_expense
  after insert or delete on public.trip_session_member
  for each row
  execute function public.trip_member_sync_stay_expense();

/** Alguém ganhou ou perdeu a cama na casa. */
create function public.stay_place_sync_trip_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sessao uuid;
begin
  for sessao in
    select distinct fp.session_id from public.fixture_plan as fp
    where fp.stay_plan_id = coalesce(new.plan_id, old.plan_id) and fp.session_id is not null
  loop
    perform public.sync_stay_trip_expense(sessao);
  end loop;
  return null;
end;
$$;

create trigger stay_place_sync_trip_expense
  after insert or update of status or delete on public.stay_place
  for each row
  execute function public.stay_place_sync_trip_expense();

-- The trigger functions only run as triggers: nobody calls them directly.
revoke execute on function public.stay_plan_sync_trip_expense() from public, anon, authenticated;
revoke execute on function public.fixture_plan_sync_trip_expense() from public, anon, authenticated;
revoke execute on function public.trip_member_sync_stay_expense() from public, anon, authenticated;
revoke execute on function public.stay_place_sync_trip_expense() from public, anon, authenticated;

-- --- A despesa da casa também não se apaga à mão ------------------------------------------------------------------

create or replace function public.remove_trip_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.trip_expense where id = p_expense_id and source = 'boleia') then
    raise exception 'ride_expense' using errcode = '22023';
  end if;
  if exists (select 1 from public.trip_expense where id = p_expense_id and source = 'casa') then
    raise exception 'stay_expense' using errcode = '22023';
  end if;
  delete from public.trip_expense
  where id = p_expense_id and (created_by = auth.uid() or payer_id = auth.uid());
  if not found then
    raise exception 'not_yours' using errcode = '42501';
  end if;
end;
$$;

-- --- As casas já reservadas em planos com contas abertas entram já ------------------------------------------------

do $$
declare
  sessao uuid;
begin
  for sessao in
    select distinct fp.session_id
    from public.fixture_plan as fp
    join public.stay_plan as s on s.id = fp.stay_plan_id
    where fp.session_id is not null and s.status = 'reservada'
  loop
    perform public.sync_stay_trip_expense(sessao);
  end loop;
end;
$$;
