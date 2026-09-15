// Finds public toilets near stadiums in OpenStreetMap (amenity=toilets) and writes SQL that upserts them into
// public.restroom. Only what OSM records: free or paid, wheelchair access, who may use it, opening hours.
// Private toilets are left out. Coverage is uneven: many stadiums have few or none mapped.
//
// Usage:
//   npm run --silent db:wc -- [venue ids...] > /tmp/wc.sql   (--silent: npm would print its header into the SQL)
//   supabase db query --linked -f /tmp/wc.sql
// Without ids: every stadium (Portugal and abroad).
//
// Data © OpenStreetMap contributors (ODbL). This runs on a developer machine; the app never calls Overpass.

const ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const USER_AGENT = 'AwayDay/0.1 (toilets near stadiums; developer import)';
/** Straight-line radius. With the detour factor below this is about 20 minutes on foot. */
const RADIUS_M = 1200;
const DETOUR_FACTOR = 1.3;
const WALKING_M_PER_MIN = 80;
const PAUSE_MS = 2000;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).'
  );
  process.exit(1);
}

const wantedIds = new Set(process.argv.slice(2));
const venueResponse = await fetch(`${SUPABASE_URL}/rest/v1/venue?select=id,latitude,longitude`, {
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
    (wantedIds.size === 0 || wantedIds.has(venue.id))
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

const FEE = { yes: 'yes', no: 'no' };
const WHEELCHAIR = { yes: 'yes', limited: 'limited', no: 'no' };
const ACCESS = { yes: 'public', public: 'public', permissive: 'public', customers: 'customers' };

const rows = [];
for (const venue of venues) {
  console.error(`${venue.id}: a procurar…`);
  const around = `around:${RADIUS_M},${venue.latitude},${venue.longitude}`;
  const query = `[out:json][timeout:30];(node(${around})["amenity"="toilets"];way(${around})["amenity"="toilets"];);out center tags;`;
  let result;
  try {
    result = await overpass(query);
  } catch (error) {
    console.error(`${venue.id}: ${error.message}`);
    continue;
  }

  let count = 0;
  for (const element of result.elements) {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    // Not for the public.
    if (tags.access === 'private' || tags.access === 'no') continue;
    const distance = distanceMeters(venue.latitude, venue.longitude, lat, lon);
    if (distance > RADIUS_M) continue;
    rows.push({
      id: `wc-${element.type}-${element.id}`,
      osmId: `${element.type}/${element.id}`,
      venueId: venue.id,
      name: tags.name ? tags.name.slice(0, 120) : null,
      lat,
      lon,
      distance,
      walkingMinutes: Math.min(120, Math.ceil((distance * DETOUR_FACTOR) / WALKING_M_PER_MIN)),
      fee: FEE[tags.fee] ?? 'unknown',
      wheelchair: WHEELCHAIR[tags.wheelchair] ?? 'unknown',
      access: ACCESS[tags.access] ?? 'unknown',
      openingHours: tags.opening_hours ? tags.opening_hours.slice(0, 200) : null,
    });
    count += 1;
  }
  console.error(`${venue.id}: ${count} WC`);
  await sleep(PAUSE_MS);
}

if (rows.length === 0) {
  console.error('Nenhum WC encontrado.');
  process.exit(0);
}

// One row per OSM object: a toilet near two stadiums stays with the nearer one.
const byOsm = new Map();
for (const row of rows) {
  const current = byOsm.get(row.osmId);
  if (!current || row.distance < current.distance) byOsm.set(row.osmId, row);
}

const values = [...byOsm.values()]
  .map(
    (row) =>
      `  (${literal(row.id)}, ${literal(row.venueId)}, ${literal(row.osmId)}, ${literal(row.name)}, ` +
      `extensions.st_setsrid(extensions.st_makepoint(${row.lon}, ${row.lat}), 4326)::extensions.geography, ` +
      `${row.distance}, ${row.walkingMinutes}, ${literal(row.fee)}, ${literal(row.wheelchair)}, ${literal(row.access)}, ${literal(row.openingHours)})`
  )
  .join(',\n');

process.stdout
  .write(`-- Generated by scripts/importar-wc-osm.mjs. Data © OpenStreetMap contributors (ODbL).
insert into public.restroom (id, venue_id, osm_id, name, location, distance_m, walking_minutes, fee, wheelchair, access, opening_hours)
values
${values}
on conflict (osm_id) do update set
  name = excluded.name,
  fee = excluded.fee,
  wheelchair = excluded.wheelchair,
  access = excluded.access,
  opening_hours = excluded.opening_hours,
  venue_id = case when excluded.distance_m < restroom.distance_m then excluded.venue_id else restroom.venue_id end,
  location = case when excluded.distance_m < restroom.distance_m then excluded.location else restroom.location end,
  walking_minutes = case when excluded.distance_m < restroom.distance_m then excluded.walking_minutes else restroom.walking_minutes end,
  distance_m = least(excluded.distance_m, restroom.distance_m),
  imported_at = now();
`);
console.error(`${byOsm.size} WC no total.`);
