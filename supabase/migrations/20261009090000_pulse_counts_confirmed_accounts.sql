-- The tascos map counted only accounts at least 3 days old (20261008110000). That hid every new tester on the first
-- test day. Now it counts accounts with a confirmed email, from day one. Totals still round down to multiples of 5
-- and the map still refreshes every 5 minutes only, so a single new person never shows.

create or replace function public.refresh_place_pulse()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  published integer;
begin
  perform pg_advisory_xact_lock(hashtext('place_pulse'));

  -- Kick-off at the tasco's stadium after the check-in: presence ends at kick-off.
  update public.checkin as c
  set ended_at = f.kickoff_at
  from public.place as pl, public.fixture as f
  where c.ended_at is null
    and c.expires_at > now()
    and pl.id = c.place_id
    and f.venue_id = pl.venue_id
    and f.kickoff_at > c.created_at
    and f.kickoff_at <= now();

  -- Only accounts with a confirmed email count (every sign-up confirms it with a code): new testers count from day
  -- one, and faking the 5 takes 5 real email addresses.
  with active as (
    select c.place_id, c.club_id
    from public.checkin as c
    join auth.users as u on u.id = c.profile_id
    where c.ended_at is null and c.expires_at > now() and u.email_confirmed_at is not null
  ),
  totals as (
    select a.place_id, count(*)::integer as people
    from active as a
    group by a.place_id
    having count(*) >= 5
  ),
  by_club as (
    select a.place_id, a.club_id, count(*)::integer as people
    from active as a
    join totals as t on t.place_id = a.place_id
    where a.club_id is not null
    group by a.place_id, a.club_id
    having count(*) >= 5
  ),
  -- Published rounded down to multiples of 5: one more person does not show.
  pulse_rows as (
    select
      t.place_id,
      pl.venue_id,
      (t.people / 5) * 5 as people,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object('club_id', b.club_id, 'people', (b.people / 5) * 5)
            order by b.people desc, b.club_id
          )
          from by_club as b
          where b.place_id = t.place_id
        ),
        '[]'::jsonb
      ) as clubs,
      greatest(
        0,
        (t.people / 5) * 5
          - coalesce((select sum((b.people / 5) * 5) from by_club as b where b.place_id = t.place_id), 0)::integer
      ) as others
    from totals as t
    join public.place as pl on pl.id = t.place_id
  ),
  removed as (
    delete from public.place_pulse as pp
    where not exists (select 1 from pulse_rows as r where r.place_id = pp.place_id)
  )
  insert into public.place_pulse (place_id, venue_id, people, clubs, others, updated_at)
  select r.place_id, r.venue_id, r.people, r.clubs, r.others, now()
  from pulse_rows as r
  on conflict (place_id) do update
    set venue_id = excluded.venue_id,
        people = excluded.people,
        clubs = excluded.clubs,
        others = excluded.others,
        updated_at = excluded.updated_at;

  get diagnostics published = row_count;
  return published;
end;
$$;

select public.refresh_place_pulse();
