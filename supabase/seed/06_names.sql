-- Articles, well-known short names and districts, to write correct Portuguese sentences
-- ("na Luz", "aos Barreiros", "em Alvalade", "a Académica"). Maintained by hand; safe to run again.

update public.venue set name_article = case when id = 'red-bull-arena' then 'a' else 'o' end;

update public.venue as v
set short_name = n.short_name, short_name_article = n.article
from (values
  ('luz', 'Luz', 'a'),
  ('dragao', 'Dragão', 'o'),
  ('alvalade', 'Alvalade', ''),
  ('municipal-braga', 'Pedreira', 'a'),
  ('estadio-maritimo', 'Barreiros', 'os'),
  ('restelo', 'Restelo', 'o'),
  ('madeira', 'Choupana', 'a'),
  ('fontelo', 'Fontelo', 'o'),
  ('arcos', 'Arcos', 'os'),
  -- Long official names: drop the generic words (Estádio, Municipal, Parque de Jogos, Desportivo) and keep
  -- the proper name. "Estádio de" stays where the name alone would read as the town, "Complexo" where it would
  -- read as the club.
  ('comendador-almeida-freitas', 'Comendador Joaquim de Almeida Freitas', 'o'),
  ('municipal-chaves', 'Eng. Manuel Branco Teixeira', 'o'),
  ('magalhaes-pessoa', 'Dr. Magalhães Pessoa', 'o'),
  ('coimbra-da-mota', 'António Coimbra da Mota', 'o'),
  ('complexo-alverca', 'Complexo do FC Alverca', 'o'),
  ('rio-maior', 'Estádio de Rio Maior', 'o'),
  ('22-de-junho', '22 de Junho', 'o'),
  ('santos-pinto', 'José dos Santos Pinto', 'o')
) as n(id, short_name, article)
where v.id = n.id;

update public.venue as v
set district = d.district
from (values
  ('luz', 'Lisboa'), ('alvalade', 'Lisboa'), ('restelo', 'Lisboa'), ('jose-gomes', 'Lisboa'),
  ('coimbra-da-mota', 'Lisboa'), ('complexo-alverca', 'Lisboa'),
  ('dragao', 'Porto'), ('arcos', 'Porto'), ('estadio-do-mar', 'Porto'), ('cd-aves', 'Porto'),
  ('estadio-varzim', 'Porto'),
  ('municipal-braga', 'Braga'), ('afonso-henriques', 'Braga'), ('22-de-junho', 'Braga'),
  ('cidade-de-barcelos', 'Braga'), ('comendador-almeida-freitas', 'Braga'),
  ('municipal-arouca', 'Aveiro'), ('marcolino-de-castro', 'Aveiro'),
  ('joao-cardoso', 'Viseu'), ('fontelo', 'Viseu'),
  ('magalhaes-pessoa', 'Leiria'), ('campo-da-mata', 'Leiria'),
  ('rio-maior', 'Santarém'),
  ('cidade-de-coimbra', 'Coimbra'),
  ('municipal-chaves', 'Vila Real'),
  ('santos-pinto', 'Castelo Branco'),
  ('medideira', 'Setúbal'),
  ('sao-miguel', 'Açores'),
  ('madeira', 'Madeira'), ('estadio-maritimo', 'Madeira')
) as d(id, district)
where v.id = d.id;

update public.club
set name_article = case when id in ('academica', 'juventus', 'roma', 'uniao-leiria') then 'a' else 'o' end;
