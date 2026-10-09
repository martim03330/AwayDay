-- Row counts of every table in the public schema plus auth.users, one "table|rows" line each, in a fixed order.
-- Used by the backup workflow to compare production with the restored copy. Tables that change on their own between
-- the dump and the count (caches, presence, rate limits, the map aggregate) are left out, so a busy minute never
-- looks like a broken copy.
select string_agg(t.tabela || '|' || t.linhas, E'\n' order by t.tabela)
from (
  select format('%I.%I', n.nspname, c.relname) as tabela,
         (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint as linhas
  from pg_class as c
  join pg_namespace as n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
    and c.relname not in ('route_cache', 'place_search_cache', 'place_pulse', 'checkin', 'rate_limit_hit',
                          'weather_notice', 'fixture_weather', 'home_fan_report', 'home_fan_cell')
) as t;
