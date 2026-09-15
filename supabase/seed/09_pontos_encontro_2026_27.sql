-- Official meeting points for travelling fans, 2026-27. Entered by hand, always from an official source.
-- Apply with: supabase db query --linked -f supabase/seed/09_pontos_encontro_2026_27.sql (upsert, safe to run again).
-- Lillestrøm x Torreense (2026-09-17): nothing published by the club yet (checked 2026-09-15).

insert into public.fixture_meeting_point (
  fixture_id, name, address, schedule, transport, note, origin, published_by, source_title, source_url, published_on
)
values (
  'milan-benfica-liga-europa-2026-27',
  'Piazza del Duomo',
  'Piazza del Duomo, centro de Milão',
  'Concentração a partir das 16h00 de Milão (15h00 em Portugal). Metros para o estádio entre as 17h00 e as 17h30 locais. Portas abrem às 19h00; jogo às 21h00 locais (20h00 em Portugal).',
  'Metro dedicado na estação Duomo, Linha Vermelha M1 (sentido Rho Fieramilano), até Lotto. De Lotto ao estádio são cerca de 1,5 km a pé (20 min) pelo Viale Federico Caprilli. Entrada pela Gate 0B (Torre 1, 3.º anel).',
  'Leva documento de identificação: é verificado com o nome do bilhete. Proibidos: malas maiores que A4, carregadores e power banks, fumar (incluindo vapes). Bandeiras sem mensagens políticas ou ofensivas. A cidade proíbe a venda de álcool das 8h00 à meia-noite no centro e a partir das 12h00 na zona de San Siro, e bebidas em vidro ou lata em toda a cidade.',
  'clube',
  'SL Benfica',
  'AC Milan-Benfica: informações para os adeptos',
  'https://www.slbenfica.pt/pt-pt/agora/noticias/2026/09/15/futebol-benfica-informacoes-adeptos-jogo-ac-milan-1-jornada-fase-de-liga-da-liga-europa',
  '2026-09-15'
)
on conflict (fixture_id) do update set
  name = excluded.name,
  address = excluded.address,
  schedule = excluded.schedule,
  transport = excluded.transport,
  note = excluded.note,
  origin = excluded.origin,
  published_by = excluded.published_by,
  source_title = excluded.source_title,
  source_url = excluded.source_url,
  published_on = excluded.published_on;
