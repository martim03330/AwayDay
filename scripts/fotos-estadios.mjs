// Stadium photos from Wikimedia Commons, through Wikidata (the stadium's "image" property, P18). Only freely licensed
// files (CC0, CC BY, CC BY-SA, public domain) are used, always with author, licence and a link to the file page.
// Downloads a 1280 px copy of each photo into a folder, for `supabase storage cp` to the public venue-photos bucket,
// and writes the SQL that stores the photo address and credits on public.venue.
//
// Usage:
//   npm run --silent db:fotos -- <output folder> [venue ids...] > /tmp/fotos.sql
//   supabase storage cp -r <output folder> ss:///venue-photos --linked --content-type image/jpeg
//   supabase db query --linked -f /tmp/fotos.sql
//
// This runs on a developer machine; the app only loads the copies from Supabase Storage.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const USER_AGENT = 'AwayDay/0.1 (stadium photos with credits; developer import)';
const WIDTH = 1280;
const PAUSE_MS = 1500;
/** Wikidata classes that mean "this is a stadium" (stadium, football venue, sports venue, arena). */
const STADIUM_CLASSES = new Set(['Q483110', 'Q1154710', 'Q1076486', 'Q641226', 'Q2338524']);
const FREE_LICENCE = /^(cc0|cc by(-sa)? [0-9.]+|public domain|pd)/i;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).');
  process.exit(1);
}

const [outputFolder, ...ids] = process.argv.slice(2);
if (!outputFolder) {
  console.error('Uso: npm run --silent db:fotos -- <pasta> [ids...] > fotos.sql');
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

async function json(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.ok) return await response.json();
    } catch {
      // Retry below.
    }
    await sleep(PAUSE_MS * (attempt + 1));
  }
  return null;
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

/** The Wikidata item for a stadium: first search result that is a stadium and has an image. */
async function stadiumItem(venue) {
  for (const [search, language] of [
    [venue.name, 'pt'],
    [`${venue.name} ${venue.city}`, 'pt'],
    [venue.name, 'en'],
  ]) {
    const found = await json(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&limit=5&language=${language}&search=${encodeURIComponent(search)}`
    );
    const candidates = (found?.search ?? []).map((result) => result.id);
    if (candidates.length === 0) continue;
    const entities = await json(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${candidates.join('|')}`
    );
    for (const id of candidates) {
      const claims = entities?.entities?.[id]?.claims ?? {};
      const classes = (claims.P31 ?? []).map((claim) => claim.mainsnak?.datavalue?.value?.id);
      const image = claims.P18?.[0]?.mainsnak?.datavalue?.value;
      if (image && classes.some((cls) => STADIUM_CLASSES.has(cls))) return { id, image };
    }
    await sleep(PAUSE_MS);
  }
  return null;
}

const venueResponse = await fetch(`${SUPABASE_URL}/rest/v1/venue?select=id,name,city,country&order=id`, {
  headers: { apikey: SUPABASE_KEY },
});
const venues = (await venueResponse.json()).filter((venue) => wantedIds.size === 0 || wantedIds.has(venue.id));

const updates = [];
for (const venue of venues) {
  const item = await stadiumItem(venue);
  if (!item) {
    console.error(`${venue.id}: sem foto na Wikidata`);
    continue;
  }
  const info = await json(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${WIDTH}&titles=${encodeURIComponent(`File:${item.image}`)}`
  );
  const page = Object.values(info?.query?.pages ?? {})[0];
  const imageinfo = page?.imageinfo?.[0];
  const licence = plain(imageinfo?.extmetadata?.LicenseShortName?.value);
  const author = plain(imageinfo?.extmetadata?.Artist?.value).slice(0, 200) || 'Autor desconhecido';
  if (!imageinfo?.thumburl || !FREE_LICENCE.test(licence)) {
    console.error(`${venue.id}: licença não livre ou sem imagem (${licence || 'sem licença'})`);
    continue;
  }

  const image = await fetch(imageinfo.thumburl, { headers: { 'User-Agent': USER_AGENT } });
  if (!image.ok || !(image.headers.get('content-type') ?? '').includes('jpeg')) {
    console.error(`${venue.id}: não foi possível descarregar (${image.status}, ${image.headers.get('content-type')})`);
    continue;
  }
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024) {
    console.error(`${venue.id}: foto demasiado grande (${bytes.length} bytes)`);
    continue;
  }
  await writeFile(join(outputFolder, `${venue.id}.jpg`), bytes);
  updates.push(
    `update public.venue set photo_url = ${literal(`${SUPABASE_URL}/storage/v1/object/public/venue-photos/${venue.id}.jpg`)}, ` +
      `photo_author = ${literal(author)}, photo_license = ${literal(licence.slice(0, 60))}, ` +
      `photo_source_url = ${literal(imageinfo.descriptionurl)} where id = ${literal(venue.id)};`
  );
  console.error(`${venue.id}: ${item.id} · ${licence} · ${author}`);
  await sleep(PAUSE_MS);
}

process.stdout.write(
  `-- Generated by scripts/fotos-estadios.mjs. Photos from Wikimedia Commons (free licences, credited).\n${updates.join('\n')}\n`
);
console.error(`${updates.length} fotos de ${venues.length} estádios.`);
