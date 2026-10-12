-- No offensive names (testers' feedback, 2026-10-12): people's names, group names and trip names are checked against
-- a list of swear words and slurs (Portuguese, a few Brazilian and English ones).
--
-- Before comparing, the name is normalised: lower case, no accents, digits and symbols read as the letters they
-- imitate («c4br40» → «cabrao»), repeated letters collapsed («merdaaa» → «merda»). Short words count only as whole
-- words (so «Barcelona» is not caught by «cona», nor «Cuba» by «cu»); a few long ones are also caught written
-- together or with dots and spaces between the letters («f.i.l.h.o d.a p.u.t.a»). Left out on purpose, for false
-- positives: «caralho» written together (the «caralhota» bread), «niger» (a country), «dick» (a name).
--
-- A trigger refuses the name with 'bad_name' on insert or change, whatever the path (RPC or sign-up). Names already
-- saved stay until they are changed; an admin can still rename. `name_allowed` lets the sign-up form say «escolhe
-- outro nome» before creating the account.

/** Lower case, no accents, look-alike digits and symbols as letters, only letters and spaces, no repeated letters. */
create function public.moderation_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(
      translate(
        lower(coalesce(p_text, '')),
        'áàâãäéèêëíìîïóòôõöúùûüç4310@$57!|',
        'aaaaaeeeeiiiiooooouuuucaeioasstii'
      ),
      '[^a-z]+', ' ', 'g'
    ),
    '([a-z])\1+', '\1', 'g'
  );
$$;

/** Whether a name has a swear word or a slur. */
create function public.is_offensive_name(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with texto as (select public.moderation_text(p_name) as t)
  select
    -- Whole words (already normalised: no accents, no repeated letters), also without a final «s» (plurals).
    exists (
      select 1
      from texto, unnest(string_to_array(btrim(texto.t), ' ')) as escrita,
        lateral (values (escrita), (regexp_replace(escrita, 's$', ''))) as forma(palavra)
      where palavra = any (array[
        'cu', 'cona', 'conas', 'puta', 'putas', 'merda', 'merdas', 'foda', 'fodase', 'fodido', 'fodida', 'foder',
        'fode', 'fodam', 'caralho', 'caralhos', 'crl', 'fdp', 'pqp', 'cabrao', 'cabroes', 'broche', 'panasca',
        'paneleiro', 'paneleiros', 'maricas', 'larilas', 'corno', 'cornudo', 'viado', 'porra', 'buceta', 'rabeta',
        'punheta', 'piroca', 'colhoes', 'otario', 'vadia', 'galdeira',
        'fuck', 'fucker', 'fucking', 'shit', 'bitch', 'cunt', 'niga', 'fagot', 'fag', 'whore', 'slut',
        'retard', 'cock', 'pusy', 'porn', 'nazi', 'hitler'
      ])
    )
    -- Long ones also written together, or with dots or spaces between the letters.
    or exists (
      select 1
      from texto, unnest(array[
        'filhodaputa', 'putaqueopariu', 'fodase', 'paneleiro', 'cabrao', 'punheta', 'buceta', 'fagot',
        'motherfucker', 'fucking', 'hitler'
      ]) as longa
      where position(longa in regexp_replace(replace(texto.t, ' ', ''), '([a-z])\1+', '\1', 'g')) > 0
    );
$$;

/** For the sign-up form: true when the name can be used. Anyone can ask (there is no account yet). */
create function public.name_allowed(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not public.is_offensive_name(p_name);
$$;

/** Refuses an offensive name, whatever wrote it. The trigger's argument is the column that holds the name. */
create function public.refuse_offensive_name()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  nome text := to_jsonb(new) ->> tg_argv[0];
begin
  if public.is_offensive_name(nome) then
    raise exception 'bad_name' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profile_name_not_offensive
  before insert or update of display_name on public.profile
  for each row execute function public.refuse_offensive_name('display_name');
create trigger fan_group_name_not_offensive
  before insert or update of name on public.fan_group
  for each row execute function public.refuse_offensive_name('name');
create trigger trip_session_name_not_offensive
  before insert or update of name on public.trip_session
  for each row execute function public.refuse_offensive_name('name');

revoke execute on function public.moderation_text(text) from public;
revoke execute on function public.is_offensive_name(text) from public;
revoke execute on function public.refuse_offensive_name() from public, anon, authenticated;
revoke execute on function public.name_allowed(text) from public;
grant execute on function public.moderation_text(text) to authenticated;
grant execute on function public.is_offensive_name(text) to authenticated;
grant execute on function public.name_allowed(text) to anon, authenticated;
