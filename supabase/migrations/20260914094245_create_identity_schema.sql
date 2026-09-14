-- Identity: one profile per auth user and the clubs they relate to.
-- Emails stay in auth.users: nothing here exposes them to other users.

-- Shared trigger function that keeps updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile. The name comes from the sign-up metadata; when it is missing or
-- invalid we use a neutral name, never part of the email.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if char_length(requested_name) not between 2 and 40 then
    requested_name := 'Adepto';
  end if;
  insert into public.profile (id, display_name) values (new.id, requested_name);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.profile_club (
  profile_id uuid not null references public.profile (id) on delete cascade,
  relation text not null check (relation in ('supporter', 'hometown')),
  club_id text not null references public.club (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, relation)
);

create index profile_club_club_id_idx on public.profile_club (club_id);

create trigger profile_club_set_updated_at
  before update on public.profile_club
  for each row execute function public.set_updated_at();

-- Row level security.
alter table public.profile enable row level security;
alter table public.profile_club enable row level security;

create policy "profiles are readable by signed-in users"
  on public.profile for select to authenticated using (true);
create policy "users update their own profile"
  on public.profile for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The supporter club is visible to signed-in users. The hometown club hints at where someone lives,
-- so only its owner can see it.
create policy "supporter clubs are readable by signed-in users, hometown clubs only by their owner"
  on public.profile_club for select to authenticated
  using (relation = 'supporter' or (select auth.uid()) = profile_id);
create policy "users add their own clubs"
  on public.profile_club for insert to authenticated
  with check ((select auth.uid()) = profile_id);
create policy "users change their own clubs"
  on public.profile_club for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
create policy "users remove their own clubs"
  on public.profile_club for delete to authenticated
  using ((select auth.uid()) = profile_id);

-- Privileges: anonymous clients get nothing; profiles are created by the trigger and removed with the
-- auth user, and only the display name can be edited.
revoke all on public.profile, public.profile_club from anon;
revoke all on public.profile from authenticated;
grant select on public.profile to authenticated;
grant update (display_name) on public.profile to authenticated;
revoke truncate, references, trigger on public.profile_club from authenticated;
grant select, insert, update, delete on public.profile_club to authenticated;

-- Supporters per club, published only for clubs with at least 5 supporters (aggregate privacy rule).
-- Security definer because clients cannot read other people's rows; it only ever returns counts.
create function public.club_supporter_counts()
returns table (club_id text, supporters bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select pc.club_id, count(*) as supporters
  from public.profile_club as pc
  where pc.relation = 'supporter'
  group by pc.club_id
  having count(*) >= 5;
$$;

revoke execute on function public.club_supporter_counts() from public;
grant execute on function public.club_supporter_counts() to anon, authenticated;
