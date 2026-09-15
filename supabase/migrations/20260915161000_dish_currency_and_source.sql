-- Dishes abroad are priced in the local currency (pounds in Liverpool, kroner in Copenhagen), and dishes added from a
-- place's own menu keep where and when the price was checked.
-- - price_cents keeps its name but is now in minor units of `currency` (pence, øre, fillér...). Always an integer.
-- - Fans' suggestions cannot set these columns (the insert grant is per column): they stay in euros, without a source.

alter table public.dish
  add column currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  add column source_url text check (source_url ~ '^https://'),
  add column checked_on date,
  add constraint dish_source_has_date check ((source_url is null) = (checked_on is null));

comment on column public.dish.price_cents is 'Price in minor units of `currency` (cents, pence, øre, fillér).';
