-- Casas (supporters' clubs): the first piece of «Viagens da Casa» (docs/superpowers/specs/2026-10-28-viagens-da-casa-design.md).
--
-- A Casa is an official supporters' club of one club, in one municipality. Anyone signed in can ask to register one;
-- it starts 'pending' and is invisible to everyone except its managers and the admins, until an admin (with the second
-- factor) verifies it. Whoever asked becomes its owner; the owner invites other managers with a single-use code that
-- lasts 7 days. Fans follow a verified Casa to hear about its trips (Task 2 onwards).
--
-- Every write goes through the functions below (security definer); the app can only read, and RLS decides what:
--   * supporters_club: verified ones, the ones I manage, or all of them for an admin;
--   * managers and invites: the managers of that Casa;
--   * followers: the managers of that Casa, and my own row.
-- Suspending a Casa will also cancel its open trips: Task 2 replaces decide_supporters_club with that body.

create table public.supporters_club (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.club (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 80),
  municipality_id text not null references public.municipality (id),
  contact_email text check (
    contact_email is null
    or (char_length(contact_email) <= 254 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
  ),
  status text not null default 'pending' check (status in ('pending', 'verified', 'suspended')),
  requested_by uuid references public.profile (id) on delete set null,
  verified_at timestamptz,
  verified_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One Casa per name in each club, whatever the case.
create unique index supporters_club_club_name_idx on public.supporters_club (club_id, lower(name));
create index supporters_club_requested_by_idx on public.supporters_club (requested_by) where status = 'pending';
create index supporters_club_municipality_idx on public.supporters_club (municipality_id);

create table public.supporters_club_manager (
  club_id uuid not null references public.supporters_club (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  role text not null default 'manager' check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (club_id, profile_id)
);

create index supporters_club_manager_profile_idx on public.supporters_club_manager (profile_id);

create table public.supporters_club_follower (
  club_id uuid not null references public.supporters_club (id) on delete cascade,
  profile_id uuid not null references public.profile (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (club_id, profile_id)
);

create index supporters_club_follower_profile_idx on public.supporters_club_follower (profile_id);

create table public.supporters_club_invite (
  code text primary key check (code ~ '^[a-z0-9]{10}$'),
  club_id uuid not null references public.supporters_club (id) on delete cascade,
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references public.profile (id) on delete set null,
  used_at timestamptz
);

create index supporters_club_invite_club_idx on public.supporters_club_invite (club_id);

create trigger supporters_club_set_updated_at
  before update on public.supporters_club
  for each row execute function public.set_updated_at();

-- Who verified or suspended a Casa, and when, goes to the admin log like the other moderation changes.
create trigger supporters_club_status_logged
  after update of status on public.supporters_club
  for each row execute function public.log_admin_change('supporters_club_status', 'status', '');

-- ---------------------------------------------------------------------------------------------------------------------
-- Am I a manager (owner or manager) of this Casa? Security definer so the policies below can use it without
-- recursing into supporters_club_manager's own policy.

create function public.is_supporters_club_manager(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.supporters_club_manager as m
    where m.club_id = p_club_id and m.profile_id = auth.uid()
  );
$$;

create function public.is_supporters_club_owner(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.supporters_club_manager as m
    where m.club_id = p_club_id and m.profile_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- RLS: read-only for the app; writes only through the functions.

alter table public.supporters_club enable row level security;
alter table public.supporters_club_manager enable row level security;
alter table public.supporters_club_follower enable row level security;
alter table public.supporters_club_invite enable row level security;

revoke all on public.supporters_club from anon, authenticated;
revoke all on public.supporters_club_manager from anon, authenticated;
revoke all on public.supporters_club_follower from anon, authenticated;
revoke all on public.supporters_club_invite from anon, authenticated;

grant select on public.supporters_club to authenticated;
grant select on public.supporters_club_manager to authenticated;
grant select on public.supporters_club_follower to authenticated;
grant select on public.supporters_club_invite to authenticated;

create policy "verified casas, the ones I manage, or all for admins"
  on public.supporters_club for select to authenticated
  using (
    status = 'verified'
    or (select public.is_supporters_club_manager(id))
    or (select public.is_admin())
  );

create policy "managers see the managers of their casa"
  on public.supporters_club_manager for select to authenticated
  using ((select public.is_supporters_club_manager(club_id)));

create policy "managers see the followers of their casa, and I see my own follow"
  on public.supporters_club_follower for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select public.is_supporters_club_manager(club_id))
  );

create policy "managers see the invites of their casa"
  on public.supporters_club_invite for select to authenticated
  using ((select public.is_supporters_club_manager(club_id)));

-- ---------------------------------------------------------------------------------------------------------------------
-- Ask to register a Casa. It starts pending, with the caller as owner. At most 2 pending requests per person.

create function public.request_supporters_club(
  p_club_id text,
  p_name text,
  p_municipality_id text,
  p_contact_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  nome text := btrim(coalesce(p_name, ''));
  email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  novo uuid;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(nome) < 3 or char_length(nome) > 80 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if email is not null
     and (char_length(email) > 254 or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'bad_email' using errcode = '22023';
  end if;
  if not exists (select 1 from public.club where id = p_club_id) then
    raise exception 'club_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.municipality where id = p_municipality_id) then
    raise exception 'municipality_not_found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.supporters_club where requested_by = caller and status = 'pending') >= 2 then
    raise exception 'too_many_pending' using errcode = '22023';
  end if;

  begin
    insert into public.supporters_club (club_id, name, municipality_id, contact_email, requested_by)
    values (p_club_id, nome, p_municipality_id, email, caller)
    returning id into novo;
  exception when unique_violation then
    raise exception 'name_taken' using errcode = '23505';
  end;

  insert into public.supporters_club_manager (club_id, profile_id, role)
  values (novo, caller, 'owner');

  return novo;
end;
$$;

-- An admin (with the second factor) verifies or suspends a Casa. Task 2 replaces this body: suspending also cancels
-- the Casa's open trips.
create function public.decide_supporters_club(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('verified', 'suspended') then
    raise exception 'bad_status' using errcode = '22023';
  end if;

  if p_status = 'verified' then
    update public.supporters_club
    set status = 'verified', verified_at = now(), verified_by = auth.uid()
    where id = p_id;
  else
    update public.supporters_club set status = 'suspended' where id = p_id;
  end if;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- The owner creates a single-use code (valid 7 days) to bring in another manager.
create function public.create_supporters_club_invite(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  codigo text := public.new_invite_code();
begin
  if caller is null or not public.is_supporters_club_owner(p_club_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if not public.take_rate_limit(caller, 'supporters-club-invite', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  insert into public.supporters_club_invite (code, club_id, created_by)
  values (codigo, p_club_id, caller);

  return codigo;
end;
$$;

-- Accept a manager invite: the caller becomes a manager of that Casa. A code works once and only until it expires.
-- Someone who already manages the Casa leaves the code unused for whoever it was meant for.
create function public.accept_supporters_club_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  convite public.supporters_club_invite;
begin
  if caller is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.take_rate_limit(caller, 'supporters-club-invite-accept', 20, interval '1 day') then
    raise exception 'rate_limited' using errcode = '22023';
  end if;

  select * into convite
  from public.supporters_club_invite
  where code = lower(btrim(coalesce(p_code, '')))
  for update;
  if convite.code is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if convite.used_by is not null or convite.used_at is not null then
    raise exception 'invite_used' using errcode = '22023';
  end if;
  if convite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.supporters_club_manager
    where club_id = convite.club_id and profile_id = caller
  ) then
    return convite.club_id;
  end if;

  insert into public.supporters_club_manager (club_id, profile_id, role)
  values (convite.club_id, caller, 'manager');

  update public.supporters_club_invite
  set used_by = caller, used_at = now()
  where code = convite.code;

  return convite.club_id;
end;
$$;

-- The owner removes a manager. The only owner cannot remove themselves (the Casa would be left without one).
create function public.remove_supporters_club_manager(p_club_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  papel text;
begin
  if caller is null or not public.is_supporters_club_owner(p_club_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  select role into papel
  from public.supporters_club_manager
  where club_id = p_club_id and profile_id = p_profile_id;
  if papel is null then
    raise exception 'not_manager' using errcode = 'P0002';
  end if;
  if papel = 'owner' and (
    select count(*) from public.supporters_club_manager where club_id = p_club_id and role = 'owner'
  ) <= 1 then
    raise exception 'last_owner' using errcode = '22023';
  end if;

  delete from public.supporters_club_manager where club_id = p_club_id and profile_id = p_profile_id;
end;
$$;

-- The owner changes the name or the contact email (null clears it).
create function public.update_supporters_club(p_id uuid, p_name text, p_contact_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome text := btrim(coalesce(p_name, ''));
  email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
begin
  if auth.uid() is null or not public.is_supporters_club_owner(p_id) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if char_length(nome) < 3 or char_length(nome) > 80 then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  if email is not null
     and (char_length(email) > 254 or email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'bad_email' using errcode = '22023';
  end if;

  begin
    update public.supporters_club set name = nome, contact_email = email where id = p_id;
  exception when unique_violation then
    raise exception 'name_taken' using errcode = '23505';
  end;
end;
$$;

-- Follow or unfollow a Casa. Only a verified Casa can be followed; unfollowing always works.
create function public.set_supporters_club_follow(p_id uuid, p_follow boolean)
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

  if coalesce(p_follow, false) then
    if not exists (select 1 from public.supporters_club where id = p_id and status = 'verified') then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    insert into public.supporters_club_follower (club_id, profile_id)
    values (p_id, caller)
    on conflict (club_id, profile_id) do nothing;
  else
    delete from public.supporters_club_follower where club_id = p_id and profile_id = caller;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- Grants: signed-in people only.

revoke execute on function public.is_supporters_club_manager(uuid) from public, anon;
revoke execute on function public.is_supporters_club_owner(uuid) from public, anon;
revoke execute on function public.request_supporters_club(text, text, text, text) from public, anon;
revoke execute on function public.decide_supporters_club(uuid, text) from public, anon;
revoke execute on function public.create_supporters_club_invite(uuid) from public, anon;
revoke execute on function public.accept_supporters_club_invite(text) from public, anon;
revoke execute on function public.remove_supporters_club_manager(uuid, uuid) from public, anon;
revoke execute on function public.update_supporters_club(uuid, text, text) from public, anon;
revoke execute on function public.set_supporters_club_follow(uuid, boolean) from public, anon;

grant execute on function public.is_supporters_club_manager(uuid) to authenticated;
grant execute on function public.is_supporters_club_owner(uuid) to authenticated;
grant execute on function public.request_supporters_club(text, text, text, text) to authenticated;
grant execute on function public.decide_supporters_club(uuid, text) to authenticated;
grant execute on function public.create_supporters_club_invite(uuid) to authenticated;
grant execute on function public.accept_supporters_club_invite(text) to authenticated;
grant execute on function public.remove_supporters_club_manager(uuid, uuid) to authenticated;
grant execute on function public.update_supporters_club(uuid, text, text) to authenticated;
grant execute on function public.set_supporters_club_follow(uuid, boolean) to authenticated;
