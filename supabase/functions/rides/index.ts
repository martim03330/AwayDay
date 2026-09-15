// Rides to a game (slice 3), for signed-in fans:
// - action "quote": the car routes from a meeting point to the stadium (fastest, balanced, without tolls) with what
//   each costs in fuel and tolls and the price per person as seats fill up;
// - action "create": opens a ride on one of those routes. The cost is computed here again, never taken from the app.
// Routes come from the public Valhalla router of the FOSSGIS / OpenStreetMap community (no key, fair use), so the
// app never calls it. The meeting point is a public place the driver picks; it is not logged.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';
import {
  sharePerPersonCents,
  tripCost,
  type TollRate,
  type TollSegment,
} from '../_shared/ride-cost.ts';

const ROUTER = 'https://valhalla1.openstreetmap.de/route';
const USER_AGENT = 'AwayDay/1.0 (match-day app for football fans)';
const QUOTE_LIMIT = { bucket: 'ride-quote', limit: 30, window: '1 hour' } as const;
const CREATE_LIMIT = { bucket: 'ride-create', limit: 10, window: '1 day' } as const;
/** A car trip to a game, not a road trip across the continent. */
const MAX_STRAIGHT_LINE_M = 2_500_000;
const MAX_PEOPLE = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How much the router avoids tolls for each option: 1 does not care, 0 avoids them whenever it can. */
const OPTIONS = [
  { option: 'rapida', useTolls: 1 },
  { option: 'equilibrio', useTolls: 0.2 },
  { option: 'sem_portagens', useTolls: 0 },
] as const;

type RouteOption = (typeof OPTIONS)[number]['option'];
type Point = { latitude: number; longitude: number };
type Route = { distanceM: number; durationS: number; tollM: number; tollSegments: TollSegment[] };

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

/** "A 1" -> "A1"; anything that is not a motorway reference counts under the default rate. */
function motorwayOf(names: unknown) {
  const list = Array.isArray(names) ? names : [];
  for (const name of list) {
    if (typeof name !== 'string') continue;
    const match = /^A\s?(\d+(?:-\d+)?)$/.exec(name.trim());
    if (match) return `A${match[1]}`;
  }
  return 'default';
}

async function route(from: Point, to: Point, useTolls: number): Promise<Route | null> {
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
    const trip = asRecord(asRecord(await response.json())?.trip);
    const summary = asRecord(trip?.summary);
    const lengthKm = summary?.length;
    const timeS = summary?.time;
    if (typeof lengthKm !== 'number' || typeof timeS !== 'number') return null;

    const segments: TollSegment[] = [];
    for (const legValue of Array.isArray(trip?.legs) ? trip.legs : []) {
      const leg = asRecord(legValue);
      for (const maneuverValue of Array.isArray(leg?.maneuvers) ? leg.maneuvers : []) {
        const maneuver = asRecord(maneuverValue);
        if (maneuver?.toll !== true || typeof maneuver.length !== 'number') continue;
        segments.push({
          motorway: motorwayOf(maneuver.street_names),
          tollM: Math.round(maneuver.length * 1000),
        });
      }
    }
    return {
      distanceM: Math.max(Math.round(lengthKm * 1000), 1),
      durationS: Math.max(Math.round(timeS), 1),
      tollM: segments.reduce((total, segment) => total + segment.tollM, 0),
      tollSegments: segments,
    };
  } catch {
    return null;
  }
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
  const fixtureId = typeof body?.fixtureId === 'string' ? body.fixtureId : null;
  const origin = toPoint(body?.origin);
  const consumption = wholeBetween(body?.consumptionClPer100Km, 200, 2500);
  const fuelPrice = wholeBetween(body?.fuelPriceMilliPerLitre, 500, 4000);
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

  const rates = await tollRates(admin);
  if (!rates) return json(500, { error: 'toll_rates_failed' });

  const costOf = (found: Route) =>
    tripCost(
      {
        distanceM: found.distanceM,
        tollSegments: found.tollSegments,
        consumptionClPer100Km: consumption,
        fuelPriceMilliPerLitre: fuelPrice,
        roundTrip,
      },
      rates
    );

  if (action === 'quote') {
    const limited = await takeLimit(admin, caller.user.id, QUOTE_LIMIT);
    if (limited === 'failed') return json(500, { error: 'rate_limit_failed' });
    if (limited === 'limited') return json(429, { error: 'rate_limited' });

    const routes = await Promise.all(
      OPTIONS.map(async ({ option, useTolls }) => ({
        option,
        found: await route(origin, stadium, useTolls),
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
  if (departure <= Date.now() || departure >= kickoff || kickoff - departure > 3 * DAY_MS) {
    return json(422, { error: 'bad_departure' });
  }

  const limited = await takeLimit(admin, caller.user.id, CREATE_LIMIT);
  if (limited === 'failed') return json(500, { error: 'rate_limit_failed' });
  if (limited === 'limited') return json(429, { error: 'rate_limited' });

  const useTolls = OPTIONS.find((candidate) => candidate.option === option)?.useTolls ?? 1;
  const found = await route(origin, stadium, useTolls);
  if (!found) return json(404, { error: 'no_route' });
  const cost = costOf(found);

  const inserted = await admin
    .from('ride')
    .insert({
      fixture_id: fixtureId,
      driver_id: caller.user.id,
      origin_name: originName,
      origin: `SRID=4326;POINT(${origin.longitude} ${origin.latitude})`,
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
    })
    .select('id')
    .single();
  if (inserted.error) return json(500, { error: 'create_failed' });
  return json(200, { id: inserted.data.id });
});
