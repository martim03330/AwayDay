// Finds the places we list that sit inside a shopping centre (OpenStreetMap shop=mall, or a building named "Centro
// Comercial"/"Shopping"), and writes SQL that hides them: a food court is not where fans meet before a game.
// Public toilets inside shopping centres stay: those are useful.
//
// Usage:
//   npm run --silent db:centros-comerciais -- [venue ids...] > /tmp/centros.sql   (names found go to stderr)
//   supabase db query --linked -f /tmp/centros.sql
// Without ids: every stadium.
//
// Data © OpenStreetMap contributors (ODbL). This runs on a developer machine; the app never calls Overpass.

const ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const USER_AGENT = 'AwayDay/0.1 (places inside shopping centres; developer import)';
/** A little beyond the 1200 m used to import places, so a centre at the edge still counts. */
const RADIUS_M = 1600;
const PAUSE_MS = 3000;
const AMENITIES = 'restaurant|bar|pub|cafe|fast_food|food_court|ice_cream';
/**
 * Only real shopping centres count. Old street galleries also called "Centro Comercial" (and shops mis-tagged as
 * malls) are small, and their street-facing cafés are proper tascos. Measured on the bounding box.
 */
const MIN_AREA_M2 = 8000;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local).'
  );
  process.exit(1);
}

const wantedIds = new Set(process.argv.slice(2));
const venueResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/venue?select=id,latitude,longitude&order=id`,
  { headers: { apikey: SUPABASE_KEY } }
);
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

/** Area of an Overpass bounding box ({ minlat, minlon, maxlat, maxlon }) in square metres. */
function boundsArea(bounds) {
  if (!bounds) return 0;
  const metresPerDegree = 111320;
  const height = (bounds.maxlat - bounds.minlat) * metresPerDegree;
  const width =
    (bounds.maxlon - bounds.minlon) *
    metresPerDegree *
    Math.cos((((bounds.minlat + bounds.maxlat) / 2) * Math.PI) / 180);
  return Math.abs(height * width);
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

const osmIds = new Map();
for (const venue of venues) {
  const around = `around:${RADIUS_M},${venue.latitude},${venue.longitude}`;
  const centresQuery =
    `[out:json][timeout:60];` +
    `(way(${around})[shop=mall];relation(${around})[shop=mall];` +
    `way(${around})[building][name~"^(Centro Comercial|C\\\\.C\\\\.|Shopping|Galerias)",i];);` +
    `out tags bb;`;
  let centres;
  try {
    centres = (await overpass(centresQuery)).elements.filter(
      (centre) => boundsArea(centre.bounds) >= MIN_AREA_M2
    );
  } catch (error) {
    console.error(`${venue.id}: ${error.message}`);
    continue;
  }
  if (centres.length === 0) {
    console.error(`${venue.id}: sem centros comerciais grandes`);
    await sleep(PAUSE_MS);
    continue;
  }
  await sleep(PAUSE_MS);

  const ways = centres.filter((centre) => centre.type === 'way').map((centre) => centre.id);
  const relations = centres
    .filter((centre) => centre.type === 'relation')
    .map((centre) => centre.id);
  const placesQuery =
    `[out:json][timeout:60];` +
    `(${ways.length ? `way(id:${ways.join(',')});` : ''}${relations.length ? `relation(id:${relations.join(',')});` : ''})->.centres;` +
    `.centres map_to_area->.inside;` +
    `nwr(area.inside)[amenity~"^(${AMENITIES})$"];out tags;`;
  let places;
  try {
    places = (await overpass(placesQuery)).elements;
  } catch (error) {
    console.error(`${venue.id}: ${error.message}`);
    continue;
  }
  for (const place of places) {
    osmIds.set(`${place.type}/${place.id}`, place.tags?.name ?? '(sem nome)');
  }
  console.error(
    `${venue.id}: ${centres.map((centre) => `${centre.tags?.name ?? 'centro sem nome'} (${Math.round(boundsArea(centre.bounds) / 1000)} mil m²)`).join(', ')} · ${places.length} locais lá dentro`
  );
  await sleep(PAUSE_MS);
}

console.log(
  '-- Generated by scripts/tascos-centros-comerciais.mjs. Data © OpenStreetMap contributors (ODbL).'
);
if (osmIds.size === 0) {
  console.log('select 1;');
} else {
  const ids = [...osmIds.keys()].map(literal).join(',\n  ');
  // Places fans or the owner confirmed stay: someone decided they belong.
  console.log(
    `update public.place\nset confirmation = 'rejected', rejection_reason = 'shopping_centre'\nwhere confirmation = 'suggested' and osm_id in (\n  ${ids}\n)\nreturning id, name;`
  );
}
console.error(`${osmIds.size} locais dentro de centros comerciais.`);
