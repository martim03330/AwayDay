// Photos of tascos from Wikimedia Commons. Only freely licensed files (CC0, CC BY, CC BY-SA, public domain), always
// with author, licence and a link to the file page. A file counts when Commons places it within 150 m of the tasco,
// or, without coordinates, when its title carries the tasco's name. Every photo must still be checked by eye before
// it is uploaded: the script only gathers candidates.
//
// Usage:
//   npm run --silent db:fotos-tascos -- <output folder> [place ids...] > /tmp/fotos-tascos.sql   (report on stderr)
//   (look at every photo in the folder; delete the wrong ones and their lines in the SQL)
//   for f in <output folder>/*.jpg; do
//     supabase storage cp "$f" "ss:///tasco-photos/$(basename "$f")" --linked --experimental --content-type image/jpeg
//   done
//   supabase db query --linked -f /tmp/fotos-tascos.sql
// Without ids: every place with match-day research (matchday_note).
//
// This runs on a developer machine; the app only loads the copies from Supabase Storage.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const USER_AGENT = 'AwayDay/0.1 (tasco photos with credits; developer import)';
const WIDTH = 800;
const PAUSE_MS = 1500;
const MAX_DISTANCE_M = 150;
const MAX_BYTES = 1024 * 1024;
const FREE_LICENCE = /^(cc0|cc by(-sa)? [0-9.]+|public domain|pd)/i;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).'
  );
  process.exit(1);
}

const [outputFolder, ...ids] = process.argv.slice(2);
if (!outputFolder) {
  console.error('Uso: npm run --silent db:fotos-tascos -- <pasta> [ids...] > fotos-tascos.sql');
  process.exit(1);
}
const wantedIds = new Set(ids);
await mkdir(outputFolder, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function literal(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.sqrt(h)));
}

function normalise(text) {
  return String(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(cafe|restaurante|snack|bar|pub|tasca|o|a|os|as|do|da|dos|das|de|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plain(html) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function json(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.ok) return await response.json();
    } catch {
      // Retry below.
    }
    await sleep(PAUSE_MS * (attempt + 2));
  }
  return null;
}

async function rest(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY },
  });
  if (!response.ok) throw new Error(`REST ${path}: ${response.status}`);
  return response.json();
}

const cities = new Map((await rest('venue?select=id,city')).map((venue) => [venue.id, venue.city]));
const places = (
  await rest(
    wantedIds.size > 0
      ? `place?select=id,name,venue_id,latitude,longitude&id=in.(${[...wantedIds].join(',')})`
      : 'place?select=id,name,venue_id,latitude,longitude&matchday_note=not.is.null'
  )
).filter((place) => place.latitude !== null && place.longitude !== null);

const updates = [];
for (const place of places) {
  const name = normalise(place.name);
  const search = await json(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`${place.name} ${cities.get(place.venue_id) ?? ''}`)}`
  );
  await sleep(PAUSE_MS);
  const titles = (search?.query?.search ?? [])
    .map((result) => result.title)
    .filter((title) => /\.(jpe?g)$/i.test(title));
  if (titles.length === 0) {
    console.error(`${place.id}: sem fotos no Commons`);
    continue;
  }

  const info = await json(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo|coordinates&iiprop=url|extmetadata&iiurlwidth=${WIDTH}&titles=${encodeURIComponent(titles.join('|'))}`
  );
  await sleep(PAUSE_MS);
  const chosen = Object.values(info?.query?.pages ?? {})
    .map((page) => {
      const imageinfo = page.imageinfo?.[0];
      const point = page.coordinates?.[0];
      const distance = point
        ? distanceMeters(place, { latitude: point.lat, longitude: point.lon })
        : null;
      return {
        title: page.title,
        imageinfo,
        distance,
        licence: plain(imageinfo?.extmetadata?.LicenseShortName?.value),
        namedAfter: name.length >= 4 && normalise(page.title).includes(name),
      };
    })
    .filter(
      (candidate) =>
        candidate.imageinfo?.thumburl &&
        FREE_LICENCE.test(candidate.licence) &&
        (candidate.distance === null
          ? candidate.namedAfter
          : candidate.distance <= MAX_DISTANCE_M && candidate.namedAfter)
    )
    .sort((a, b) => (a.distance ?? MAX_DISTANCE_M) - (b.distance ?? MAX_DISTANCE_M))[0];
  if (!chosen) {
    console.error(`${place.id}: nenhuma foto livre com o nome e no sítio certo`);
    continue;
  }

  const image = await fetch(chosen.imageinfo.thumburl, { headers: { 'User-Agent': USER_AGENT } });
  const bytes = Buffer.from(await image.arrayBuffer());
  if (
    !image.ok ||
    !(image.headers.get('content-type') ?? '').includes('jpeg') ||
    bytes.length > MAX_BYTES
  ) {
    console.error(`${place.id}: não foi possível descarregar ${chosen.title}`);
    continue;
  }
  await writeFile(join(outputFolder, `${place.id}.jpg`), bytes);
  const author =
    plain(chosen.imageinfo.extmetadata?.Artist?.value).slice(0, 200) || 'Autor desconhecido';
  updates.push(
    `update public.place set photo_url = ${literal(`${SUPABASE_URL}/storage/v1/object/public/tasco-photos/${place.id}.jpg`)}, ` +
      `photo_author = ${literal(author)}, photo_license = ${literal(chosen.licence.slice(0, 60))}, ` +
      `photo_source_url = ${literal(chosen.imageinfo.descriptionurl)} where id = ${literal(place.id)};`
  );
  console.error(
    `${place.id}: ${chosen.title} · ${chosen.licence} · ${author}${chosen.distance === null ? '' : ` · ${chosen.distance} m`}`
  );
  await sleep(PAUSE_MS);
}

console.log(
  '-- Generated by scripts/fotos-tascos.mjs. Photos from Wikimedia Commons (free licences, credited).'
);
console.log(updates.length > 0 ? updates.join('\n') : 'select 1;');
console.error(`${updates.length} fotos de ${places.length} tascos.`);
