-- Profile name for accounts made with «Continuar com Apple / Google» (2026-10-13).
--
-- These accounts have no `display_name` in the sign-up metadata. Google sends the person's name as `full_name` and
-- `name`; Apple usually sends nothing in the token (the app saves the name Apple gives on the first sign-in right
-- after, through set_display_name). The profile name now falls back, in order, to `display_name`, `full_name`,
-- `name`, then 'Adepto'. A name longer than 40 characters keeps its first and last words.
--
-- Never part of the email: that is the rule of 2026-09-14 (docs/DECISOES.md, «Autenticação e identidade»), and the
-- sign-up form promises the email is seen by nobody else. With Apple it would often be a private relay address
-- anyway.
--
-- Offensive names: a name the person typed (`display_name`, on the email sign-up form) still makes the sign-up fail
-- with 'bad_name' (profile_name_not_offensive), and the form asks for another. A name that came from Apple or Google
-- was not typed in the app: if it is offensive, the account is made with 'Adepto' instead of failing the sign-in.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  candidate text;
  chosen text;
begin
  if char_length(requested_name) between 2 and 40 then
    chosen := requested_name;
  else
    foreach candidate in array array[
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      coalesce(new.raw_user_meta_data ->> 'name', '')
    ] loop
      candidate := btrim(regexp_replace(candidate, '\s+', ' ', 'g'));
      if char_length(candidate) > 40 then
        candidate := regexp_replace(candidate, '^(\S+) .* (\S+)$', '\1 \2');
      end if;
      if char_length(candidate) between 2 and 40 and not public.is_offensive_name(candidate) then
        chosen := candidate;
        exit;
      end if;
    end loop;
  end if;
  insert into public.profile (id, display_name) values (new.id, coalesce(chosen, 'Adepto'));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
