// Finds cafés, bars and restaurants near stadiums in OpenStreetMap and writes SQL that upserts them into
// public.place_candidate. Then `select public.suggest_place_candidates();` shows them in the app as suggestions.
//
// Usage:
//   npm run --silent db:tascos -- [venue ids...] > /tmp/candidatos.sql   (--silent: npm would print its header into the SQL)
//   supabase db query --linked -f /tmp/candidatos.sql
// Without ids: every Portuguese stadium. With ids: exactly those, stadiums abroad included.
//
// Data © OpenStreetMap contributors (ODbL). This runs on a developer machine; the app never calls Overpass.

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const USER_AGENT = 'AwayDay/0.1 (tascos near stadiums; developer import)';
/** Straight-line radius. With the detour factor below this is about 20 minutes on foot. */
const RADIUS_M = 1200;
/** Streets are not straight lines. */
const DETOUR_FACTOR = 1.3;
const WALKING_M_PER_MIN = 80;
const MAX_PER_VENUE = 25;
const PAUSE_MS = 3000;
const AMENITIES = 'restaurant|bar|pub|cafe|fast_food';

// Stadiums come from the database (public, read with the publishable key from .env.local), so the ones abroad added
// for European fixtures are there too.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).');
  process.exit(1);
}

const wantedIds = new Set(process.argv.slice(2));
const venueResponse = await fetch(`${SUPABASE_URL}/rest/v1/venue?select=id,country,latitude,longitude`, {
  headers: { apikey: SUPABASE_KEY },
});
if (!venueResponse.ok) {
  console.error(`Não foi possível ler os estádios (${venueResponse.status}).`);
  process.exit(1);
}
const venues = (await venueResponse.json()).filter(
  (venue) =>
    venue.latitude !== null &&
    venue.longitude !== null &&
    (wantedIds.size === 0 ? venue.country === 'Portugal' : wantedIds.has(venue.id))
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Our kind of place, from OSM tags and the name. Only a suggestion: the curator decides. */
function suggestKind(tags) {
  const name = tags.name ?? '';
  const cuisine = tags.cuisine ?? '';
  if (/tasca|tasquinha|taberna/i.test(name)) return 'tasca';
  if (/cervejaria/i.test(name)) return 'cervejaria';
  if (/churrasqueira|churrasco/i.test(name) || /bbq|grill|chicken/.test(cuisine)) return 'churrasqueira';
  if (/rulote|roulotte|bifana/i.test(name)) return 'roulotte';
  if (tags.amenity === 'bar' || tags.amenity === 'pub') return 'bar';
  if (tags.amenity === 'cafe') return 'cafe';
  return 'restaurante';
}

function literal(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function overpass(query) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
      const text = await response.text();
      if (response.ok && text.trimStart().startsWith('{')) return JSON.parse(text);
      console.error(`  ${endpoint} answered ${response.status}; retrying`);
    } catch (error) {
      console.error(`  ${endpoint} failed (${error.message}); retrying`);
    }
    await sleep(PAUSE_MS * (attempt + 1));
  }
  throw new Error('Overpass did not answer after several attempts.');
}

const rows = [];
for (const venue of venues) {
  console.error(`${venue.id}: a procurar…`);
  const around = `around:${RADIUS_M},${venue.latitude},${venue.longitude}`;
  const query = `[out:json][timeout:30];(node(${around})["amenity"~"^(${AMENITIES})$"]["name"];way(${around})["amenity"~"^(${AMENITIES})$"]["name"];);out center tags;`;
  const result = await overpass(query);

  const candidates = result.elements
    .map((element) => {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat === undefined || lon === undefined || !tags.name) return null;
      // Chains are not tascos.
      if (tags.brand || tags['brand:wikidata']) return null;
      const distance = distanceMeters(venue.latitude, venue.longitude, lat, lon);
      if (distance > RADIUS_M) return null;
      return {
        osmId: `${element.type}/${element.id}`,
        name: tags.name,
        tags,
        kind: suggestKind(tags),
        lat,
        lon,
        distance,
        walkingMinutes: Math.min(120, Math.ceil((distance * DETOUR_FACTOR) / WALKING_M_PER_MIN)),
      };
    })
    .filter((candidate) => candidate !== null)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_PER_VENUE);

  console.error(`${venue.id}: ${candidates.length} candidatos`);
  for (const candidate of candidates) rows.push({ venueId: venue.id, ...candidate });
  await sleep(PAUSE_MS);
}

if (rows.length === 0) {
  console.error('Nenhum candidato encontrado.');
  process.exit(0);
}

const values = rows
  .map(
    (row) =>
      `  (${literal(row.osmId)}, ${literal(row.venueId)}, ${literal(row.name)}, ${literal(JSON.stringify(row.tags))}::jsonb, ` +
      `${literal(row.kind)}, extensions.st_setsrid(extensions.st_makepoint(${row.lon}, ${row.lat}), 4326)::extensions.geography, ` +
      `${row.distance}, ${row.walkingMinutes})`
  )
  .join(',\n');

// A place near two stadiums stays with the nearer one; curation decisions are never overwritten.
process.stdout.write(`-- Generated by scripts/importar-tascos-osm.mjs. Data © OpenStreetMap contributors (ODbL).
insert into public.place_candidate (osm_id, venue_id, name, osm_tags, suggested_kind, location, distance_m, walking_minutes)
values
${values}
on conflict (osm_id) do update set
  name = excluded.name,
  osm_tags = excluded.osm_tags,
  suggested_kind = excluded.suggested_kind,
  venue_id = case when excluded.distance_m < place_candidate.distance_m then excluded.venue_id else place_candidate.venue_id end,
  location = case when excluded.distance_m < place_candidate.distance_m then excluded.location else place_candidate.location end,
  walking_minutes = case when excluded.distance_m < place_candidate.distance_m then excluded.walking_minutes else place_candidate.walking_minutes end,
  distance_m = least(excluded.distance_m, place_candidate.distance_m),
  imported_at = now();
`);
console.error(`${rows.length} candidatos no total.`);
