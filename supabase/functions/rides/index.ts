// Rides to a game (slice 3), for signed-in fans:
// - action "quote": the car routes from a meeting point to the stadium (fastest, cheapest with some motorway, without
//   tolls: see _shared/route-choice.ts) with what each costs in fuel and tolls and the price per person as seats fill
//   up;
// - action "create": opens a ride on one of those routes. The cost is computed here again, never taken from the app;
// - action "search": streets and places for the meeting point (OpenStreetMap Nominatim), when the driver searches;
// - action "fuel_prices": yesterday's national average price of petrol 95 and diesel (DGEG), cached in fuel_price,
//   as the starting value of the ride form.
// A driver has at most one open ride per game.
// Routes come from the public Valhalla router of the FOSSGIS / OpenStreetMap community (no key, fair use), so the
// app never calls it. Routes and place searches are cached in Postgres
// (route_cache, place_search_cache), so the same trip or search is asked once a month or once a week, not every
// time: that keeps us inside the fair use of free services. The meeting point is a public place the driver picks.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';
import {
  sharePerPersonCents,
  tripCost,
  type TollRate,
  type TripCost,
} from '../_shared/ride-cost.ts';
import { chooseRoutes, type Candidate, type RouteOption } from '../_shared/route-choice.ts';
import { routeFromCache, routesFromValhalla, type Route } from '../_shared/route-parse.ts';

const ROUTER = 'https://valhalla1.openstreetmap.de/route';
const GEOCODER = 'https://nominatim.openstreetmap.org/search';
/** Fallback geocoder (Photon, by Komoot, on OpenStreetMap data). */
const FALLBACK_GEOCODER = 'https://photon.komoot.io/api/';
const USER_AGENT = 'AwayDay/1.0 (match-day app for football fans)';
/** DGEG's daily averages (the same data as precoscombustiveis.dgeg.gov.pt). */
const FUEL_PRICES = 'https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PMD';
const FUEL_SOURCE = 'https://precoscombustiveis.dgeg.gov.pt/';
/** DGEG's fuel type ids: petrol 95 and diesel, both the plain ones most cars use. */
const FUELS = [
  { fuel: 'gasolina', id: 3201 },
  { fuel: 'gasoleo', id: 2101 },
] as const;
/** Asked again at most this often: the average changes once a day. */
const FUEL_REFRESH_MS = 6 * 60 * 60 * 1000;
const QUOTE_LIMIT = { bucket: 'ride-quote', limit: 30, window: '1 hour' } as const;
const CREATE_LIMIT = { bucket: 'ride-create', limit: 10, window: '1 day' } as const;
/** Searches only when the driver presses "Procurar" (Nominatim does not allow search-as-you-type). */
const SEARCH_LIMIT = { bucket: 'ride-place-search', limit: 30, window: '1 hour' } as const;
/** A car trip to a game, not a road trip across the continent. */
const MAX_STRAIGHT_LINE_M = 2_500_000;
const MAX_PEOPLE = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A ride is published at least this long before it leaves (src/lib/regras-boleia.ts shows the same). */
const MIN_NOTICE_MS = 3 * 60 * 60 * 1000;

const OPTIONS: readonly RouteOption[] = ['rapida', 'equilibrio', 'sem_portagens'];
/**
 * How much the router avoids tolls, from 1 (does not care) to 0 (avoids them whenever it can). The levels in between
 * are where the mixes come out (a motorway for part of the way, then a national road): asked with one alternative
 * each, they give the routes the cheapest one is picked from with the real price of each motorway.
 */
const TOLL_LEVELS = [1, 0.4, 0.3, 0] as const;
/** The cache rows of these routes start with this, so rows from before the alternatives are not read as complete. */
const CACHE_VERSION = 'v4';

type Point = { latitude: number; longitude: number };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function toPoint(value: unknown): Point | null {
  const point = asRecord(value);
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function wholeBetween(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function isOption(value: unknown): value is RouteOption {
  return typeof value === 'string' && OPTIONS.some((option) => option === value);
}

function straightLineM(from: Point, to: Point) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLng = rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

/** The router's routes at one level of toll avoidance: the main one and up to one alternative. Empty on failure. */
async function routeValhalla(from: Point, to: Point, useTolls: number): Promise<Route[]> {
  try {
    const response = await fetch(ROUTER, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [
          { lat: from.latitude, lon: from.longitude },
          { lat: to.latitude, lon: to.longitude },
        ],
        costing: 'auto',
        costing_options: { auto: { use_tolls: useTolls } },
        alternates: 1,
        directions_options: { units: 'kilometers' },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return [];
    return routesFromValhalla(await response.json());
  } catch {
    return [];
  }
}

/** ~100 m: two meeting points this close share a route. */
const coord = (value: number) => value.toFixed(3);

/**
 * The routes at one level of toll avoidance, from cache or from Valhalla, then cached for 30 days (one row per route:
 * `<key>#0` is the main one, `<key>#1` the alternative). There is no fallback router on purpose: the free ones (OSRM)
 * know nothing about tolls, and a ride price without tolls would be wrong money for real people.
 */
async function routesAt(admin: SupabaseClient, from: Point, to: Point, useTolls: number): Promise<Route[]> {
  const key = `${CACHE_VERSION}:${coord(from.latitude)},${coord(from.longitude)}>${coord(to.latitude)},${coord(to.longitude)}:${useTolls}`;
  const cached = await admin
    .from('route_cache')
    .select('key, distance_m, duration_s, toll_segments, motorways, via_points')
    .in('key', [`${key}#0`, `${key}#1`])
    .gte('created_at', new Date(Date.now() - 30 * DAY_MS).toISOString());
  const rows = [...(cached.data ?? [])].sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const fromCache = rows.map((row) => routeFromCache(row));
  // A malformed row is ignored: the routes are asked again and the upsert below overwrites them.
  if (rows.length > 0 && String(rows[0].key).endsWith('#0') && fromCache.every((found) => found !== null)) {
    return fromCache.filter((found): found is Route => found !== null);
  }
  // Without the key: it holds the coordinates of the meeting point and the stadium.
  if (rows.length > 0) console.error('rides: discarding incomplete or malformed route_cache rows');
  const found = await routeValhalla(from, to, useTolls);
  if (found.length > 0) {
    const createdAt = new Date().toISOString();
    await admin.from('route_cache').upsert(
      found.map((one, index) => ({
        key: `${key}#${index}`,
        distance_m: one.distanceM,
        duration_s: one.durationS,
        toll_segments: one.tollSegments,
        motorways: one.motorways,
        via_points: one.viaPoints,
        created_at: createdAt,
      }))
    );
    // An older alternative that the router no longer gives must not come back from the cache next time.
    if (found.length === 1) await admin.from('route_cache').delete().eq('key', `${key}#1`);
  }
  return found;
}

/** Every route the router gives at each level of toll avoidance, all at once. */
async function allRoutes(admin: SupabaseClient, from: Point, to: Point): Promise<Route[]> {
  const levels = await Promise.all(TOLL_LEVELS.map((level) => routesAt(admin, from, to, level)));
  return levels.flat();
}

type PlaceResult = { name: string; detail: string; latitude: number; longitude: number; distance_m: number | null };

function placeResult(name: string, detail: string, point: Point, near: Point | null): PlaceResult {
  return {
    name: name.slice(0, 80),
    detail,
    latitude: point.latitude,
    longitude: point.longitude,
    distance_m: near ? Math.round(straightLineM(near, point)) : null,
  };
}

/** Streets and places matching the driver's words, from Nominatim. `null` when Nominatim did not answer. */
async function searchNominatim(query: string, near: Point | null): Promise<PlaceResult[] | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '6',
    'accept-language': 'pt-PT',
  });
  if (near) {
    const delta = 0.5;
    params.set(
      'viewbox',
      `${near.longitude - delta},${near.latitude + delta},${near.longitude + delta},${near.latitude - delta}`
    );
  }
  try {
    const response = await fetch(`${GEOCODER}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const results: unknown = await response.json();
    return (Array.isArray(results) ? results : []).flatMap((item) => {
      const result = asRecord(item);
      const point = toPoint({ latitude: Number(result?.lat), longitude: Number(result?.lon) });
      const label = typeof result?.display_name === 'string' ? result.display_name : '';
      if (!point || !label) return [];
      const parts = label.split(',').map((part) => part.trim());
      return [placeResult(parts.slice(0, 2).join(', '), parts.slice(2, 4).join(', '), point, near)];
    });
  } catch {
    return null;
  }
}

/** The same search on Photon, when Nominatim is down or busy. */
async function searchPhoton(query: string, near: Point | null): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q: query, limit: '6' });
  if (near) {
    params.set('lat', String(near.latitude));
    params.set('lon', String(near.longitude));
  }
  try {
    const response = await fetch(`${FALLBACK_GEOCODER}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const features = asRecord(await response.json())?.features;
    return (Array.isArray(features) ? features : []).flatMap((item) => {
      const feature = asRecord(item);
      const coords = asRecord(feature?.geometry)?.coordinates;
      const props = asRecord(feature?.properties);
      if (!Array.isArray(coords) || !props) return [];
      const point = toPoint({ latitude: Number(coords[1]), longitude: Number(coords[0]) });
      const name = [props.name, props.street].find((value) => typeof value === 'string');
      if (!point || typeof name !== 'string') return [];
      const detail = [props.city, props.county].filter((value) => typeof value === 'string').join(', ');
      return [placeResult(name, detail, point, near)];
    });
  } catch {
    return [];
  }
}

/** A place search from cache (7 days), or Nominatim (Photon if it fails), then cached. */
async function searchPlaces(admin: SupabaseClient, query: string, near: Point | null) {
  const area = near ? `${near.latitude.toFixed(1)},${near.longitude.toFixed(1)}` : 'pt';
  const key = `${query.toLowerCase().replace(/\s+/g, ' ')}@${area}`;
  const cached = await admin
    .from('place_search_cache')
    .select('results')
    .eq('key', key)
    .gte('created_at', new Date(Date.now() - 7 * DAY_MS).toISOString())
    .maybeSingle();
  if (Array.isArray(cached.data?.results)) {
    // Distances depend on where this driver is: work them out again.
    return (cached.data.results as PlaceResult[]).map((place) =>
      placeResult(place.name, place.detail, { latitude: place.latitude, longitude: place.longitude }, near)
    );
  }
  const results = (await searchNominatim(query, near)) ?? (await searchPhoton(query, near));
  if (results.length > 0) {
    await admin.from('place_search_cache').upsert({ key, results, created_at: new Date().toISOString() });
  }
  return results;
}

async function tollRates(admin: SupabaseClient): Promise<TollRate[] | null> {
  const { data, error } = await admin
    .from('toll_rate')
    .select('motorway, reference_cents, reference_m');
  if (error || !data) return null;
  return data.map((row) => ({
    motorway: String(row.motorway),
    referenceCents: Number(row.reference_cents),
    referenceM: Number(row.reference_m),
  }));
}

/** "2,110 €" → 2110 thousandths of a euro, or `null` for anything else. */
function milliFromEuroText(text: unknown): number | null {
  const match = typeof text === 'string' ? /^(\d),(\d{3})\s*€?$/.exec(text.trim()) : null;
  if (!match) return null;
  const milli = Number(match[1]) * 1000 + Number(match[2]);
  return milli >= 500 && milli <= 4000 ? milli : null;
}

/** The day's average of one fuel, trying yesterday and the day before (Lisbon dates). `null` when DGEG fails. */
async function fetchFuelAverage(id: number): Promise<{ milli: number; date: string } | null> {
  for (const daysBack of [1, 2, 3]) {
    const day = new Date(Date.now() - daysBack * DAY_MS).toLocaleDateString('sv-SE', { timeZone: 'Europe/Lisbon' });
    try {
      const response = await fetch(`${FUEL_PRICES}?idsTiposComb=${id}&dataIni=${day}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) continue;
      const body = asRecord(await response.json());
      const rows = Array.isArray(body?.resultado) ? body.resultado : [];
      const milli = milliFromEuroText(asRecord(rows[0])?.PrecoMedio);
      if (milli !== null) return { milli, date: day };
    } catch {
      // Next day back.
    }
  }
  return null;
}

/**
 * Petrol and diesel averages from the cache, refreshed from DGEG when older than FUEL_REFRESH_MS. A failed refresh
 * keeps the old prices (still a good starting value); with none at all, the app keeps its own.
 */
async function fuelPrices(admin: SupabaseClient) {
  const cached = await admin.from('fuel_price').select('fuel, milli_per_litre, price_date, updated_at');
  const rows = cached.data ?? [];
  const fresh =
    rows.length === FUELS.length &&
    rows.every((row) => Date.now() - Date.parse(String(row.updated_at)) < FUEL_REFRESH_MS);
  if (!fresh) {
    const found = await Promise.all(FUELS.map(async ({ fuel, id }) => ({ fuel, average: await fetchFuelAverage(id) })));
    const updates = found.flatMap(({ fuel, average }) =>
      average
        ? [{ fuel, milli_per_litre: average.milli, price_date: average.date, source_url: FUEL_SOURCE, updated_at: new Date().toISOString() }]
        : []
    );
    if (updates.length > 0) {
      await admin.from('fuel_price').upsert(updates);
      for (const update of updates) {
        const index = rows.findIndex((row) => row.fuel === update.fuel);
        if (index >= 0) rows[index] = update;
        else rows.push(update);
      }
    }
  }
  return Object.fromEntries(
    rows.map((row) => [String(row.fuel), { milli_per_litre: Number(row.milli_per_litre), date: String(row.price_date) }])
  );
}

async function takeLimit(
  admin: SupabaseClient,
  profileId: string,
  limit: { bucket: string; limit: number; window: string }
) {
  const allowed = await admin.rpc('take_rate_limit', {
    p_profile_id: profileId,
    p_bucket: limit.bucket,
    p_limit: limit.limit,
    p_window: limit.window,
  });
  if (allowed.error) return 'failed';
  return allowed.data === true ? 'ok' : 'limited';
}

/** O concelho de um ponto: o concelho mais próximo, calculado na base de dados. `null` quando não se sabe. */
async function reverseCity(admin: SupabaseClient, ponto: Point): Promise<string | null> {
  const { data, error } = await admin.rpc('nearest_municipality_name', {
    p_latitude: ponto.latitude,
    p_longitude: ponto.longitude,
  });
  return !error && typeof data === 'string' && data.length >= 2 ? data.slice(0, 80) : null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const caller = await authenticatedCaller(request, admin);
  if (!caller) return json(401, { error: 'not_signed_in' });

  const body = asRecord(await request.json().catch(() => null));
  const action = body?.action;

  if (action === 'search') {
    const query = typeof body?.query === 'string' ? body.query.trim() : '';
    const near = toPoint(body?.near);
    if (query.length < 3 || query.length > 120) return json(400, { error: 'bad_request' });
    const limited = await takeLimit(admin, caller.user.id, SEARCH_LIMIT);
    if (limited === 'failed') return json(500, { error: 'rate_limit_failed' });
    if (limited === 'limited') return json(429, { error: 'rate_limited' });
    return json(200, { results: await searchPlaces(admin, query, near) });
  }

  if (action === 'fuel_prices') {
    return json(200, { prices: await fuelPrices(admin), source: 'DGEG – Direção-Geral de Energia e Geologia' });
  }
  const fixtureId = typeof body?.fixtureId === 'string' ? body.fixtureId : null;
  const origin = toPoint(body?.origin);
  // An electric car shares only the tolls: no consumption nor price per litre.
  const electric = body?.electric === true;
  // Realistic bounds (3–15 L/100 km, 1,000–2,600 €/L): the driver cannot inflate what the passengers pay.
  const consumption = electric ? 0 : wholeBetween(body?.consumptionClPer100Km, 300, 1500);
  const fuelPrice = electric ? 0 : wholeBetween(body?.fuelPriceMilliPerLitre, 1000, 2600);
  const roundTrip = typeof body?.roundTrip === 'boolean' ? body.roundTrip : null;
  if (
    (action !== 'quote' && action !== 'create') ||
    !fixtureId ||
    !origin ||
    consumption === null ||
    fuelPrice === null ||
    roundTrip === null
  ) {
    return json(400, { error: 'bad_request' });
  }

  // The four checks do not depend on each other: all at once (one round trip instead of four).
  const [fixture, existing, seat, rates] = await Promise.all([
    admin.from('fixture').select('id, kickoff_at, venue_id, venue:venue_id (latitude, longitude)').eq('id', fixtureId).maybeSingle(),
    // One open ride per driver per game (also enforced by a unique index).
    admin
      .from('ride')
      .select('id')
      .eq('fixture_id', fixtureId)
      .eq('driver_id', caller.user.id)
      .eq('status', 'open')
      .limit(1),
    // One car per game: someone with a seat (or a pending request) in another ride of this game goes in that one.
    admin
      .from('ride_passenger')
      .select('ride_id, ride!inner(fixture_id, status)')
      .eq('profile_id', caller.user.id)
      .in('status', ['requested', 'accepted'])
      .eq('ride.fixture_id', fixtureId)
      .eq('ride.status', 'open')
      .limit(1),
    tollRates(admin),
  ]);
  const venue = asRecord(fixture.data?.venue);
  const stadium = toPoint({ latitude: venue?.latitude, longitude: venue?.longitude });
  if (fixture.error || !fixture.data || !stadium) return json(404, { error: 'fixture_not_found' });
  const kickoff = Date.parse(String(fixture.data.kickoff_at));
  if (!(kickoff > Date.now())) return json(422, { error: 'fixture_started' });
  if (straightLineM(origin, stadium) > MAX_STRAIGHT_LINE_M) return json(422, { error: 'too_far' });

  if (existing.error) return json(500, { error: 'lookup_failed' });
  if (existing.data.length > 0) {
    return json(409, { error: 'already_offering', id: existing.data[0].id });
  }
  if (seat.error) return json(500, { error: 'lookup_failed' });
  if (seat.data.length > 0) return json(409, { error: 'already_going' });

  if (!rates) return json(500, { error: 'toll_rates_failed' });

  /** The cost of a route, or `null` when it cannot be worked out (say, a toll road with no rate, not even "default"). */
  const costOf = (found: Route): TripCost | null => {
    try {
      return tripCost(
        {
          distanceM: found.distanceM,
          tollSegments: found.tollSegments,
          electric,
          consumptionClPer100Km: consumption,
          fuelPriceMilliPerLitre: fuelPrice,
          roundTrip,
        },
        rates
      );
    } catch (error) {
      console.error('rides: cost failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  };

  /**
   * The routes to offer, each with its cost: the same for the quote and for the create (the routes come from the same
   * cache), so the ride is opened on exactly the road and price the driver picked. `null` when a cost fails.
   */
  const offeredRoutes = async () => {
    const candidates: Candidate[] = [];
    for (const found of await allRoutes(admin, origin, stadium)) {
      const cost = costOf(found);
      if (!cost) return null;
      candidates.push({ route: found, cost });
    }
    return chooseRoutes(candidates, roundTrip ? 2 : 1);
  };

  if (action === 'quote') {
    const limited = await takeLimit(admin, caller.user.id, QUOTE_LIMIT);
    if (limited === 'failed') return json(500, { error: 'rate_limit_failed' });
    if (limited === 'limited') return json(429, { error: 'rate_limited' });

    const choices = await offeredRoutes();
    if (!choices) return json(500, { error: 'cost_failed' });
    const quotes = choices.map(({ option, candidate: { route: found, cost } }) => ({
      option,
      // The motorways it takes, in order, free ones too ("A13", "A23", "A1"): which way the cheaper one goes.
      motorways: found.motorways,
      distance_m: found.distanceM,
      duration_s: found.durationS,
      toll_m: found.tollM,
      fuel_cents: cost.fuelCents,
      toll_cents: cost.tollCents,
      total_cents: cost.totalCents,
      // What each person pays with 1 (the driver alone) up to MAX_PEOPLE in the car.
      share_cents_by_people: Array.from({ length: MAX_PEOPLE }, (_, index) =>
        sharePerPersonCents(cost.totalCents, index + 1)
      ),
    }));
    if (quotes.length === 0) return json(404, { error: 'no_route' });
    return json(200, {
      quotes,
      attribution: 'Percursos: © contribuidores do OpenStreetMap, Valhalla (FOSSGIS)',
    });
  }

  // action === 'create'
  const option = body?.routeOption;
  const seats = wholeBetween(body?.seatsOffered, 1, 7);
  const originName = typeof body?.originName === 'string' ? body.originName.trim() : '';
  const departure = typeof body?.departureAt === 'string' ? Date.parse(body.departureAt) : NaN;
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const acceptedRules = body?.acceptedRules === true;
  // Seats home for fans who missed their transport: only on rides that come back anyway.
  const acceptsReturnRequests = body?.acceptsReturnRequests === true && roundTrip;
  const parkingSpotId =
    typeof body?.parkingSpotId === 'string' && /^[0-9a-f-]{36}$/.test(body.parkingSpotId)
      ? body.parkingSpotId
      : null;
  if (!acceptedRules) return json(422, { error: 'rules_not_accepted' });
  if (
    !isOption(option) ||
    seats === null ||
    originName.length < 2 ||
    originName.length > 80 ||
    note.length > 280 ||
    !Number.isFinite(departure)
  ) {
    return json(400, { error: 'bad_request' });
  }
  // Leaving between now and kick-off, and not days before it.
  if (
    departure - Date.now() < MIN_NOTICE_MS ||
    departure >= kickoff ||
    kickoff - departure > 3 * DAY_MS
  ) {
    return json(422, { error: 'bad_departure' });
  }

  // Suspended for no-shows or late cancellations; and the car park, when chosen, must be one we know near this
  // game's stadium. Both at once.
  const [ban, spot] = await Promise.all([
    admin.rpc('ride_ban_until', { p_profile_id: caller.user.id }),
    parkingSpotId
      ? admin.from('parking_spot').select('id, venue_id').eq('id', parkingSpotId).maybeSingle()
      : Promise.resolve(null),
  ]);
  if (ban.error) return json(500, { error: 'ban_check_failed' });
  if (ban.data) return json(403, { error: 'suspended', until: ban.data });
  if (spot && (spot.error || !spot.data || spot.data.venue_id !== fixture.data.venue_id)) {
    return json(400, { error: 'bad_parking' });
  }

  const limited = await takeLimit(admin, caller.user.id, CREATE_LIMIT);
  if (limited === 'failed') return json(500, { error: 'rate_limit_failed' });
  if (limited === 'limited') return json(429, { error: 'rate_limited' });

  // Para onde a boleia volta: o concelho de onde saiu. É o que deixa a app mostrar «quem volta para Viseu» no fim
  // do jogo. Se não se souber, a boleia entra na mesma sem destino — é só uma etiqueta. Pedido ao mesmo tempo que
  // o caminho.
  const [choices, originCity] = await Promise.all([offeredRoutes(), reverseCity(admin, origin)]);
  if (!choices) return json(500, { error: 'cost_failed' });
  // The option the driver picked, recomputed here: never the app's numbers. Gone (the routes changed since the quote,
  // say a month later) means asking for the routes again.
  const chosen = choices.find((choice) => choice.option === option);
  if (!chosen) return json(404, { error: 'no_route' });
  const { route: found, cost } = chosen.candidate;

  const inserted = await admin
    .from('ride')
    .insert({
      fixture_id: fixtureId,
      driver_id: caller.user.id,
      origin_name: originName,
      origin: `SRID=4326;POINT(${origin.longitude} ${origin.latitude})`,
      origin_city: originCity,
      departure_at: new Date(departure).toISOString(),
      seats_offered: seats,
      route_option: option,
      round_trip: roundTrip,
      distance_m: found.distanceM,
      duration_s: found.durationS,
      toll_m: found.tollM,
      energy: electric ? 'eletrico' : 'combustivel',
      consumption_cl_per_100km: electric ? null : consumption,
      fuel_price_milli_per_litre: electric ? null : fuelPrice,
      fuel_cents: cost.fuelCents,
      toll_cents: cost.tollCents,
      total_cents: cost.totalCents,
      // Three points along the chosen road, so «ver o caminho» opens Maps on this road and not on its own pick.
      route_via: found.viaPoints,
      note: note || null,
      parking_spot_id: parkingSpotId,
      accepts_return_requests: acceptsReturnRequests,
      rules_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (inserted.error?.code === '23505') return json(409, { error: 'already_offering' });
  // The database trigger (one car per game) as the last word, if a seat was taken in the meantime.
  if (inserted.error?.message === 'already_going') return json(409, { error: 'already_going' });
  if (inserted.error) return json(500, { error: 'create_failed' });
  return json(200, { id: inserted.data.id });
});
