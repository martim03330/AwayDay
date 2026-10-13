-- Two changes to how a ride's cost is set (testers' request, 2026-10-13):
--
-- 1. Electric cars. An electric ride shares only the tolls: charging is the driver's (often at home or free), and a
--    price per kWh would be guesswork. Its consumption and fuel price stay empty; the cost is still worked out by the
--    rides Edge Function, never taken from the app.
-- 2. The price per litre comes from DGEG (Direção-Geral de Energia e Geologia), the daily national average of the
--    stations' prices, instead of a number typed into the app. The rides Edge Function fetches it at most every few
--    hours and keeps it here; the app reads it as the starting value (the driver can still change it).

alter table public.ride
  add column energy text not null default 'combustivel' check (energy in ('combustivel', 'eletrico'));
alter table public.ride alter column consumption_cl_per_100km drop not null;
alter table public.ride alter column fuel_price_milli_per_litre drop not null;
alter table public.ride add constraint ride_energy_inputs check (
  (energy = 'combustivel' and consumption_cl_per_100km is not null and fuel_price_milli_per_litre is not null)
  or (energy = 'eletrico' and consumption_cl_per_100km is null and fuel_price_milli_per_litre is null and fuel_cents = 0)
);

create table public.fuel_price (
  fuel text primary key check (fuel in ('gasolina', 'gasoleo')),
  /** National daily average, thousandths of a euro per litre (2,110 €/L = 2110). */
  milli_per_litre integer not null check (milli_per_litre between 500 and 4000),
  /** The day the average is for (DGEG publishes each day's the day after). */
  price_date date not null,
  source_url text not null check (source_url ~ '^https://'),
  updated_at timestamptz not null default now()
);

alter table public.fuel_price enable row level security;
revoke all on public.fuel_price from anon, authenticated;
grant select on public.fuel_price to authenticated;
-- Everyone signed in reads the averages; only the Edge Function (service role) writes them.
create policy "fuel prices are readable by signed-in fans"
  on public.fuel_price for select to authenticated using (true);
