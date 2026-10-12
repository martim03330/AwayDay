-- One more swear word that testers used as a group name («Pirocudos»): «pirocudo», «pirocuda» (plurals are already
-- caught by dropping the final «s»). Same function as in 20261012170000, with the two words added.

/** Whether a name has a swear word or a slur. */
create or replace function public.is_offensive_name(p_name text)
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
        'punheta', 'piroca', 'pirocudo', 'pirocuda', 'colhoes', 'otario', 'vadia', 'galdeira',
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
