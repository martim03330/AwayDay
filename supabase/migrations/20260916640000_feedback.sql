-- Reportar um erro ou sugerir uma melhoria, de dentro da app.
--
-- Até agora não havia porta nenhuma: quem encontrasse um erro tinha de o dizer a alguém, ou calar-se. Passa a haver
-- uma caixa em Definições, com duas naturezas — «não está bem» e «podia ter» —, e com o sítio da app onde aconteceu.
--
-- Guardamos de propósito o **modelo e a versão do sistema** que a pessoa escreveu na app: metade dos erros são de um
-- telemóvel só, e sem isso não se reproduzem. Não guardamos localização, nem nada que a pessoa não tenha escrito.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profile (id) on delete set null,
  kind text not null check (kind in ('erro', 'ideia')),
  -- Onde é que isto aconteceu, como a pessoa escolheu na lista.
  area text not null check (
    area in ('jogos', 'boleias', 'contas', 'locais', 'mapa', 'perfil', 'grupos', 'outro')
  ),
  body text not null check (char_length(btrim(body)) between 10 and 1000),
  /** O que a app sabe do aparelho, para um erro poder ser reproduzido. */
  device text check (char_length(device) <= 120),
  app_version text check (char_length(app_version) <= 40),
  status text not null default 'novo' check (status in ('novo', 'visto', 'resolvido')),
  created_at timestamptz not null default now()
);

create index feedback_status_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create function public.send_feedback(
  p_kind text,
  p_area text,
  p_body text,
  p_device text default null,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  texto text := btrim(coalesce(p_body, ''));
  novo uuid;
begin
  if p_kind not in ('erro', 'ideia')
     or p_area not in ('jogos', 'boleias', 'contas', 'locais', 'mapa', 'perfil', 'grupos', 'outro') then
    raise exception 'bad_feedback' using errcode = '22023';
  end if;
  if char_length(texto) < 10 or char_length(texto) > 1000 then
    raise exception 'bad_body' using errcode = '22023';
  end if;
  -- Sem conta também se pode reportar: um erro não espera por um registo.
  if caller is not null and not public.take_rate_limit(caller, 'feedback', 10, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.feedback (profile_id, kind, area, body, device, app_version)
  values (caller, p_kind, p_area, texto, left(p_device, 120), left(p_app_version, 40))
  returning id into novo;

  return novo;
end;
$$;

/** O que foi reportado, para quem administra. */
create function public.feedback_inbox(p_status text default 'novo')
returns table (
  id uuid,
  kind text,
  area text,
  body text,
  device text,
  app_version text,
  status text,
  from_name text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.kind, f.area, f.body, f.device, f.app_version, f.status, p.display_name, f.created_at
  from public.feedback as f
  left join public.profile as p on p.id = f.profile_id
  where exists (select 1 from public.profile as eu where eu.id = auth.uid() and eu.is_admin)
    and (p_status is null or f.status = p_status)
  order by f.created_at desc
  limit 200;
$$;

create function public.set_feedback_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profile where id = auth.uid() and is_admin) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_status not in ('novo', 'visto', 'resolvido') then
    raise exception 'bad_status' using errcode = '22023';
  end if;
  update public.feedback set status = p_status where id = p_id;
end;
$$;

revoke execute on function public.send_feedback(text, text, text, text, text) from public;
revoke execute on function public.feedback_inbox(text) from public, anon;
revoke execute on function public.set_feedback_status(uuid, text) from public, anon;
grant execute on function public.send_feedback(text, text, text, text, text) to anon, authenticated;
grant execute on function public.feedback_inbox(text) to authenticated;
grant execute on function public.set_feedback_status(uuid, text) to authenticated;
