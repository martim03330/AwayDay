-- Tirar a resposta a um plano é chamar `answer_fixture_plan` sem resposta: passa a ter valor por omissão (null).

create or replace function public.answer_fixture_plan(p_plan_id uuid, p_answer text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  estado text;
begin
  if caller is null or not public.can_see_fixture_plan(p_plan_id, caller) then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;
  select fp.status into estado from public.fixture_plan as fp where fp.id = p_plan_id;
  if estado <> 'aberto' then
    raise exception 'plan_closed' using errcode = '22023';
  end if;
  if p_answer is null then
    delete from public.fixture_plan_answer where plan_id = p_plan_id and profile_id = caller;
    return;
  end if;
  if p_answer not in ('vou', 'talvez') then
    raise exception 'bad_answer' using errcode = '22023';
  end if;
  insert into public.fixture_plan_answer (plan_id, profile_id, answer)
  values (p_plan_id, caller, p_answer)
  on conflict (plan_id, profile_id) do update set answer = excluded.answer, updated_at = now();
end;
$$;
