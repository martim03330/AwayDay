-- Testers still on build 10 (app 1.0.0) have the «Estou a pensar» button, which sends 'talvez': since
-- 20261013210000_plan_answers_vou_or_nao that was refused with bad_answer, an error on their screen. «A pensar» now
-- means not having answered, so 'talvez' from an old app clears the answer instead. Can go once nobody is on 1.0.0.
create or replace function public.answer_fixture_plan(p_plan_id uuid, p_answer text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  estado text;
  resposta text := case when p_answer = 'talvez' then null else p_answer end;
begin
  if caller is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  select fp.status into estado from public.fixture_plan as fp where fp.id = p_plan_id;
  if estado <> 'aberto' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if resposta is null then
    delete from public.fixture_plan_answer where plan_id = p_plan_id and profile_id = caller;
    return;
  end if;
  if resposta not in ('vou', 'nao') then
    raise exception 'bad_answer' using errcode = '22023';
  end if;
  -- Saying «não vou» is always allowed; «vou» not while already going with another group.
  if resposta = 'vou' and public.closed_plan_elsewhere(p_plan_id, caller) is not null then
    raise exception 'already_going' using errcode = '22023';
  end if;
  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, resposta)
  on conflict (plan_id, profile_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;
