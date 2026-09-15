-- Articles, well-known short names and districts for the stadiums and clubs added for the 2026-27 season.
-- Researched from Wikipedia, Wikidata, zerozero and Liga Portugal (see docs/DECISOES.md). Safe to run again.

update public.venue as v
set name_article = n.name_article, short_name = n.short_name, short_name_article = n.short_name_article, district = n.district
from (values
  ('sao-luis', 'o', 'São Luís', 'o', 'Faro'),
  ('municipal-portimao', 'o', 'Portimão', '', 'Faro'),
  ('manuel-marques', 'o', 'Manuel Marques', 'o', 'Lisboa'),
  ('benfica-campus', 'o', 'Seixal', 'o', 'Setúbal'),
  ('aurelio-pereira', 'o', 'Alcochete', '', 'Setúbal'),
  ('municipal-amarante', 'o', null::text, null::text, 'Porto'),
  ('machado-de-matos', 'o', 'Machado de Matos', 'o', 'Porto'),
  ('25-de-abril', 'o', '25 de Abril', 'o', 'Porto'),
  ('fc-vizela', 'o', null::text, null::text, 'Braga'),
  ('luis-filipe-menezes', 'o', 'Olival', 'o', 'Porto'),
  ('jorge-sampaio', 'o', null::text, null::text, 'Porto'),
  ('lusitania-lourosa', 'o', null::text, null::text, 'Aveiro'),
  ('municipal-fafe', 'o', null::text, null::text, 'Braga'),
  ('leca-fc', 'o', null::text, null::text, 'Porto'),
  ('municipal-marco', 'o', null::text, null::text, 'Porto'),
  ('capital-do-movel', 'o', 'Capital do Móvel', 'a', 'Porto'),
  ('laranjeiras', 'o', 'Laranjeiras', 'as', 'Porto'),
  ('sao-joao-de-ver', 'o', null::text, null::text, 'Aveiro'),
  ('cd-trofense', 'o', null::text, null::text, 'Porto'),
  ('jose-de-matos', 'o', 'José de Matos', 'o', 'Viana do Castelo'),
  ('academia-vitoria', 'o', 'Academia', 'a', 'Braga'),
  ('tapadinha', 'o', 'Tapadinha', 'a', 'Lisboa'),
  ('algarve', 'o', null::text, null::text, 'Faro'),
  ('campo-estrela', 'o', null::text, null::text, 'Évora'),
  ('municipal-mafra', 'o', null::text, null::text, 'Lisboa'),
  ('carlos-osorio', 'o', null::text, null::text, 'Aveiro'),
  ('cha-das-padeiras', 'o', null::text, null::text, 'Santarém'),
  ('cernache-bonjardim', 'o', null::text, null::text, 'Castelo Branco')
) as n(id, name_article, short_name, short_name_article, district)
where v.id = n.id;

update public.club as c
set name_article = n.name_article
from (values
  ('farense', 'o'),
  ('portimonense', 'o'),
  ('torreense', 'o'),
  ('benfica-b', 'o'),
  ('sporting-b', 'o'),
  ('amarante', 'o'),
  ('felgueiras', 'o'),
  ('penafiel', 'o'),
  ('vizela', 'o'),
  ('lourosa', 'o'),
  ('porto-b', 'o'),
  ('fafe', 'o'),
  ('leca', 'o'),
  ('marco-09', 'o'),
  ('pacos-ferreira', 'o'),
  ('paredes', 'o'),
  ('sao-joao-de-ver', 'o'),
  ('trofense', 'o'),
  ('vianense', 'o'),
  ('vitoria-b', 'o'),
  ('atletico-cp', 'o'),
  ('louletano', 'o'),
  ('lusitano-evora', 'o'),
  ('mafra', 'o'),
  ('oliveirense', 'a'),
  ('uniao-santarem', 'a'),
  ('vitoria-sernache', 'o')
) as n(id, name_article)
where c.id = n.id;
