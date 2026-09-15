-- Fans' photos of tascos, moderated. Fans could already send photos (pending, private bucket); nobody could approve
-- them. Admins now see pending photos and approve or reject them; approved photos show on the tasco for everyone.
-- The photographer is never shown (the app says "Foto de um adepto").

create policy "admins read every place photo"
  on public.place_photo for select to authenticated
  using ((select public.is_admin()));

create policy "admins read every place photo file"
  on storage.objects for select to authenticated
  using (bucket_id = 'place-photos' and (select public.is_admin()));

alter table public.place_photo
  add column moderated_at timestamptz,
  add column moderated_by uuid references public.profile (id) on delete set null;

create function public.moderate_place_photo(p_photo_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.place_photo
  set
    status = case when p_approve then 'approved' else 'rejected' end,
    moderated_at = now(),
    moderated_by = auth.uid()
  where id = p_photo_id and status = 'pending';
  if not found then
    raise exception 'photo_not_pending' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.moderate_place_photo(uuid, boolean) from public, anon;
grant execute on function public.moderate_place_photo(uuid, boolean) to authenticated;
