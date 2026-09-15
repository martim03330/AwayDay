-- Safety notes for visiting fans in the derbies between Benfica, FC Porto and Sporting (reviewed and approved on
-- 2026-09-15). Only areas, never businesses or people; neutral wording; sources with dates.
-- Left out on purpose: incidents older than 5 seasons, incidents inside the stadium, places far from the stadium and
-- anything without a reputable source. No zones at the Luz or the Dragão: no incidents in identified streets in the
-- last 5 seasons.
-- Apply with: supabase db query --linked -f supabase/seed/10_seguranca_classicos.sql (upsert, safe to run again).

insert into public.venue_safety_note (
  id, venue_id, visiting_club_id, kind, title, description, latitude, longitude, radius_m, reference_date, sources
)
values
  (
    'luz-visitantes-porto', 'luz', 'porto', 'indicacao_oficial',
    'Concentração na Av. Condes de Carnide',
    'Nos clássicos de novembro de 2024 e março de 2026, a PSP concentrou os adeptos do FC Porto na Av. Condes de Carnide, entre a Rotunda Dr. Mário Soares e a Av. Marechal Teixeira Rebelo, e levou-os ao estádio para a abertura das portas.',
    38.7558, -9.1857, null, '2026-03-07',
    '[{"title": "A Bola", "url": "https://www.abola.pt/noticias/a-operacao-da-psp-para-o-classico-da-luz-benfica-fc-porto-2024110818153424404", "date": "2024-11-08"},
      {"title": "SOL", "url": "https://sol.iol.pt/sociedade/noticias/jogo-benfica-fc-porto-e-de-risco-elevado-e-leva-psp-a-condicionar-transito-junto-ao-estadio-da-luz-este-domingo/20260307/69ab56f00cf2d0ed34b7d591", "date": "2026-03-07"}]'
  ),
  (
    'luz-visitantes-sporting', 'luz', 'sporting', 'indicacao_oficial',
    'Cortejo escoltado a partir de Alvalade',
    'No dérbi de dezembro de 2025, a PSP concentrou os adeptos do Sporting junto ao Estádio de Alvalade e levou-os em cortejo escoltado até à Luz, com trânsito condicionado. A PSP pediu que se usassem transportes públicos.',
    null, null, null, '2025-12-05',
    '[{"title": "Público", "url": "https://www.publico.pt/2025/12/05/local/noticia/benficasporting-motiva-operacao-seguranca-psp-condiciona-transito-2157144", "date": "2025-12-05"}]'
  ),
  (
    'alvalade-visitantes-benfica', 'alvalade', 'benfica', 'indicacao_oficial',
    'Concentração no Marquês de Pombal',
    'No dérbi de abril de 2026, a PSP concentrou os adeptos do Benfica na Praça do Marquês de Pombal e levou-os em escolta até à caixa de segurança de Alvalade. Em dezembro de 2024, o cortejo saiu do Estádio da Luz.',
    38.7253, -9.1500, null, '2026-04-19',
    '[{"title": "SAPO", "url": "https://sapo.pt/artigo/derbi-sporting-benfica-considerado-de-risco-elevado-69e28a2ac2da480e3c38d5ba", "date": "2026-04-17"},
      {"title": "A Bola", "url": "https://www.abola.pt/noticias/psp-explica-operacao-e-constrangimentos-para-o-sporting-benfica-2024122713312727897", "date": "2024-12-27"}]'
  ),
  (
    'dragao-visitantes', 'dragao', null, 'indicacao_oficial',
    'Zona de acolhimento em Bonjóia',
    'Nos clássicos de 2025-26, a PSP recebeu os adeptos do Benfica e do Sporting na Rua da Fábrica «A Invencível», em Bonjóia, e escoltou-os até ao estádio. Quem tem bilhete fora dos setores dos visitantes pode ser impedido de entrar.',
    41.1554, -8.5822, null, '2026-04-22',
    '[{"title": "Notícias ao Minuto", "url": "https://www.noticiasaominuto.com/pais/2919296/fc-porto-benfica-e-de-risco-elevado-eis-a-acao-de-policiamento-da-psp", "date": "2026-01-13"},
      {"title": "24 Notícias", "url": "https://24noticias.sapo.pt/desporto/artigos/fc-porto-sporting-com-policiamento-reforcado-no-dragao", "date": "2026-02-10"}]'
  ),
  (
    'alvalade-padre-cruz-campo-grande', 'alvalade', null, 'zona_a_evitar',
    'Av. Padre Cruz e zona do metro do Campo Grande',
    'Em fevereiro de 2024 e fevereiro de 2026 houve confrontos entre grupos de adeptos dos dois clubes, com arremesso de objetos e pirotecnia. Em 2026, antes de um jogo de futsal, a PSP deteve 124 pessoas.',
    38.7604, -9.1566, 350, '2026-02-19',
    '[{"title": "Observador", "url": "https://observador.pt/2024/02/29/tres-episodios-de-confrontos-na-mesma-zona-tochas-pelo-ar-chuva-de-pedras-e-garrafas-o-caos-na-antecamara-do-derbi-em-alvalade/", "date": "2024-02-29"},
      {"title": "RTP", "url": "https://www.rtp.pt/noticias/pais/124-detidos-na-rixa-entre-adeptos-antes-de-derbi-sporting-benfica-em-futsal_n1720302", "date": "2026-02-19"}]'
  ),
  (
    'alvalade-telheiras', 'alvalade', null, 'zona_a_evitar',
    'Acesso vindo de Telheiras',
    'Em fevereiro de 2024, antes de um jogo da Taça de Portugal, houve arremesso de pedras, garrafas e tochas para uma zona com famílias.',
    38.7601, -9.1666, 300, '2024-02-29',
    '[{"title": "Observador", "url": "https://observador.pt/2024/02/29/tres-episodios-de-confrontos-na-mesma-zona-tochas-pelo-ar-chuva-de-pedras-e-garrafas-o-caos-na-antecamara-do-derbi-em-alvalade/", "date": "2024-02-29"}]'
  ),
  (
    'alvalade-linhas-de-torres', 'alvalade', null, 'zona_a_evitar',
    'Alameda das Linhas de Torres',
    'Em junho de 2025, depois de um jogo de hóquei em patins, um carro com adeptos do FC Porto foi atacado e incendiado; houve quatro feridos.',
    38.7621, -9.1563, 250, '2025-06-10',
    '[{"title": "Público", "url": "https://www.publico.pt/2025/06/10/desporto/noticia/carro-adeptos-fc-porto-incendiado-alvalade-ha-dois-feridos-graves-2136238", "date": "2025-06-10"}]'
  )
on conflict (id) do update set
  venue_id = excluded.venue_id,
  visiting_club_id = excluded.visiting_club_id,
  kind = excluded.kind,
  title = excluded.title,
  description = excluded.description,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius_m = excluded.radius_m,
  reference_date = excluded.reference_date,
  sources = excluded.sources;
