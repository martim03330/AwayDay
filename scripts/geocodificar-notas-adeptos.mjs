// Gives coordinates to the researched home-fan notes that name a real place outdoors, so the map can show them
// beside the streets the fans themselves flag.
//
// Only the notes below: each one was read by hand and paired with what it names on the map. The rest of the notes
// are about stands, gates and sectors *inside* the stadium — those are not places to draw on a street map, and
// nothing here is invented: a note without a clear place stays without coordinates.
//
// Every match is checked against the stadium (must be within MAX_DISTANCE_M) and the report says exactly what was
// found, so a wrong pin is caught before it reaches the app.
//
// Usage:
//   npm run --silent db:notas-adeptos > /tmp/notas.sql   (report on stderr)
//   supabase db query --linked -f /tmp/notas.sql
//
// Locations: © OpenStreetMap contributors (Nominatim). This runs on a developer machine.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AwayDay/0.1 (home fan notes geocoding; developer machine)';
const MAX_DISTANCE_M = 2500;

// venue · the note's exact title · what to look for (tried in order) · which kinds of place are acceptable ·
// how far from the stadium it may be · how wide the area is, in metres. The kinds matter: searching for a metro
// station once matched a memorial a kilometre away, and a wrong pin is worse than no pin.
const NOTAS = [
  {
    venue: 'alvalade',
    title: 'Casinha da Juventude Leonina',
    queries: ['Casinha da Juventude Leonina, Lisboa', 'Juventude Leonina, Lisboa'],
    accept: ['office', 'club', 'amenity', 'building', 'leisure'],
    maxDistance: 700,
    radius: 120,
  },
  {
    venue: 'alvalade',
    title: 'Pavilhão João Rocha e cafés mais próximos',
    queries: ['Pavilhão João Rocha, Lisboa'],
    accept: ['leisure', 'building'],
    maxDistance: 900,
    radius: 180,
  },
  {
    venue: 'alvalade',
    title: 'Estação de metro do Campo Grande',
    queries: [
      'Campo Grande, Metro, Lisboa',
      'Estação Campo Grande, Metropolitano de Lisboa',
      'Campo Grande metro station, Lisboa',
    ],
    accept: ['railway', 'public_transport'],
    maxDistance: 1500,
    radius: 150,
  },
  {
    venue: 'alvalade',
    title: 'Alvaláxia e lado direito da Avenida Padre Cruz',
    queries: ['Avenida Padre Cruz, Lisboa'],
    accept: ['highway'],
    maxDistance: 1200,
    radius: 300,
  },
  {
    venue: 'luz',
    title: 'Rotunda Cosme Damião e Avenida Lusíada',
    queries: [
      'Praça Cosme Damião, Lisboa',
      'Rotunda Cosme Damião, Lisboa',
      'Cosme Damião, Benfica, Lisboa',
    ],
    accept: ['highway', 'place'],
    maxDistance: 1200,
    radius: 200,
  },
  {
    venue: 'luz',
    title: 'Alto dos Moinhos e Avenida Machado Santos',
    queries: [
      'Alto dos Moinhos, Metro, Lisboa',
      'Estação Alto dos Moinhos, Lisboa',
      'Alto dos Moinhos, Lisboa',
    ],
    accept: ['railway', 'public_transport', 'place'],
    maxDistance: 1500,
    radius: 250,
  },
  {
    venue: 'fontelo',
    title: 'Fan Zone do Académico, Rua Dr. Aristides de Sousa Mendes (junto ao estádio)',
    queries: [
      'Rua Aristides de Sousa Mendes, Viseu',
      'Rua Doutor Aristides de Sousa Mendes, Viseu',
      'Aristides de Sousa Mendes, Viseu',
    ],
    accept: ['highway'],
    maxDistance: 1500,
    radius: 200,
  },
];

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

async function geocode(nota, venue) {
  const delta = 0.05;
  for (const query of nota.queries) {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      limit: '8',
      viewbox: `${venue.longitude - delta},${venue.latitude + delta},${venue.longitude + delta},${venue.latitude - delta}`,
      bounded: '1',
    });
    const response = await fetch(`${NOMINATIM}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    await sleep(1100);
    if (!response.ok) continue;
    const results = await response.json();
    const best = results
      .map((result) => ({
        latitude: Number(result.lat),
        longitude: Number(result.lon),
        label: result.display_name,
        category: result.category,
        type: `${result.category}/${result.type}`,
      }))
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
      .filter((point) => nota.accept.includes(point.category))
      .map((point) => ({ ...point, distance: distanceMeters(venue, point) }))
      .filter((point) => point.distance <= Math.min(nota.maxDistance, MAX_DISTANCE_M))
      .sort((a, b) => a.distance - b.distance)[0];
    if (best) return { ...best, query };
  }
  return null;
}

const venuesResponse = await fetch(`${SUPABASE_URL}/rest/v1/venue?select=id,latitude,longitude`, {
  headers: { apikey: SUPABASE_KEY },
});
const venues = new Map((await venuesResponse.json()).map((venue) => [venue.id, venue]));

const statements = [];
let found = 0;

for (const nota of NOTAS) {
  const venue = venues.get(nota.venue);
  if (!venue) {
    console.error(`${nota.venue}: estádio desconhecido`);
    continue;
  }
  const point = await geocode(nota, venue);
  if (!point) {
    console.error(`${nota.venue} · ${nota.title}: não encontrado, fica sem pino`);
    continue;
  }
  console.error(
    `${nota.venue} · ${nota.title}\n    -> [${point.query}] ${point.type} a ${point.distance} m do estádio: ${point.label}`
  );
  statements.push(
    `update public.venue_safety_note set latitude = ${point.latitude}, longitude = ${point.longitude}, ` +
      `radius_m = ${nota.radius}, updated_at = now() ` +
      `where venue_id = ${literal(nota.venue)} and title = ${literal(nota.title)} and kind = 'zona_adeptos_casa';`
  );
  found += 1;
}

console.log('-- Generated by scripts/geocodificar-notas-adeptos.mjs. © OpenStreetMap contributors.');
console.log('begin;');
console.log(statements.join('\n'));
console.log('commit;');
console.error(`\n${found} de ${NOTAS.length} notas com coordenadas.`);
