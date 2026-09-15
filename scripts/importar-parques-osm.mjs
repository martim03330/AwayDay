// Adds public car parks from OpenStreetMap around each stadium, so a driver has more options than the researched
// ones — including car parks further out, which on match day are often the ones with space left.
//
// What comes in: car parks the public can use (no private ones), inside 3 km of the stadium, that either have a name
// or are big enough to matter. Street-side and kerb parking is left out: those are not places to send a car to.
// Car parks without a name in OpenStreetMap are named by the street they are on (Nominatim), never invented.
// A car park already covered by the research (same name, or within 120 m of it) is skipped: the researched row knows
// more, because it carries match-day sources.
//
// These rows carry no match-day information, so they are stored as source = 'osm' and the app shows where they come
// from and only *estimates* how easy parking is. Re-running replaces only the OpenStreetMap rows of each stadium.
//
// Usage:
//   npm run --silent db:parques-osm -- [venue-id ...] > /tmp/parques-osm.sql   (report on stderr)
//   supabase db query --linked -f /tmp/parques-osm.sql
//
// Data: © OpenStreetMap contributors (Overpass and Nominatim). This runs on a developer machine.

const OVERPASS = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'AwayDay/0.1 (match-day parking import; developer machine)';

const RADIUS_M = 3000;
/** Without a name, a car park only earns a place in the list if it holds this many cars. */
const MIN_CAPACITY = 30;
/** How close to a researched car park counts as the same place. */
const SAME_PLACE_M = 120;
/** Per stadium: enough choice, still a list someone can read. */
const MAX_SPOTS = 12;
/** Parking laid out along a street is not somewhere to send a car. */
const SKIP_PARKING = new Set(['street_side', 'lane', 'on_kerb']);
const PUBLIC_ACCESS = new Set(['yes', 'public', 'customers', 'permissive']);
const CHECKED_ON = new Date().toISOString().slice(0, 10);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).'
  );
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function literal(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
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

function normalizar(name) {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function clip(text, max) {
  const value = typeof text === 'string' ? text.trim() : '';
  if (!value) return null;
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** The number of spaces OpenStreetMap gives, when it is a plain number. */
function lerCapacidade(tags) {
  const raw = (tags.capacity ?? '').split(';')[0];
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 && value < 20000 ? value : null;
}

function centro(element) {
  if (element.type === 'node') return { latitude: element.lat, longitude: element.lon };
  if (element.center) return { latitude: element.center.lat, longitude: element.center.lon };
  return null;
}

async function overpass(venue) {
  const query =
    `[out:json][timeout:60];nwr["amenity"="parking"]` +
    `(around:${RADIUS_M},${venue.latitude},${venue.longitude});out center tags;`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(OVERPASS, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) {
        await sleep(5000);
        continue;
      }
      return (await response.json()).elements ?? [];
    } catch {
      await sleep(5000);
    }
  }
  return null;
}

/** The street a car park is on, to name it honestly when OpenStreetMap has no name for it. */
async function rua(point) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.latitude),
    lon: String(point.longitude),
    zoom: '17',
  });
  try {
    const response = await fetch(`${NOMINATIM}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    await sleep(1100);
    if (!response.ok) return null;
    const result = await response.json();
    return clip(result?.address?.road ?? null, 90);
  } catch {
    await sleep(2000);
    return null;
  }
}

function tipoDoParque(tags) {
  if (tags.park_ride && tags.park_ride !== 'no') return 'park_and_ride';
  if (tags.fee === 'no') return 'parque_gratuito';
  return 'parque_publico';
}

function precoDoParque(tags) {
  if (tags.fee === 'yes') return 'Pago, segundo o OpenStreetMap. Confirma o preço no local.';
  if (tags.fee === 'no') return 'Gratuito, segundo o OpenStreetMap. Confirma no local.';
  return null;
}

const wanted = new Set(process.argv.slice(2));

// Only stadiums with games in the app, and only in Portugal: this data is for people going to these games.
const venuesResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/venue?select=id,name,city,country,latitude,longitude&country=eq.Portugal`,
  { headers: { apikey: SUPABASE_KEY } }
);
const allVenues = await venuesResponse.json();
const fixturesResponse = await fetch(`${SUPABASE_URL}/rest/v1/fixture?select=venue_id`, {
  headers: { apikey: SUPABASE_KEY },
});
const withGames = new Set((await fixturesResponse.json()).map((fixture) => fixture.venue_id));
const venues = allVenues
  .filter((venue) => withGames.has(venue.id) && venue.latitude !== null)
  .filter((venue) => wanted.size === 0 || wanted.has(venue.id))
  .sort((a, b) => a.id.localeCompare(b.id));

const existingResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/parking_spot?select=venue_id,name,latitude,longitude,source`,
  { headers: { apikey: SUPABASE_KEY } }
);
const existing = await existingResponse.json();

const statements = [];
const report = { spots: 0, venues: 0, skipped: [] };

for (const venue of venues) {
  const elements = await overpass(venue);
  if (elements === null) {
    console.error(`${venue.id}: Overpass não respondeu, estádio ignorado`);
    continue;
  }

  const pesquisados = existing.filter(
    (spot) => spot.venue_id === venue.id && spot.source !== 'osm'
  );
  const nomesPesquisados = new Set(pesquisados.map((spot) => normalizar(spot.name)));

  const candidatos = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const point = centro(element);
    if (!point) continue;
    if (!PUBLIC_ACCESS.has(tags.access ?? 'yes')) continue;
    if (SKIP_PARKING.has(tags.parking)) continue;

    const capacity = lerCapacidade(tags);
    const nomeOsm = clip(tags.name ?? tags.operator ?? tags.brand ?? null, 120);
    if (!nomeOsm && (capacity === null || capacity < MIN_CAPACITY)) continue;

    const distance = distanceMeters(venue, point);
    if (distance > RADIUS_M) continue;

    const jaPesquisado = pesquisados.some(
      (spot) =>
        (spot.latitude !== null &&
          distanceMeters(point, { latitude: spot.latitude, longitude: spot.longitude }) <=
            SAME_PLACE_M) ||
        (nomeOsm && normalizar(spot.name) === normalizar(nomeOsm))
    );
    if (jaPesquisado) {
      report.skipped.push(`${venue.id} · ${nomeOsm ?? `${element.type}/${element.id}`}: já vem da pesquisa`);
      continue;
    }

    candidatos.push({
      osmId: `${element.type}/${element.id}`,
      nomeOsm,
      capacity,
      tags,
      point,
      distance,
    });
  }

  candidatos.sort((a, b) => a.distance - b.distance);

  const escolhidos = [];
  const nomesUsados = new Set(nomesPesquisados);
  for (const candidato of candidatos) {
    if (escolhidos.length >= MAX_SPOTS) break;
    // Without a name in OpenStreetMap, the street it is on: "Parque na Avenida X".
    let name = candidato.nomeOsm;
    if (!name) {
      const estrada = await rua(candidato.point);
      if (!estrada) {
        report.skipped.push(`${venue.id} · ${candidato.osmId}: sem nome nem rua`);
        continue;
      }
      name = clip(`Parque na ${estrada}`, 120);
    }
    if (nomesUsados.has(normalizar(name))) {
      report.skipped.push(`${venue.id} · ${name}: nome repetido`);
      continue;
    }
    nomesUsados.add(normalizar(name));
    escolhidos.push({ ...candidato, name });
  }

  statements.push(`delete from public.parking_spot where venue_id = ${literal(venue.id)} and source = 'osm';`);
  for (const spot of escolhidos) {
    statements.push(
      `insert into public.parking_spot (venue_id, name, kind, source, osm_id, capacity, operator, location, distance_m, open_on_matchdays, price_note, sources, confidence, checked_on) values (` +
        `${literal(venue.id)}, ${literal(spot.name)}, ${literal(tipoDoParque(spot.tags))}, 'osm', ${literal(spot.osmId)}, ` +
        `${literal(spot.capacity)}, ${literal(clip(spot.tags.operator ?? null, 80))}, ` +
        `extensions.st_setsrid(extensions.st_makepoint(${spot.point.longitude}, ${spot.point.latitude}), 4326)::extensions.geography, ` +
        `${spot.distance}, null, ${literal(precoDoParque(spot.tags))}, ` +
        `${literal(JSON.stringify([{ url: `https://www.openstreetmap.org/${spot.osmId}`, title: 'OpenStreetMap' }]))}::jsonb, ` +
        `'osm', ${literal(CHECKED_ON)});`
    );
  }

  report.spots += escolhidos.length;
  report.venues += 1;
  console.error(
    `${venue.id}: ${escolhidos.length} parques do OpenStreetMap (${escolhidos
      .map((spot) => `${spot.name} ${spot.distance} m${spot.capacity ? ` ${spot.capacity} lug.` : ''}`)
      .join(' · ')})`
  );
}

console.log('-- Generated by scripts/importar-parques-osm.mjs. © OpenStreetMap contributors.');
console.log('begin;');
console.log(statements.join('\n'));
console.log('commit;');
console.error(`\n${report.spots} parques em ${report.venues} estádios; ${report.skipped.length} de fora.`);
for (const line of report.skipped.slice(0, 40)) console.error(`  - ${line}`);
