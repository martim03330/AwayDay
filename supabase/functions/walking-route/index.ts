// Walking route between two points, for "Levar-me até lá" (the official meeting point; later tascos and stadiums).
// Uses the public OSRM foot router of the FOSSGIS / OpenStreetMap community (no key, fair use), so the app never calls
// a third-party service itself. The phone's position is only used to ask for the route: never stored, never logged.
// Signed-in callers are rate limited per account; anonymous callers per network address, in memory only.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';

const ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const USER_AGENT = 'AwayDay/1.0 (match-day app for football fans)';
/** Walking only makes sense up to here (straight line). */
const MAX_DISTANCE_M = 30_000;
const ACCOUNT_LIMIT = { bucket: 'walking-route', limit: 60, window: '1 hour' } as const;
const ANONYMOUS_LIMIT_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

/** Anonymous hits per network address in this instance. Never persisted; forgotten when the instance stops. */
const anonymousHits = new Map<string, number[]>();

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

function straightLineM(from: Point, to: Point) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(to.latitude - from.latitude);
  const dLng = rad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

function anonymousAllowed(request: Request) {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recent = (anonymousHits.get(address) ?? []).filter((at) => now - at < HOUR_MS);
  if (recent.length >= ANONYMOUS_LIMIT_PER_HOUR) {
    anonymousHits.set(address, recent);
    return false;
  }
  recent.push(now);
  anonymousHits.set(address, recent);
  return true;
}

const MODIFIERS: Readonly<Record<string, string>> = {
  left: 'à esquerda',
  right: 'à direita',
  'slight left': 'ligeiramente à esquerda',
  'slight right': 'ligeiramente à direita',
  'sharp left': 'bem à esquerda',
  'sharp right': 'bem à direita',
};

/** OSRM maneuver -> a short instruction in Portuguese from Portugal. */
function instruction(maneuver: Readonly<Record<string, unknown>> | null, name: string) {
  const type = typeof maneuver?.type === 'string' ? maneuver.type : '';
  const modifier = typeof maneuver?.modifier === 'string' ? maneuver.modifier : '';
  const onto = name ? ` para ${name}` : '';
  if (type === 'depart') return name ? `Começa por ${name}` : 'Começa a andar';
  if (type === 'arrive') return 'Chegaste ao destino';
  if (type === 'roundabout' || type === 'rotary') {
    const exit = typeof maneuver?.exit === 'number' ? maneuver.exit : null;
    return exit ? `Na rotunda, sai na ${exit}.ª saída${onto}` : `Contorna a rotunda${onto}`;
  }
  if (modifier === 'uturn') return `Dá meia-volta${onto}`;
  const direction = MODIFIERS[modifier];
  if (!direction || type === 'new name' || type === 'continue') return `Segue em frente${onto}`;
  return `Vira ${direction}${onto}`;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = asRecord(await request.json().catch(() => null));
  const from = toPoint(body?.from);
  const to = toPoint(body?.to);
  if (!from || !to) return json(400, { error: 'bad_request' });
  if (straightLineM(from, to) > MAX_DISTANCE_M) return json(422, { error: 'too_far' });

  const caller = await authenticatedCaller(request, admin);
  if (caller) {
    const allowed = await admin.rpc('take_rate_limit', {
      p_profile_id: caller.user.id,
      p_bucket: ACCOUNT_LIMIT.bucket,
      p_limit: ACCOUNT_LIMIT.limit,
      p_window: ACCOUNT_LIMIT.window,
    });
    if (allowed.error) return json(500, { error: 'rate_limit_failed' });
    if (allowed.data !== true) return json(429, { error: 'rate_limited' });
  } else if (!anonymousAllowed(request)) {
    return json(429, { error: 'rate_limited' });
  }

  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  let answer: Readonly<Record<string, unknown>> | null = null;
  try {
    const response = await fetch(
      `${ROUTER}/${coordinates}?overview=full&geometries=geojson&steps=true`,
      { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) return json(502, { error: 'router_failed' });
    answer = asRecord(await response.json());
  } catch {
    return json(502, { error: 'router_failed' });
  }

  const route = asRecord(Array.isArray(answer?.routes) ? answer.routes[0] : null);
  const geometry = asRecord(route?.geometry);
  if (answer?.code !== 'Ok' || !route || !Array.isArray(geometry?.coordinates)) {
    return json(404, { error: 'no_route' });
  }

  // GeoJSON is [longitude, latitude]; the app wants latitude first.
  const path = geometry.coordinates.flatMap((pair) =>
    Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number'
      ? [[pair[1], pair[0]]]
      : []
  );
  const leg = asRecord(Array.isArray(route.legs) ? route.legs[0] : null);
  const steps = (Array.isArray(leg?.steps) ? leg.steps : []).flatMap((item) => {
    const step = asRecord(item);
    if (!step) return [];
    const name = typeof step.name === 'string' ? step.name : '';
    return [
      {
        instruction: instruction(asRecord(step.maneuver), name),
        distance_m: typeof step.distance === 'number' ? Math.round(step.distance) : 0,
      },
    ];
  });

  return json(200, {
    distance_m: typeof route.distance === 'number' ? Math.round(route.distance) : null,
    duration_s: typeof route.duration === 'number' ? Math.round(route.duration) : null,
    path,
    steps,
    attribution: 'Percurso: © contribuidores do OpenStreetMap, OSRM (FOSSGIS)',
  });
});
