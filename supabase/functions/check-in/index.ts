// Check-in at a tasco, verified by distance. Called by the app with the user's session.
// The phone sends its position once: it is only used here to measure the distance to the place, then dropped. It is
// never stored, logged or returned. Presence lives in public.checkin (changed only through start_checkin and
// end_checkin), and every change refreshes the public aggregates in public.place_pulse.
//
// Who said yes to it (profile.share_checkins_with_groups) also tells their groups which tasco they checked in at —
// the place's name only, as an «estou aqui» message. Nobody else's check-ins are ever read.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';
import { checkPresence, parseCheckInBody, type CheckInBody } from '../_shared/check-in-rules.ts';

const RATE_LIMIT = { bucket: 'check-in', limit: 30, window: '1 hour' } as const;

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

  let body: CheckInBody | null = null;
  try {
    body = parseCheckInBody(await request.json());
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

  const presence = checkPresence(body, { latitude: row.latitude, longitude: row.longitude });
  if (!presence.ok) {
    return json(
      422,
      presence.error === 'too_far'
        ? { error: 'too_far', distance_m: presence.distance_m }
        : { error: presence.error }
    );
  }

  const started = await admin.rpc('start_checkin', {
    p_profile_id: caller.user.id,
    p_place_id: body.placeId,
  });
  const result = asRecord(started.data);
  if (started.error || !result) return json(500, { error: 'check_in_failed' });

  // Telling the groups never fails the check-in itself.
  const shared = await admin.rpc('share_checkin_with_groups', {
    p_profile_id: caller.user.id,
    p_place_id: body.placeId,
  });

  return json(200, {
    status: 'checked-in',
    shared_groups: typeof shared.data === 'number' ? shared.data : 0,
    visit_id: result.visit_id,
    visited_at: result.visited_at,
    expires_at: result.expires_at,
  });
});
