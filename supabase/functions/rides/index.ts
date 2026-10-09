// Rides to a game (slice 3), for signed-in fans:
// - action "quote": the car routes from a meeting point to the stadium (fastest, balanced, without tolls) with what
//   each costs in fuel and tolls and the price per person as seats fill up;
// - action "create": opens a ride on one of those routes. The cost is computed here again, never taken from the app;
// - action "search": streets and places for the meeting point (OpenStreetMap Nominatim), when the driver searches.
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
import { routeFromCache, routeFromValhalla, type Route } from '../_shared/route-parse.ts';

const ROUTER = 'https://valhalla1.openstreetmap.de/route';
const GEOCODER = 'https://nominatim.openstreetmap.org/search';
/** Fallback geocoder (Photon, by Komoot, on OpenStreetMap data). */
const FALLBACK_GEOCODER = 'https://photon.komoot.io/api/';
const USER_AGENT = 'AwayDay/1.0 (match-day app for football fans)';
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

/** How much the router avoids tolls for each option: 1 does not care, 0 avoids them whenever it can. */
const OPTIONS = [
  { option: 'rapida', useTolls: 1 },
  { option: 'equilibrio', useTolls: 0.2 },
  { option: 'sem_portagens', useTolls: 0 },
] as const;

type RouteOption = (typeof OPTIONS)[number]['option'];
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
  return OPTIONS.some((candidate) => candidate.option === value);
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

async function routeValhalla(from: Point, to: Point, useTolls: number): Promise<Route | null> {
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
        directions_options: { units: 'kilometers' },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return routeFromValhalla(await response.json());
  } catch {
    return null;
  }
}

/** ~100 m: two meeting points this close share a route. */
const coord = (value: number) => value.toFixed(3);

/**
 * A route from cache, or from Valhalla, then cached for 30 days. There is no fallback router on purpose: the free
 * ones (OSRM) know nothing about tolls, and a ride price without tolls would be wrong money for real people.
 */
async function route(admin: SupabaseClient, from: Point, to: Point, useTolls: number): Promise<Route | null> {
  const key = `${coord(from.latitude)},${coord(from.longitude)}>${coord(to.latitude)},${coord(to.longitude)}:${useTolls}`;
  const cached = await admin
    .from('route_cache')
    .select('distance_m, duration_s, toll_segments')
    .eq('key', key)
    .gte('created_at', new Date(Date.now() - 30 * DAY_MS).toISOString())
    .maybeSingle();
  // A malformed row is ignored: the route is asked again and the upsert below overwrites it.
  const fromCache = cached.data ? routeFromCache(cached.data) : null;
  if (fromCache) return fromCache;
  if (cached.data) console.error('rides: discarding malformed route_cache row', key);
  const found = await routeValhalla(from, to, useTolls);
  if (found) {
    await admin.from('route_cache').upsert({
      key,
      distance_m: found.distanceM,
      duration_s: found.durationS,
      toll_segments: found.tollSegments,
      created_at: new Date().toISOString(),
    });
  }
  return found;
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
  const fixtureId = typeof body?.fixtureId === 'string' ? body.fixtureId : null;
  const origin = toPoint(body?.origin);
  // Realistic bounds (3–15 L/100 km, 1,000–2,600 €/L): the driver cannot inflate what the passengers pay.
  const consumption = wholeBetween(body?.consumptionClPer100Km, 300, 1500);
  const fuelPrice = wholeBetween(body?.fuelPriceMilliPerLitre, 1000, 2600);
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

  const fixture = await admin
    .from('fixture')
    .select('id, kickoff_at, venue:venue_id (latitude, longitude)')
    .eq('id', fixtureId)
    .maybeSingle();
  const venue = asRecord(fixture.data?.venue);
  const stadium = toPoint({ latitude: venue?.latitude, longitude: venue?.longitude });
  if (fixture.error || !fixture.data || !stadium) return json(404, { error: 'fixture_not_found' });
  const kickoff = Date.parse(String(fixture.data.kickoff_at));
  if (!(kickoff > Date.now())) return json(422, { error: 'fixture_started' });
  if (straightLineM(origin, stadium) > MAX_STRAIGHT_LINE_M) return json(422, { error: 'too_far' });

  // One open ride per driver per game (also enforced by a unique index).
  const existing = await admin
    .from('ride')
    .select('id')
    .eq('fixture_id', fixtureId)
    .eq('driver_id', caller.user.id)
    .eq('status', 'open')
    .limit(1);
  if (existing.error) return json(500, { error: 'lookup_failed' });
  if (existing.data.length > 0) {
    return json(409, { error: 'already_offering', id: existing.data[0].id });
  }

  const rates = await tollRates(admin);
  if (!rates) return json(500, { error: 'toll_rates_failed' });

  /** The cost of a route, or `null` when it cannot be worked out (say, a toll road with no rate, not even "default"). */
  const costOf = (found: Route): TripCost | null => {
    try {
      return tripCost(
        {
          distanceM: found.distanceM,
          tollSegments: found.tollSegments,
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

  if (action === 'quote') {
    const limited = await takeLimit(admin, caller.user.id, QUOTE_LIMIT);
    if (limited === 'failed') return json(500, { error: 'rate_limit_failed' });
    if (limited === 'limited') return json(429, { error: 'rate_limited' });

    const routes = await Promise.all(
      OPTIONS.map(async ({ option, useTolls }) => ({
        option,
        found: await route(admin, origin, stadium, useTolls),
      }))
    );
    const quotes: Record<string, unknown>[] = [];
    for (const { option, found } of routes) {
      if (!found) continue;
      // The balanced route is often the same as one of the others: show it once.
      const same = quotes.some(
        (quote) =>
          Math.abs(Number(quote.distance_m) - found.distanceM) <= found.distanceM * 0.01 &&
          Math.abs(Number(quote.toll_m) - found.tollM) <= 1000
      );
      if (same) continue;
      const cost = costOf(found);
      if (!cost) return json(500, { error: 'cost_failed' });
      quotes.push({
        option,
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
      });
    }
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

  // Suspended for no-shows or late cancellations.
  const ban = await admin.rpc('ride_ban_until', { p_profile_id: caller.user.id });
  if (ban.error) return json(500, { error: 'ban_check_failed' });
  if (ban.data) return json(403, { error: 'suspended', until: ban.data });

  // The car park, when chosen, must be one we know near this game's stadium.
  if (parkingSpotId) {
    const spot = await admin
      .from('parking_spot')
      .select('id, venue_id')
      .eq('id', parkingSpotId)
      .maybeSingle();
    const venueId = await admin
      .from('fixture')
      .select('venue_id')
      .eq('id', fixtureId)
      .maybeSingle();
    if (
      spot.error ||
      venueId.error ||
      !spot.data ||
      spot.data.venue_id !== venueId.data?.venue_id
    ) {
      return json(400, { error: 'bad_parking' });
    }
  }

  const limited = await takeLimit(admin, caller.user.id, CREATE_LIMIT);
  if (limited === 'failed') return json(500, { error: 'rate_limit_failed' });
  if (limited === 'limited') return json(429, { error: 'rate_limited' });

  const useTolls = OPTIONS.find((candidate) => candidate.option === option)?.useTolls ?? 1;
  const found = await route(admin, origin, stadium, useTolls);
  if (!found) return json(404, { error: 'no_route' });
  const cost = costOf(found);
  if (!cost) return json(500, { error: 'cost_failed' });

  // Para onde a boleia volta: o concelho de onde saiu. É o que deixa a app mostrar «quem volta para Viseu» no fim
  // do jogo. Se não se souber, a boleia entra na mesma sem destino — é só uma etiqueta.
  const originCity = await reverseCity(admin, origin);

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
      consumption_cl_per_100km: consumption,
      fuel_price_milli_per_litre: fuelPrice,
      fuel_cents: cost.fuelCents,
      toll_cents: cost.tollCents,
      total_cents: cost.totalCents,
      note: note || null,
      parking_spot_id: parkingSpotId,
      accepts_return_requests: acceptsReturnRequests,
      rules_accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (inserted.error?.code === '23505') return json(409, { error: 'already_offering' });
  if (inserted.error) return json(500, { error: 'create_failed' });
  return json(200, { id: inserted.data.id });
});
