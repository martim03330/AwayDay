// Imports the web research on where fans go before games (JSON files, one per group of stadiums) into public.place.
// Each researched place keeps why fans go there and the pages that say so (matchday_note, matchday_sources).
//
// For each place, in order:
// 1. a place we already list near that stadium with the same name gets the note and sources;
// 2. otherwise the place is looked up by name in OpenStreetMap (through Nominatim) near the stadium and added;
// 3. otherwise its address is geocoded with Nominatim and it is added as a manual place.
// Places not found, or more than 2.5 km from the stadium, are only reported. Nothing is guessed.
// Only high and medium confidence are imported (and confirm the place). Low confidence means no source ties the place
// to match days (e.g. a generic restaurant list), which is exactly what the OSM suggestions already are.
//
// Usage:
//   npm run --silent db:pesquisa-tascos -- <file.json> [more.json...] > /tmp/pesquisa.sql   (report on stderr)
//   supabase db query --linked -f /tmp/pesquisa.sql
//
// Data © OpenStreetMap contributors (ODbL). This runs on a developer machine.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AwayDay/0.1 (match-day places research import; developer machine)';
const MAX_DISTANCE_M = 2500;
const DETOUR_FACTOR = 1.3;
const WALKING_M_PER_MIN = 80;
const PAUSE_MS = 1500;
const KINDS = {
  tasca: 'tasca',
  cafe: 'cafe',
  bar: 'bar',
  pub: 'bar',
  restaurante: 'restaurante',
  roulote: 'roulotte',
  roulotte: 'roulotte',
};
/** Quick and cheap, as the OSM import decides: cafés, snack bars, tascas and bars. */
const QUICK_AND_CHEAP = new Set(['tasca', 'cafe', 'bar', 'roulotte']);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).'
  );
  process.exit(1);
}
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Uso: npm run --silent db:pesquisa-tascos -- <ficheiro.json> [...] > pesquisa.sql');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

/** "Café O Zé, Lda." and "cafe o ze" compare equal. */
function normalise(name) {
  return String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(
      /\b(cafe|restaurante|snack|bar|pub|tasca|taberna|cervejaria|o|a|os|as|do|da|dos|das|de|the|lda)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function sameName(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 5 && y.includes(x)) || (y.length >= 5 && x.includes(y));
}

function literal(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function slug(name, venueId) {
  const base = String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const suffix = createHash('md5').update(`${venueId}:${name}`).digest('hex').slice(0, 4);
  return `${base || 'tasco'}-${suffix}`;
}

async function getJson(url, init) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...init?.headers },
      });
      const text = await response.text();
      if (response.ok && /^\s*[[{]/.test(text)) return JSON.parse(text);
    } catch {
      // Retry below.
    }
    await sleep(PAUSE_MS * (attempt + 2));
  }
  return null;
}

async function rest(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Range: `${from}-${from + 999}` },
    });
    if (!response.ok) throw new Error(`REST ${path}: ${response.status}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

/** The nearest OSM place with this name near the stadium, found by name through Nominatim (much lighter than Overpass). */
async function findInOsm(place, venue) {
  const delta = 0.03;
  const params = new URLSearchParams({
    q: place.name,
    format: 'jsonv2',
    limit: '10',
    viewbox: `${venue.longitude - delta},${venue.latitude + delta},${venue.longitude + delta},${venue.latitude - delta}`,
    bounded: '1',
  });
  const results = await getJson(`${NOMINATIM}?${params}`);
  await sleep(1100);
  const candidates = (results ?? [])
    .filter(
      (result) =>
        ['amenity', 'shop', 'tourism', 'leisure'].includes(result.category) &&
        ['node', 'way', 'relation'].includes(result.osm_type) &&
        sameName(result.name ?? '', place.name)
    )
    .map((result) => ({
      osmId: `${result.osm_type}/${result.osm_id}`,
      name: result.name,
      latitude: Number(result.lat),
      longitude: Number(result.lon),
    }))
    .map((candidate) => ({ ...candidate, distance: distanceMeters(venue, candidate) }))
    .sort((x, y) => x.distance - y.distance);
  return candidates[0] ?? null;
}

/**
 * Nominatim results precise enough for a pin: a building, a house number or the place itself. A street or a
 * neighbourhood would put every place on that street on the same spot, so those do not count.
 */
const PRECISE_TYPES = new Set(['building', 'house', 'amenity', 'shop', 'tourism', 'leisure']);

/** The address, geocoded near the stadium, only when Nominatim finds the building itself. */
async function geocode(place, venue) {
  if (!place.address) return null;
  const delta = 0.05;
  const params = new URLSearchParams({
    q: place.address,
    format: 'jsonv2',
    limit: '3',
    viewbox: `${venue.longitude - delta},${venue.latitude + delta},${venue.longitude + delta},${venue.latitude - delta}`,
    bounded: '1',
  });
  const results = await getJson(`${NOMINATIM}?${params}`);
  await sleep(1100);
  const best = (results ?? [])
    .filter(
      (result) =>
        PRECISE_TYPES.has(result.addresstype) ||
        PRECISE_TYPES.has(result.category) ||
        result.type === 'house'
    )
    .map((result) => ({ latitude: Number(result.lat), longitude: Number(result.lon) }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .map((point) => ({ ...point, distance: distanceMeters(venue, point) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return best ?? null;
}

function cleanSources(sources) {
  return (Array.isArray(sources) ? sources : [])
    .filter((source) => typeof source?.url === 'string' && source.url.startsWith('https://'))
    .map((source) => ({
      url: source.url,
      title: String(source.title ?? '').slice(0, 160) || source.url,
      published: source.published ?? null,
    }));
}

const venues = new Map(
  (await rest('venue?select=id,name,latitude,longitude')).map((venue) => [venue.id, venue])
);
const places = await rest('place?select=id,name,venue_id,osm_id,confirmation');

const statements = [];
const report = { updated: 0, added: 0, missing: [] };

for (const file of files) {
  const groups = JSON.parse(await readFile(file, 'utf8'));
  for (const group of groups) {
    const venue = venues.get(group.venue_id);
    if (!venue) {
      console.error(`${group.venue_id}: estádio desconhecido`);
      continue;
    }
    for (const place of group.places ?? []) {
      const sources = cleanSources(place.sources);
      const note = String(place.why_pt ?? '')
        .trim()
        .slice(0, 240);
      if (sources.length === 0 || !note) {
        report.missing.push(`${venue.id} · ${place.name}: sem fontes ou sem razão`);
        continue;
      }
      if (place.confidence !== 'high' && place.confidence !== 'medium') {
        report.missing.push(`${venue.id} · ${place.name}: confiança baixa, não importado`);
        continue;
      }
      const homeFans = typeof place.home_fans_heavy === 'boolean' ? place.home_fans_heavy : null;
      const columns =
        `matchday_note = ${literal(note)}, ` +
        `matchday_sources = ${literal(JSON.stringify(sources))}::jsonb, ` +
        `home_fans_heavy = ${literal(homeFans)}`;

      const existing = places.find(
        (candidate) => candidate.venue_id === venue.id && sameName(candidate.name, place.name)
      );
      if (existing) {
        statements.push(
          `update public.place set ${columns}` +
            `, confirmation = 'confirmed'` +
            ` where id = ${literal(existing.id)} and confirmation <> 'rejected';`
        );
        report.updated += 1;
        console.error(`${venue.id} · ${place.name}: já listado (${existing.name})`);
        continue;
      }

      const osm = await findInOsm(place, venue);
      const point = osm ?? (await geocode(place, venue));
      if (!point || point.distance > MAX_DISTANCE_M) {
        report.missing.push(
          `${venue.id} · ${place.name}: ${point ? `a ${point.distance} m do estádio` : 'não encontrado no mapa'}`
        );
        continue;
      }
      const kind = KINDS[place.kind] ?? 'restaurante';
      const walking = Math.min(
        Math.round((point.distance * DETOUR_FACTOR) / WALKING_M_PER_MIN),
        120
      );
      const id = slug(place.name, venue.id);
      statements.push(
        `insert into public.place (id, venue_id, name, name_article, kind, distance_m, walking_minutes, location, source, osm_id, attribution, confirmation, quick_and_cheap, suitability, matchday_note, matchday_sources, home_fans_heavy)\n` +
          `values (${literal(id)}, ${literal(venue.id)}, ${literal(osm?.name || place.name)}, '', ${literal(kind)}, ${point.distance}, ${walking}, ` +
          `extensions.st_setsrid(extensions.st_makepoint(${point.longitude}, ${point.latitude}), 4326)::extensions.geography, ` +
          `${literal(osm ? 'osm' : 'manual')}, ${literal(osm?.osmId ?? null)}, ` +
          `${literal(osm ? '© contribuidores do OpenStreetMap' : 'Localização: © contribuidores do OpenStreetMap (Nominatim)')}, ` +
          `'confirmed', ${QUICK_AND_CHEAP.has(kind)}, 3, ` +
          `${literal(note)}, ${literal(JSON.stringify(sources))}::jsonb, ${literal(homeFans)})\n` +
          `on conflict do nothing;`
      );
      places.push({ id, name: place.name, venue_id: venue.id, osm_id: osm?.osmId ?? null });
      report.added += 1;
      console.error(
        `${venue.id} · ${place.name}: novo (${osm ? `OSM ${osm.osmId}` : 'morada'}, ${point.distance} m)`
      );
    }
  }
}

console.log(
  '-- Generated by scripts/importar-pesquisa-tascos.mjs from the match-day places research.'
);
console.log(statements.length > 0 ? statements.join('\n') : 'select 1;');
console.error(
  `\n${report.updated} já listados com fontes, ${report.added} novos, ${report.missing.length} por encontrar:`
);
for (const line of report.missing) console.error(`  - ${line}`);
