-- Um perfil com cara.
--
-- Até agora uma pessoa era um nome e umas iniciais dentro de um círculo. Para quem vai meter-se num carro com um
-- desconhecido, ou dividir contas com ele, isso é pouco. Passa a haver **foto** e **de onde se é**, e o nome deixa
-- de ficar preso ao que se escreveu no registo.
--
-- A foto é vista por **quem tem conta** — é isso que a torna útil no quadro das boleias, onde ainda ninguém se
-- conhece. Não é pública na internet: o balde é privado e as imagens só se abrem com um link assinado, dado a quem
-- está autenticado. Quem não quiser foto não põe: as iniciais continuam a servir.
--
-- Há uma porta para quando alguém puser lá o que não deve: qualquer pessoa pode denunciar uma foto, e quem
-- administra tira-a. A pessoa não é apagada nem bloqueada — fica só sem foto.

alter table public.profile
  add column avatar_path text
    check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  add column home_city text
    check (home_city is null or char_length(btrim(home_city)) between 2 and 60);

grant update (home_city) on public.profile to authenticated;

-- O balde das fotos: privado, 3 MB, e uma pasta por pessoa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 3145728, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do nothing;

create policy "signed in people see avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "people upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "people replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "people delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Mudar o nome. Estava preso ao registo, e um nome mal escrito ficava para sempre.
create function public.set_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  nome text := btrim(coalesce(p_name, ''));
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(nome) < 2 or char_length(nome) > 40 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if not public.take_rate_limit(caller, 'profile-name', 5, interval '7 days') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  update public.profile set display_name = nome where id = caller;
end;
$$;

-- De onde se é. Serve para quem lê uma boleia saber com quem vai.
create function public.set_home_city(p_city text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  cidade text := nullif(btrim(coalesce(p_city, '')), '');
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if cidade is not null and char_length(cidade) not between 2 and 60 then
    raise exception 'bad_city' using errcode = '22023';
  end if;
  update public.profile set home_city = cidade where id = caller;
end;
$$;

-- Guardar a foto que acabou de subir. O caminho tem de ser da pasta da própria pessoa.
create function public.set_profile_photo(p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_path is null or p_path !~ ('^' || caller::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  update public.profile set avatar_path = p_path where id = caller;
end;
$$;

create function public.clear_profile_photo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  update public.profile set avatar_path = null where id = auth.uid();
end;
$$;

/**
 * O cartão de uma pessoa: o que se mostra ao lado do nome dela numa boleia, num grupo ou numas contas. Só para quem
 * tem conta, e só isto — nunca email, morada nem localização.
 */
create function public.profile_cards(p_profile_ids uuid[])
returns table (
  profile_id uuid,
  display_name text,
  avatar_path text,
  home_city text,
  member_since date,
  rides_completed integer,
  rides_faults integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.home_city,
    p.created_at::date,
    rep.completed,
    rep.faults,
    p.id = auth.uid()
  from unnest(p_profile_ids) as pedido(id)
  join public.profile as p on p.id = pedido.id
  cross join lateral public.ride_reputation(array[p.id]) as rep
  where auth.uid() is not null;
$$;

-- Denúncias de fotos: a porta para quando alguém põe lá o que não deve.
create table public.profile_photo_report (
  profile_id uuid not null references public.profile (id) on delete cascade,
  reported_by uuid not null references public.profile (id) on delete cascade,
  reason text check (char_length(btrim(reason)) <= 200),
  created_at timestamptz not null default now(),
  primary key (profile_id, reported_by)
);

alter table public.profile_photo_report enable row level security;
revoke all on public.profile_photo_report from anon, authenticated;

create function public.report_profile_photo(p_profile_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_profile_id = caller then
    raise exception 'bad_request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profile where id = p_profile_id and avatar_path is not null
  ) then
    raise exception 'no_photo' using errcode = 'P0002';
  end if;
  if not public.take_rate_limit(caller, 'photo-report', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.profile_photo_report (profile_id, reported_by, reason)
  values (p_profile_id, caller, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (profile_id, reported_by) do update set reason = excluded.reason;
end;
$$;

/** As fotos denunciadas, para quem administra. */
create function public.reported_profile_photos()
returns table (profile_id uuid, display_name text, avatar_path text, reports integer, last_report timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.avatar_path,
    count(*)::integer,
    max(r.created_at)
  from public.profile_photo_report as r
  join public.profile as p on p.id = r.profile_id
  where exists (select 1 from public.profile as eu where eu.id = auth.uid() and eu.is_admin)
    and p.avatar_path is not null
  group by p.id, p.display_name, p.avatar_path
  order by max(r.created_at) desc;
$$;

/** Tirar a foto a alguém. A pessoa fica na app, só sem foto. */
create function public.admin_clear_profile_photo(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profile where id = auth.uid() and is_admin) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.profile set avatar_path = null where id = p_profile_id;
  delete from public.profile_photo_report where profile_id = p_profile_id;
end;
$$;

revoke execute on function public.set_display_name(text) from public, anon;
revoke execute on function public.set_home_city(text) from public, anon;
revoke execute on function public.set_profile_photo(text) from public, anon;
revoke execute on function public.clear_profile_photo() from public, anon;
revoke execute on function public.profile_cards(uuid[]) from public, anon;
revoke execute on function public.report_profile_photo(uuid, text) from public, anon;
revoke execute on function public.reported_profile_photos() from public, anon;
revoke execute on function public.admin_clear_profile_photo(uuid) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.set_home_city(text) to authenticated;
grant execute on function public.set_profile_photo(text) to authenticated;
grant execute on function public.clear_profile_photo() to authenticated;
grant execute on function public.profile_cards(uuid[]) to authenticated;
grant execute on function public.report_profile_photo(uuid, text) to authenticated;
grant execute on function public.reported_profile_photos() to authenticated;
grant execute on function public.admin_clear_profile_photo(uuid) to authenticated;
