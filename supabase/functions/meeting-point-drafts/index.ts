// Publishes or dismisses a meeting point draft. Admins only (profile.is_admin), with their session.
// On publish, the place is located with OpenStreetMap's geocoder (Nominatim, light use) so the app can show it on a
// map and walk fans there; if it cannot be found, it is published without coordinates.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { authenticatedCaller } from '../_shared/auth.ts';
import { assuranceLevel } from '../_shared/reauthentication.ts';

const GEOCODER = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AwayDay/1.0 (meeting point publishing for a match-day app)';
const ORIGINS = ['clube', 'camara', 'policia'];

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

/** Trimmed text within limits, or null. */
function field(value: unknown, min: number, max: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

async function geocode(query: string) {
  try {
    const response = await fetch(`${GEOCODER}?format=json&limit=1&q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-PT' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const first = asRecord(((await response.json()) as unknown[])[0]);
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch {
    return null;
  }
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
  const profile = await admin
    .from('profile')
    .select('is_admin')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (profile.error) return json(500, { error: 'profile_failed' });
  if (asRecord(profile.data)?.is_admin !== true) return json(403, { error: 'not_admin' });
  // Admin powers need the second factor (authenticator app), like is_admin() in the database.
  if (assuranceLevel(caller.token) !== 'aal2') return json(403, { error: 'needs_second_factor' });

  const body = asRecord(await request.json().catch(() => null));
  const draftId = field(body?.draftId, 36, 36);
  if (!draftId || (body?.action !== 'approve' && body?.action !== 'dismiss')) {
    return json(400, { error: 'bad_request' });
  }

  const draft = await admin
    .from('meeting_point_draft')
    .select('id, fixture_id, source_url, source_title, status')
    .eq('id', draftId)
    .maybeSingle();
  const row = asRecord(draft.data);
  if (draft.error || !row) return json(404, { error: 'draft_not_found' });
  if (row.status !== 'pending') return json(409, { error: 'already_decided' });

  const decision = { decided_at: new Date().toISOString(), decided_by: caller.user.id };

  if (body.action === 'dismiss') {
    const updated = await admin
      .from('meeting_point_draft')
      .update({ status: 'dismissed', ...decision })
      .eq('id', draftId);
    return updated.error
      ? json(500, { error: 'update_failed' })
      : json(200, { status: 'dismissed' });
  }

  const name = field(body.name, 2, 120);
  const address = field(body.address, 2, 200);
  const schedule = field(body.schedule, 2, 300);
  const transport = field(body.transport, 2, 500);
  const note = body.note === null || body.note === '' ? null : field(body.note, 1, 800);
  const origin =
    typeof body.origin === 'string' && ORIGINS.includes(body.origin) ? body.origin : null;
  const publishedBy = field(body.publishedBy, 2, 80);
  const publishedOn =
    typeof body.publishedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.publishedOn)
      ? body.publishedOn
      : null;
  if (!name || !address || !schedule || !transport || !origin || !publishedBy || !publishedOn) {
    return json(422, { error: 'invalid_fields' });
  }
  if (body.note !== null && body.note !== undefined && body.note !== '' && note === null) {
    return json(422, { error: 'invalid_fields' });
  }

  const point = await geocode(`${name}, ${address}`);
  const upserted = await admin.from('fixture_meeting_point').upsert(
    {
      fixture_id: row.fixture_id,
      name,
      address,
      schedule,
      transport,
      note,
      origin,
      published_by: publishedBy,
      source_title: String(row.source_title).slice(0, 160),
      source_url: row.source_url,
      published_on: publishedOn,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
    },
    { onConflict: 'fixture_id' }
  );
  if (upserted.error) return json(500, { error: 'publish_failed' });

  await admin
    .from('meeting_point_draft')
    .update({ status: 'approved', ...decision })
    .eq('id', draftId);
  return json(200, { status: 'approved', located: point !== null });
});
