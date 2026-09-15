-- Cheap, quick dishes found on the places' own online menus (research of 2026-09-15). One per place, only when the
-- price was seen on the official site or a menu it links to. Prices in minor units of the local currency.
-- Left out: unverified prices, menus possibly from another restaurant or chain-wide, dishes above a cheap threshold,
-- and sources without https. Places without a dish show "Costuma haver" in the app (typical, not the place's menu).
-- Apply with: supabase db query --linked -f supabase/seed/11_pratos_menus_online.sql (safe to run again).

insert into public.dish (place_id, name, price_cents, currency, source_url, checked_on, status)
select v.place_id, v.name, v.price_cents, v.currency, v.source_url, v.checked_on::date, 'approved'
from (values
  ('americana-grill-bar-a391', 'Batatas fritas', 5000, 'NOK', 'https://americana.no/meny/', '2026-09-15'),
  ('chi-restaurant-bar-5de4', 'Pãezinhos chineses fritos', 5500, 'NOK', 'https://www.chi-restaurant.no/menu', '2026-09-15'),
  ('moshi-moshi-2e4e', 'Crepes chineses', 5500, 'NOK', 'https://moshimoshi.no/', '2026-09-15'),
  ('bistrot-cesarine-4c10', 'Tosta de queijo Maroilles', 600, 'EUR', 'https://cdn.website.dish.co/media/83/7d/6496650/Menu-1.pdf', '2026-09-15'),
  ('le-timgad-b109', 'Folhado frito com ovo (brick)', 790, 'EUR', 'https://uniiti.com/shop/le-timgad', '2026-09-15'),
  ('albatrossen-kaffe-bda1', 'Croissant', 5500, 'NOK', 'https://www.albatrossen-kaffe.no/meny/', '2026-09-15'),
  ('harakiri-4bcf', 'Sopa miso', 4900, 'NOK', 'https://harakiri.no/menu.html', '2026-09-15'),
  ('ho-ho-snaddermat-64fd', 'Batatas fritas', 5500, 'NOK', 'https://hohosnaddermat.no/', '2026-09-15'),
  ('1-2-3-cafetaria-1419', 'Frikandel (salsicha frita)', 300, 'EUR', 'https://www.cafetaria1-2-3.nl/', '2026-09-15'),
  ('babo-9bd3', 'Croquete', 250, 'EUR', 'https://www.cafetariababo.nl/bestellen-bij-babos-grillroom-nijmegen.html?cat=5_FINGERFOOD', '2026-09-15'),
  ('buuv-0b01', 'Croissant', 350, 'EUR', 'https://www.buuvnijmegen.nl/wp-content/uploads/2026/03/Menukaart2026.maart_.website.pdf', '2026-09-15'),
  ('cafe-piet-huisman-14ca', 'Batatas fritas', 500, 'EUR', 'https://www.piethuisman.nl/menukaart/', '2026-09-15'),
  ('cafetaria-steenbok-af76', 'Croquete', 240, 'EUR', 'https://www.cafetariasteenbok.nl/order.php', '2026-09-15'),
  ('pimpelmees-06cd', 'Batatas fritas', 500, 'EUR', 'https://pimpelmees-nijmegen.nl/menukaart/', '2026-09-15'),
  ('hollywood-cafe-a1a3', 'Batatas fritas', 395, 'EUR', 'https://cdn.prod.website-files.com/67b4f0aaacf7cc3df4b5150d/68a85770d2bd3ddef0da5a97_Menukaart%20Rotterdam%202025.pdf', '2026-09-15'),
  ('malakka-d7c7', 'Batatas fritas', 395, 'EUR', 'https://malakka.nl/wp-content/uploads/2025/10/menukaart-2025-09-31.pdf', '2026-09-15'),
  ('aberdeen-angus-steak-house-29b2', 'Batatas fritas', 8500, 'CZK', 'https://www.angussteakhouse.cz/jidelni-listek', '2026-09-15'),
  ('caffe-diem-157b', 'Tosta mista', 16000, 'CZK', 'https://www.caffediem.cz/menu/', '2026-09-15'),
  ('na-spilce-19b9', 'Canja de galinha', 8500, 'CZK', 'https://www.naspilce.cz/jidelni-listek', '2026-09-15'),
  ('pivovarsk-enk-na-parkanu-4ddc', 'Sopa do dia', 5800, 'CZK', 'https://www.naparkanu.com/cz/', '2026-09-15'),
  ('trapizzino-ponte-milvio-57ae', 'Supplì (croquete de arroz)', 300, 'EUR', 'https://www.trapizzino.it/trapizzino/trapizzino-roma-ponte-milvio/', '2026-09-15'),
  ('cafe-pavillionen-2d07', 'Batatas fritas', 5500, 'DKK', 'https://www-static.pavillonbeergarden.dk/wp-content/uploads/Beer-Garden-menu.pdf', '2026-09-15'),
  ('kafe-kapers-f3ab', 'Sandes aberta de almôndega (smørrebrød)', 8500, 'DKK', 'https://kafekapers.dk/menu/', '2026-09-15'),
  ('le-saint-jacques-330d', 'Batatas fritas', 4500, 'DKK', 'https://www.lesaintjacques.dk/menukort', '2026-09-15'),
  ('meyers-post-63cb', 'Batatas fritas', 5500, 'DKK', 'https://meyers.dk/restauranter/post/', '2026-09-15'),
  ('sugo-d68e', 'Supplì (croquetes de arroz, 2 unid.)', 8000, 'DKK', 'https://restaurantsugo.dk/menu/', '2026-09-15'),
  ('antica-locanda-eafb', 'Sopa minestrone', 690, 'EUR', 'https://www.antica-locanda.at/speisekarte', '2026-09-15'),
  ('lehner-beerencafe-f22d', 'Sopa do dia', 620, 'EUR', 'https://lehners-beeren.at/wp-content/uploads/2026/04/2026_04_01_menukarte-beerencafe-online.pdf', '2026-09-15'),
  ('mundwerkstatt-d5b9', 'Sopa do dia com pão', 590, 'EUR', 'https://www.mundwerkstatt.at/mittagsmenue-3/', '2026-09-15'),
  ('kona-kai-e176', 'Batatas fritas', 450, 'GBP', 'https://www.konakai.co.uk/KonaKaiFoodMenu.pdf', '2026-09-15'),
  ('the-fox-and-pheasant-5f9a', 'Batatas fritas', 650, 'GBP', 'https://www.thefoxandpheasant.com/food-menu', '2026-09-15'),
  ('chirashi-sushi-d6f0', 'Hosomaki de salmão (4 peças)', 290, 'EUR', 'https://chirashi.pt/menu/', '2026-09-15'),
  ('tons-de-caffe-95de', 'Sopa de legumes', 340, 'EUR', 'https://www.tonsdecaffe.com/menu/', '2026-09-15'),
  ('noodles-massas-do-oriente-3f92', 'Crepe chinês de legumes', 255, 'EUR', 'https://cdn.website.dish.co/media/47/1d/10020277/Menu-1.pdf', '2026-09-15'),
  ('bom-dia-caffe-af67', 'Cachorro-quente', 590, 'EUR', 'https://bom-dia-caffe-pt.ola.click/products', '2026-09-15'),
  ('maresco-seafood-suchi-5738', 'Sopa (creme de legumes)', 400, 'EUR', 'https://maresco.bardapraia.com.pt/', '2026-09-15'),
  ('pizza-companhia-00f6', 'Sandes mista', 500, 'EUR', 'https://pizzaecompanhia.pt/menu-baguetes/', '2026-09-15'),
  ('sud-pizza-drinks-3b95', 'Pizza margherita (mini)', 600, 'EUR', 'https://sud.bardapraia.com.pt/', '2026-09-15'),
  ('casa-mia-0d7f', 'Bruschetta de legumes e provola fumado', 800, 'EUR', 'https://cdn.prod.website-files.com/63a1c44cd1dc6e5f2b116af6/6995973ba0e3d79c3328190e_09_JAN26_CASA_MIA_PRINCIPAL_PT.pdf', '2026-09-15'),
  ('taberna-22-1ad3', 'Prego no pão', 750, 'EUR', 'https://www.taberna22.com/wp-content/uploads/2025/06/tapas.jpg', '2026-09-15'),
  ('cervejaria-norte-bca3', 'Creme de legumes', 260, 'EUR', 'https://cdn.website.dish.co/media/26/43/10155761/Menu-PT.pdf', '2026-09-15'),
  ('campeoes-sports-and-bitcoin-cafe-3d1a', 'Sandes de presunto', 700, 'EUR', 'https://ugc.production.linktr.ee/415d61e0-83b7-4eb6-a7f9-1f7f8b6454c6_Star-Champions-Menu-2026.pdf', '2026-09-15'),
  ('acafrao-restaurante-d73c', 'Peixinhos da horta', 600, 'EUR', 'https://penadagua.com/wp-content/uploads/2026/08/Carta-Atrium-2026.pdf', '2026-09-15'),
  ('paco-100-pressa-8bb1', 'Pão de alho com queijo e bacon', 450, 'EUR', 'https://irp.cdn-website.com/59efb1f0/files/uploaded/Menu+Italiano+2026+final.pdf', '2026-09-15')
) as v (place_id, name, price_cents, currency, source_url, checked_on)
join public.place as p on p.id = v.place_id
on conflict do nothing;
