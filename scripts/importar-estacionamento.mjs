// Imports the match-day parking research (JSON files, one per group of stadiums) into public.parking_spot and
// public.venue_parking. Every car park and warning keeps the pages that say so.
//
// - Only high and medium confidence car parks are imported; low confidence (a vague guide, an old forum post) is
//   reported and left out.
// - A car park gets a location only when Nominatim finds the car park itself or the building at its address; a street
//   alone would put the pin in the wrong place, so those stay without a map pin (the address is still shown).
// - Re-running replaces what a stadium had: the research is the source of truth for these rows.
//
// Usage:
//   npm run --silent db:estacionamento -- <file.json> [more.json...] > /tmp/estacionamento.sql   (report on stderr)
//   supabase db query --linked -f /tmp/estacionamento.sql
//
// Locations: © OpenStreetMap contributors (Nominatim). This runs on a developer machine.
import { readFile } from 'node:fs/promises';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AwayDay/0.1 (match-day parking research import; developer machine)';
const MAX_DISTANCE_M = 3000;
const KINDS = new Set([
  'parque_oficial',
  'parque_publico',
  'parque_gratuito',
  'rua',
  'park_and_ride',
]);
const PRECISE = new Set(['parking', 'building', 'house', 'amenity']);
const CHECKED_ON = new Date().toISOString().slice(0, 10);

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
  console.error(
    'Uso: npm run --silent db:estacionamento -- <ficheiro.json> [...] > estacionamento.sql'
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function literal(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
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

function cleanSources(sources) {
  return (Array.isArray(sources) ? sources : [])
    .filter((source) => typeof source?.url === 'string' && source.url.startsWith('https://'))
    .map((source) => ({
      url: source.url,
      title: String(source.title ?? '').slice(0, 160) || source.url,
      published: source.published ?? null,
    }));
}

function clip(text, max) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) return null;
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

async function geocode(query, venue) {
  const delta = 0.04;
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    viewbox: `${venue.longitude - delta},${venue.latitude + delta},${venue.longitude + delta},${venue.latitude - delta}`,
    bounded: '1',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${NOMINATIM}?${params}`, {
        headers: { 'User-Agent': USER_AGENT },
      });
      await sleep(1100);
      if (!response.ok) continue;
      const results = await response.json();
      const best = results
        .filter(
          (result) =>
            (result.category === 'amenity' && result.type === 'parking') ||
            PRECISE.has(result.addresstype) ||
            result.type === 'house'
        )
        .map((result) => ({ latitude: Number(result.lat), longitude: Number(result.lon) }))
        .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
        .map((point) => ({ ...point, distance: distanceMeters(venue, point) }))
        .filter((point) => point.distance <= MAX_DISTANCE_M)
        .sort((a, b) => a.distance - b.distance)[0];
      return best ?? null;
    } catch {
      await sleep(2000);
    }
  }
  return null;
}

const venueResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/venue?select=id,name,city,latitude,longitude`,
  {
    headers: { apikey: SUPABASE_KEY },
  }
);
const venues = new Map((await venueResponse.json()).map((venue) => [venue.id, venue]));

const statements = [];
const report = { spots: 0, withPin: 0, skipped: [] };

for (const file of files) {
  for (const group of JSON.parse(await readFile(file, 'utf8'))) {
    const venue = venues.get(group.venue_id);
    if (!venue) {
      console.error(`${group.venue_id}: estádio desconhecido`);
      continue;
    }

    const summarySources = cleanSources(group.summary_sources);
    const summary = summarySources.length > 0 ? clip(group.summary_pt, 400) : null;
    const warnings = (Array.isArray(group.warnings) ? group.warnings : []).flatMap((warning) => {
      const sources = cleanSources(warning.sources);
      const text = clip(warning.text_pt, 280);
      return text && sources.length > 0 ? [{ text, sources }] : [];
    });
    statements.push(
      `delete from public.parking_spot where venue_id = ${literal(venue.id)};`,
      `insert into public.venue_parking (venue_id, summary, summary_sources, warnings, checked_on) values (` +
        `${literal(venue.id)}, ${literal(summary)}, ${literal(JSON.stringify(summary ? summarySources : []))}::jsonb, ` +
        `${literal(JSON.stringify(warnings))}::jsonb, ${literal(CHECKED_ON)}) ` +
        `on conflict (venue_id) do update set summary = excluded.summary, summary_sources = excluded.summary_sources, ` +
        `warnings = excluded.warnings, checked_on = excluded.checked_on;`
    );

    const names = new Set();
    for (const spot of group.places ?? []) {
      const sources = cleanSources(spot.sources);
      const name = clip(spot.name, 120);
      if (!name || names.has(name) || sources.length === 0 || !KINDS.has(spot.kind)) {
        report.skipped.push(`${venue.id} · ${spot.name}: sem nome, tipo ou fontes válidos`);
        continue;
      }
      if (spot.confidence !== 'high' && spot.confidence !== 'medium') {
        report.skipped.push(`${venue.id} · ${name}: confiança baixa, não importado`);
        continue;
      }
      names.add(name);
      const point =
        (await geocode(`${name}, ${venue.city}`, venue)) ??
        (spot.address ? await geocode(spot.address, venue) : null);
      statements.push(
        `insert into public.parking_spot (venue_id, name, kind, address, operator, location, distance_m, open_on_matchdays, price_note, note, sources, confidence, checked_on) values (` +
          `${literal(venue.id)}, ${literal(name)}, ${literal(spot.kind)}, ${literal(clip(spot.address, 200))}, ${literal(clip(spot.operator, 80))}, ` +
          `${point ? `extensions.st_setsrid(extensions.st_makepoint(${point.longitude}, ${point.latitude}), 4326)::extensions.geography` : 'null'}, ` +
          `${point ? point.distance : 'null'}, ${literal(typeof spot.open_on_matchdays === 'boolean' ? spot.open_on_matchdays : null)}, ` +
          `${literal(clip(spot.price_note_pt, 240))}, ${literal(clip(spot.note_pt, 280))}, ${literal(JSON.stringify(sources))}::jsonb, ` +
          `${literal(spot.confidence)}, ${literal(CHECKED_ON)});`
      );
      report.spots += 1;
      if (point) report.withPin += 1;
      console.error(
        `${venue.id} · ${name}: ${point ? `no mapa, a ${point.distance} m` : 'sem pino (só morada)'}`
      );
    }
  }
}

console.log(
  '-- Generated by scripts/importar-estacionamento.mjs from the match-day parking research.'
);
console.log('begin;');
console.log(statements.join('\n'));
console.log('commit;');
console.error(
  `\n${report.spots} parques (${report.withPin} no mapa); ${report.skipped.length} de fora:`
);
for (const line of report.skipped) console.error(`  - ${line}`);
