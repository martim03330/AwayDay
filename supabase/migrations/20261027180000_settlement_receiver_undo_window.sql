-- Whoever received a payment can take back their own confirmation for 10 minutes (decided 2026-10-27, after the test
-- round: the receiver tapped «Já recebi» on the wrong person and only the payer could undo it, with no reason to).
--
-- Before: once confirmed, only the payer could remove a payment. Now the receiver can too, for 10 minutes after
-- confirming: enough to fix a wrong tap, not enough to bring a paid debt back later. The payer can still remove it at
-- any time, and a pending payment stays removable by anyone in it or who wrote it.
--
-- trip_settlements gains `receiver_undo_until`: until when I, the receiver, may still undo it (null when I am not the
-- receiver or it is not confirmed). The app hides «Desfazer» after that time; the server checks it again.

create or replace function public.remove_trip_settlement(p_settlement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pagamento public.trip_settlement;
begin
  select * into pagamento from public.trip_settlement where id = p_settlement_id;
  if pagamento.id is null
     or auth.uid() is distinct from pagamento.from_profile_id
        and auth.uid() is distinct from pagamento.to_profile_id
        and auth.uid() is distinct from pagamento.created_by then
    raise exception 'not_yours' using errcode = '42501';
  end if;
  -- Once confirmed, the payer can take it back; the receiver only within 10 minutes of confirming (a wrong tap).
  if pagamento.confirmed_at is not null
     and auth.uid() is distinct from pagamento.from_profile_id
     and not (
       auth.uid() = pagamento.to_profile_id
       and pagamento.confirmed_at > now() - interval '10 minutes'
     ) then
    raise exception 'confirmed_settlement' using errcode = '42501';
  end if;
  delete from public.trip_settlement where id = p_settlement_id;
end;
$$;

revoke execute on function public.remove_trip_settlement(uuid) from public, anon;
grant execute on function public.remove_trip_settlement(uuid) to authenticated;

drop function public.trip_settlements(uuid);

create function public.trip_settlements(p_session_id uuid)
returns table (
  id uuid,
  from_profile_id uuid,
  from_name text,
  to_profile_id uuid,
  to_name text,
  cents integer,
  confirmed boolean,
  i_receive boolean,
  mine boolean,
  created_on date,
  receiver_undo_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.from_profile_id,
    de.display_name,
    t.to_profile_id,
    para.display_name,
    t.cents,
    t.confirmed_at is not null,
    t.to_profile_id = auth.uid(),
    t.from_profile_id = auth.uid() or t.to_profile_id = auth.uid() or t.created_by = auth.uid(),
    t.created_at::date,
    case
      when t.confirmed_at is not null and t.to_profile_id = auth.uid() then t.confirmed_at + interval '10 minutes'
    end
  from public.trip_settlement as t
  join public.profile as de on de.id = t.from_profile_id
  join public.profile as para on para.id = t.to_profile_id
  where t.session_id = p_session_id and public.is_trip_member(p_session_id, auth.uid())
  order by t.created_at desc;
$$;

revoke execute on function public.trip_settlements(uuid) from public, anon;
grant execute on function public.trip_settlements(uuid) to authenticated;
