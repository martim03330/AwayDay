-- A photo of each tasco (outside or inside), so a fan choosing where to go sees at a glance whether it is a pub, a café
-- or a tasca. Only freely licensed photos (Wikimedia Commons: CC0, CC BY, CC BY-SA, public domain), checked by eye to
-- be the right place, copied to a public bucket and always shown with author, licence and a link to the original.
-- Fans' own photos keep their moderated flow (place_photo).

alter table public.place
  add column photo_url text check (photo_url ~ '^https://'),
  add column photo_author text check (char_length(photo_author) <= 200),
  add column photo_license text check (char_length(photo_license) <= 60),
  add column photo_source_url text check (photo_source_url ~ '^https://'),
  add constraint place_photo_credited
    check (photo_url is null or (photo_license is not null and photo_source_url is not null));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tasco-photos', 'tasco-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;
