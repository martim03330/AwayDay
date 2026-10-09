-- Admin powers need the second factor (2026-10-09). is_admin() is true only for a profile marked admin AND a session
-- verified with an authenticator app (TOTP, Supabase Auth MFA: free): the JWT says aal2. A stolen password alone no
-- longer reaches moderation, reports, feedback or meeting point drafts. Every admin policy and RPC goes through
-- is_admin(); the three functions that read profile.is_admin directly now call it too. The meeting-point-drafts Edge
-- Function checks the same claim.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profile as p where p.id = auth.uid()), false)
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

CREATE OR REPLACE FUNCTION public.feedback_inbox(p_status text DEFAULT 'novo'::text)
 RETURNS TABLE(id uuid, kind text, area text, body text, device text, app_version text, status text, from_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.id, f.kind, f.area, f.body, f.device, f.app_version, f.status, p.display_name, f.created_at
  from public.feedback as f
  left join public.profile as p on p.id = f.profile_id
  where public.is_admin()
    and (p_status is null or f.status = p_status)
  order by f.created_at desc
  limit 200;
$function$;

CREATE OR REPLACE FUNCTION public.can_open_avatar(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select auth.uid() is not null and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1 from public.profile as p
      where p.avatar_path = p_name and public.can_see_profile_card(auth.uid(), p.id)
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_see_profile_card(p_viewer uuid, p_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_viewer is not null and p_profile_id is not null and (
    p_viewer = p_profile_id
    or (p_viewer = auth.uid() and public.is_admin())
    or (
      not public.has_blocked(p_profile_id, p_viewer)
      and (
        public.can_see_profile(p_viewer, p_profile_id)
        or exists (
          select 1
          from public.fixture_plan as fp
          where fp.status <> 'cancelado'
            and (
              fp.created_by = p_profile_id
              or exists (
                select 1 from public.fixture_plan_answer as a
                where a.plan_id = fp.id and a.profile_id = p_profile_id
              )
            )
            and public.can_see_fixture_plan(fp.id, p_viewer)
        )
      )
    )
  );
$function$;
