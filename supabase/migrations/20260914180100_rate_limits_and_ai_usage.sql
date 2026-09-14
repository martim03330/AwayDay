-- Server-side limits for the Edge Functions. Service role only.
-- 1. take_rate_limit(): a limit per user and bucket (e.g. new coach messages per hour). Counting and recording happen
--    under a lock per user and bucket, so parallel requests cannot all pass.
-- 2. ai_usage_since(): model tokens summed in SQL. The functions used to read the rows through the API, which stops
--    at max_rows (1000): past that, the monthly spend stopped growing and the budget never tripped.

create table public.rate_limit_hit (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profile (id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 60),
  created_at timestamptz not null default now()
);

create index rate_limit_hit_profile_bucket_idx on public.rate_limit_hit (profile_id, bucket, created_at);

alter table public.rate_limit_hit enable row level security;
-- No policies: only the Edge Functions (service role) use it, through take_rate_limit().
revoke all on public.rate_limit_hit from anon, authenticated;

-- `true` (and one more hit recorded) while the user is under the limit for the window; `false` otherwise.
create function public.take_rate_limit(p_profile_id uuid, p_bucket text, p_limit integer, p_window interval)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_profile_id::text, 0));

  delete from public.rate_limit_hit
  where profile_id = p_profile_id and bucket = p_bucket and created_at <= now() - p_window;

  if (
    select count(*) from public.rate_limit_hit where profile_id = p_profile_id and bucket = p_bucket
  ) >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hit (profile_id, bucket) values (p_profile_id, p_bucket);
  return true;
end;
$$;

-- Model tokens since a moment. Coach messages and season recaps apart (different models, different prices), plus
-- how many coach messages the model wrote for one user.
create function public.ai_usage_since(p_since timestamptz, p_profile_id uuid)
returns table (
  nudge_input_tokens bigint,
  nudge_output_tokens bigint,
  recap_input_tokens bigint,
  recap_output_tokens bigint,
  profile_model_messages bigint
)
language sql
stable
set search_path = ''
as $$
  select
    (select coalesce(sum(n.input_tokens), 0)::bigint from public.nudge as n where n.created_at >= p_since),
    (select coalesce(sum(n.output_tokens), 0)::bigint from public.nudge as n where n.created_at >= p_since),
    (select coalesce(sum(r.input_tokens), 0)::bigint from public.season_recap as r where r.created_at >= p_since),
    (select coalesce(sum(r.output_tokens), 0)::bigint from public.season_recap as r where r.created_at >= p_since),
    (
      select count(*)
      from public.nudge as n
      where n.created_at >= p_since and n.input_tokens > 0 and n.profile_id = p_profile_id
    );
$$;

revoke execute on function public.take_rate_limit(uuid, text, integer, interval) from public, anon, authenticated;
revoke execute on function public.ai_usage_since(timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.take_rate_limit(uuid, text, integer, interval) to service_role;
grant execute on function public.ai_usage_since(timestamptz, uuid) to service_role;
