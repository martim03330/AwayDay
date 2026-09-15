// Check-in at a tasco, verified by distance. Called by the app with the user's session.
// The phone sends its position once: it is only used here to measure the distance to the place, then dropped. It is
// never stored, logged or returned. Presence lives in public.checkin (changed only through start_checkin and
// end_checkin), and every change refreshes the public aggregates in public.place_pulse.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';

/** How far from the place a check-in still counts. */
const MAX_DISTANCE_M = 150;
/** Positions less precise than this are refused: they could put someone in the tasco next door. */
const MAX_ACCURACY_M = 100;
const RATE_LIMIT = { bucket: 'check-in', limit: 30, window: '1 hour' } as const;
const PLACE_ID = /^[a-z0-9-]{1,120}$/;
const EARTH_RADIUS_M = 6_371_000;

type Body =
  | { action: 'check-in'; placeId: string; latitude: number; longitude: number; accuracy: number }
  | { action: 'check-out'; placeId: string };

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

function finiteBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function parseBody(value: unknown): Body | null {
  const body = asRecord(value);
  if (!body || typeof body.placeId !== 'string' || !PLACE_ID.test(body.placeId)) return null;
  if (body.action === 'check-out') return { action: 'check-out', placeId: body.placeId };
  if (
    body.action !== 'check-in' ||
    !finiteBetween(body.latitude, -90, 90) ||
    !finiteBetween(body.longitude, -180, 180) ||
    !finiteBetween(body.accuracy, 0, 100_000)
  ) {
    return null;
  }
  return {
    action: 'check-in',
    placeId: body.placeId,
    latitude: body.latitude,
    longitude: body.longitude,
    accuracy: body.accuracy,
  };
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Straight-line distance in metres (haversine). */
function distanceM(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
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
  if (!caller) return json(401, { error: 'not_authenticated' });

  let body: Body | null = null;
  try {
    body = parseBody(await request.json());
  } catch {
    body = null;
  }
  if (!body) return json(400, { error: 'bad_request' });

  const allowed = await admin.rpc('take_rate_limit', {
    p_profile_id: caller.user.id,
    p_bucket: RATE_LIMIT.bucket,
    p_limit: RATE_LIMIT.limit,
    p_window: RATE_LIMIT.window,
  });
  if (allowed.error) return json(500, { error: 'rate_limit_failed' });
  if (allowed.data !== true) return json(429, { error: 'rate_limited' });

  if (body.action === 'check-out') {
    const ended = await admin.rpc('end_checkin', {
      p_profile_id: caller.user.id,
      p_place_id: body.placeId,
    });
    if (ended.error) return json(500, { error: 'check_out_failed' });
    return json(200, { status: 'checked-out', ended: ended.data === true });
  }

  const place = await admin
    .from('place')
    .select('id, latitude, longitude, confirmation')
    .eq('id', body.placeId)
    .maybeSingle();
  if (place.error) return json(500, { error: 'place_failed' });
  const row = asRecord(place.data);
  if (
    !row ||
    row.confirmation === 'rejected' ||
    typeof row.latitude !== 'number' ||
    typeof row.longitude !== 'number'
  ) {
    return json(404, { error: 'place_not_found' });
  }

  if (body.accuracy > MAX_ACCURACY_M) return json(422, { error: 'low_accuracy' });

  const distance = distanceM(
    { lat: body.latitude, lng: body.longitude },
    { lat: row.latitude, lng: row.longitude }
  );
  if (distance > MAX_DISTANCE_M) {
    // Rounded to 50 m: enough to say "you are 400 m away", not a precise position.
    return json(422, { error: 'too_far', distance_m: Math.round(distance / 50) * 50 });
  }

  const started = await admin.rpc('start_checkin', {
    p_profile_id: caller.user.id,
    p_place_id: body.placeId,
  });
  const result = asRecord(started.data);
  if (started.error || !result) return json(500, { error: 'check_in_failed' });

  return json(200, {
    status: 'checked-in',
    visit_id: result.visit_id,
    visited_at: result.visited_at,
    expires_at: result.expires_at,
  });
});
