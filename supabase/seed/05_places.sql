-- Demo places (fictional), generated once from src/mocks/locais.ts with the same ids.
-- When the places screens read from the database, this file becomes the source.

insert into public.place (id, name, name_article, kind, venue_id, walking_minutes, distance_m, location)
values
  ('tasca-terceiro-anel', 'Tasca do Terceiro Anel', 'a', 'tasca', 'luz', 4, 350, extensions.st_setsrid(extensions.st_makepoint(-9.1874, 38.75133), 4326)::extensions.geography),
  ('roulotte-sr-ze', 'Roulotte do Sr. Zé', 'a', 'roulotte', 'luz', 2, 180, extensions.st_setsrid(extensions.st_makepoint(-9.18476, 38.75399), 4326)::extensions.geography),
  ('cervejaria-aguia-dourada', 'Cervejaria Águia Dourada', 'a', 'cervejaria', 'luz', 8, 650, extensions.st_setsrid(extensions.st_makepoint(-9.18935, 38.74976), 4326)::extensions.geography),
  ('o-cachecol', 'O Cachecol', '', 'bar', 'luz', 11, 900, extensions.st_setsrid(extensions.st_makepoint(-9.18585, 38.7463), 4326)::extensions.geography),
  ('churrasqueira-segunda-circular', 'Churrasqueira da Segunda Circular', 'a', 'churrasqueira', 'luz', 14, 1100, extensions.st_setsrid(extensions.st_makepoint(-9.19476, 38.75366), 4326)::extensions.geography),
  ('tasca-das-antas', 'Tasca das Antas', 'a', 'tasca', 'dragao', 5, 400, extensions.st_setsrid(extensions.st_makepoint(-8.58736, 41.16077), 4326)::extensions.geography),
  ('bifanas-campanha', 'Bifanas de Campanhã', 'as', 'roulotte', 'dragao', 3, 250, extensions.st_setsrid(extensions.st_makepoint(-8.58388, 41.16), 4326)::extensions.geography),
  ('cervejaria-azul-branco', 'Cervejaria Azul e Branco', 'a', 'cervejaria', 'dragao', 9, 700, extensions.st_setsrid(extensions.st_makepoint(-8.59019, 41.16033), 4326)::extensions.geography),
  ('bar-curva-norte', 'Bar da Curva Norte', 'o', 'bar', 'dragao', 6, 500, extensions.st_setsrid(extensions.st_makepoint(-8.58746, 41.15949), 4326)::extensions.geography),
  ('tasca-leao-velho', 'Tasca do Leão Velho', 'a', 'tasca', 'alvalade', 6, 450, extensions.st_setsrid(extensions.st_makepoint(-9.15749, 38.75925), 4326)::extensions.geography),
  ('roulotte-porta-10', 'Roulotte da Porta 10', 'a', 'roulotte', 'alvalade', 2, 150, extensions.st_setsrid(extensions.st_makepoint(-9.16087, 38.76012), 4326)::extensions.geography),
  ('cervejaria-do-jardim', 'Cervejaria do Jardim', 'a', 'cervejaria', 'alvalade', 10, 800, extensions.st_setsrid(extensions.st_makepoint(-9.15387, 38.76317), 4326)::extensions.geography),
  ('bar-verde-esperanca', 'Bar Verde Esperança', 'o', 'bar', 'alvalade', 8, 600, extensions.st_setsrid(extensions.st_makepoint(-9.15882, 38.75717), 4326)::extensions.geography),
  ('tasca-da-pedreira', 'Tasca da Pedreira', 'a', 'tasca', 'municipal-braga', 14, 900, extensions.st_setsrid(extensions.st_makepoint(-8.43301, 41.56862), 4326)::extensions.geography),
  ('cervejaria-arcebispos', 'Cervejaria dos Arcebispos', 'a', 'cervejaria', 'municipal-braga', 18, 1400, extensions.st_setsrid(extensions.st_makepoint(-8.42926, 41.57254), 4326)::extensions.geography),
  ('roulotte-monte-castro', 'Roulotte do Monte Castro', 'a', 'roulotte', 'municipal-braga', 4, 300, extensions.st_setsrid(extensions.st_makepoint(-8.43209, 41.56413), 4326)::extensions.geography),
  ('tasca-do-berco', 'Tasca do Berço', 'a', 'tasca', 'afonso-henriques', 7, 550, extensions.st_setsrid(extensions.st_makepoint(-8.30415, 41.44911), 4326)::extensions.geography),
  ('bar-da-muralha', 'Bar da Muralha', 'o', 'bar', 'afonso-henriques', 15, 1200, extensions.st_setsrid(extensions.st_makepoint(-8.31086, 41.44169), 4326)::extensions.geography),
  ('churrasqueira-conquistador', 'Churrasqueira O Conquistador', 'a', 'churrasqueira', 'afonso-henriques', 5, 400, extensions.st_setsrid(extensions.st_makepoint(-8.30459, 41.44521), 4326)::extensions.geography),
  ('adega-estrada-de-benfica', 'Adega da Estrada de Benfica', 'a', 'tasca', 'luz', 24, 1900, extensions.st_setsrid(extensions.st_makepoint(-9.17254, 38.76252), 4326)::extensions.geography),
  ('taberna-rio-tinto', 'Taberna de Rio Tinto', 'a', 'tasca', 'dragao', 28, 2200, extensions.st_setsrid(extensions.st_makepoint(-8.56334, 41.15824), 4326)::extensions.geography),
  ('cervejaria-do-lumiar', 'Cervejaria do Lumiar', 'a', 'cervejaria', 'alvalade', 23, 1800, extensions.st_setsrid(extensions.st_makepoint(-9.17502, 38.75454), 4326)::extensions.geography),
  ('tasca-da-se', 'Tasca da Sé', 'a', 'tasca', 'municipal-braga', 30, 2300, extensions.st_setsrid(extensions.st_makepoint(-8.40827, 41.56049), 4326)::extensions.geography),
  ('tasca-do-restelo', 'Tasca do Restelo', 'a', 'tasca', 'restelo', 5, 400, extensions.st_setsrid(extensions.st_makepoint(-9.21022, 38.70027), 4326)::extensions.geography),
  ('esplanada-de-belem', 'Esplanada de Belém', 'a', 'bar', 'restelo', 19, 1500, extensions.st_setsrid(extensions.st_makepoint(-9.21998, 38.70773), 4326)::extensions.geography)
on conflict (id) do update set
  name = excluded.name,
  name_article = excluded.name_article,
  kind = excluded.kind,
  venue_id = excluded.venue_id,
  walking_minutes = excluded.walking_minutes,
  distance_m = excluded.distance_m,
  location = excluded.location;
