-- The A1 and A2 rates measured in the router's kilometres, as the national rate always was (20260916150000_rides):
-- tollCents charges the tolled metres Valhalla gives, and Valhalla measures these motorways longer than the official
-- tariff tables do (A1 Lisboa–Porto 287,8 km for 277,7; A2 Lisboa–Paderne 241,1 km for 225,2). With the official km,
-- a Porto → Lisboa trip came out 11 % above the real 25,05 €; checked on 26 trips to stadiums on 2026-10-13.
update public.toll_rate
set reference_m = 287800,
    reference_trip = 'A1 Lisboa–Porto, classe 1, 2026 (287,8 km medidos no Valhalla)'
where motorway = 'A1';
update public.toll_rate
set reference_m = 241100,
    reference_trip = 'A2 Lisboa–Paderne, classe 1, 2026 (241,1 km medidos no Valhalla)'
where motorway = 'A2';
