-- The price of each motorway, class 1, 2026, instead of one national rate for every tolled kilometre. With it, the
-- ride quote can tell a cheaper road (part of the way on a motorway, the rest on free roads) from the fastest one.
--
-- Sources, checked on 2026-10-13:
-- - IMT, «Taxas de portagem 2026» (every section with its tolled km: Brisa, Oeste, Brisal, A21, Douro Litoral);
-- - Infraestruturas de Portugal, toll calculator (ex-SCUT and IP motorways, km measured along the route; less exact).
-- Each rate is the price of a long stretch over its tolled metres; tollCents (supabase/functions/_shared/ride-cost.ts)
-- charges every tolled metre of a route at its motorway's rate, a branch (A13-1) at its own or its main road's, and
-- anything else (unnamed toll roads, motorways not listed) at "default". It stays an estimate: Brisa prices each
-- entry–exit pair, and the two Tejo bridges charge a fixed fee in one direction only.
--
-- Free since 1 January 2025 (Lei 37/2024) or never tolled for cars: A22, A23, A24, A25, A27, A44, and the A13 between
-- Coimbra and Atalaia (A13-1 too). The router usually knows they are free; if OpenStreetMap still tags a stretch as a
-- toll road, it costs 0 here rather than the national rate. The A13 south of Almeirim (to Marateca) is tolled.

alter table public.toll_rate drop constraint toll_rate_reference_cents_check;
alter table public.toll_rate add constraint toll_rate_reference_cents_check check (reference_cents >= 0);

insert into public.toll_rate (motorway, reference_trip, reference_cents, reference_m, source_url, checked_on)
values
  ('A1', 'A1 Alverca–Carvalhos, classe 1, 2026', 2505, 277700, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A2', 'A2 Fogueteiro–Paderne, classe 1, 2026', 2380, 225200, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A3', 'A3 Maia–Valença, classe 1, 2026', 1020, 98100, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A4', 'A4 Ermesinde–Amarante, classe 1, 2026', 475, 48300, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A5', 'A5 Estádio Nacional–Cascais, classe 1, 2026', 250, 23800, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A6', 'A6 A2/A6/A13–Elvas, classe 1, 2026', 1515, 138800, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A7', 'A7 Póvoa de Varzim–Vila Pouca de Aguiar, classe 1, 2026', 895, 82000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A8', 'A8 CREL–Leiria Sul, classe 1, 2026', 1090, 103100, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A9', 'A9 CREL Estádio Nacional–Alverca, classe 1, 2026', 375, 34400, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A10', 'A10 A9–A13, classe 1, 2026', 430, 39800, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A11', 'A11 Apúlia–Castelões, classe 1, 2026', 735, 66000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A12', 'A12 Montijo–Setúbal, classe 1, 2026', 245, 24800, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A13', 'A13 Marateca–Almeirim, classe 1, 2026 (Coimbra–Atalaia sem portagem desde 2025)', 840, 78700, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A13-1', 'A13-1, sem portagem desde 1 de janeiro de 2025', 0, 1000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A14', 'A14 Figueira da Foz–Coimbra Norte, classe 1, 2026', 290, 26800, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A15', 'A15 Óbidos–A1, classe 1, 2026', 430, 40200, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A16', 'A16 Cascais–Loures, classe 1, 2026', 295, 28000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A17', 'A17 A8–Mira, classe 1, 2026', 1000, 92700, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A19', 'A19 Leiria, classe 1, 2026', 145, 16000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A21', 'A21 Ericeira–Venda do Pinheiro, classe 1, 2026', 220, 20700, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A22', 'A22 Lagos–Vila Real de Santo António, sem portagem desde 1 de janeiro de 2025', 0, 1000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A23', 'A23, sem portagem desde 1 de janeiro de 2025', 0, 1000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A24', 'A24, sem portagem desde 1 de janeiro de 2025', 0, 1000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A25', 'A25, sem portagem desde 1 de janeiro de 2025', 0, 1000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A27', 'A27 Viana do Castelo–Ponte de Lima, sem portagem', 0, 1000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A28', 'A28 Porto–Caminha, classe 1, 2026 (poucos pórticos)', 135, 87000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A32', 'A32 Oliveira de Azeméis–A1, classe 1, 2026', 345, 32600, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A33', 'A33 Almada–Montijo, classe 1, 2026', 195, 31000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13'),
  ('A41', 'A41 Picoto–Ermida, classe 1, 2026', 345, 32800, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A43', 'A43 Gondomar–A41, classe 1, 2026', 85, 7900, 'https://www.imt-ip.pt/rodoviario/infraestruturas-rodoviarias/rede-rodoviaria/taxas-de-portagem/', '2026-10-13'),
  ('A44', 'A44 Gaia, sem portagem', 0, 1000, 'https://portagens.infraestruturasdeportugal.pt/', '2026-10-13')
on conflict (motorway) do update set
  reference_trip = excluded.reference_trip,
  reference_cents = excluded.reference_cents,
  reference_m = excluded.reference_m,
  source_url = excluded.source_url,
  checked_on = excluded.checked_on;
