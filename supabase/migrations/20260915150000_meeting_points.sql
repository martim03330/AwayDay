-- Official meeting points for travelling fans (e.g. Benfica fans in Milan). Published by clubs, the city or the
-- police for one fixture; entered by hand for now, always with the source. Public reference data, read-only.
create table public.fixture_meeting_point (
  fixture_id text primary key references public.fixture (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  address text not null check (char_length(address) between 2 and 200),
  schedule text not null check (char_length(schedule) between 2 and 300),
  transport text not null check (char_length(transport) between 2 and 500),
  note text check (char_length(note) <= 800),
  origin text not null check (origin in ('clube', 'camara', 'policia')),
  published_by text not null check (char_length(published_by) between 2 and 80),
  source_title text not null check (char_length(source_title) between 2 and 160),
  source_url text not null check (source_url ~ '^https://'),
  published_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger fixture_meeting_point_set_updated_at
  before update on public.fixture_meeting_point
  for each row execute function public.set_updated_at();

alter table public.fixture_meeting_point enable row level security;

create policy "meeting points are readable by everyone"
  on public.fixture_meeting_point for select to anon, authenticated using (true);

revoke all on public.fixture_meeting_point from anon, authenticated;
grant select on public.fixture_meeting_point to anon, authenticated;
