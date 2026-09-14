// Deletes the account of the user who calls it. The service role key only exists here, never in the app.
// The caller is authenticated below (verify_jwt is off so it also works with the new API keys). Deleting is
// permanent, so the session must have signed in during the last 10 minutes: the app asks for the password again
// right before calling this, and a stolen or long-lived session cannot delete the account.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

const REAUTHENTICATION_WINDOW_MS = 10 * 60 * 1000;

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

/**
 * When the session behind an access token last signed in (ms), from the token's `amr` claim; `null` if missing.
 * Only call it with a token that `auth.getUser` has already accepted.
 */
function signedInAt(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = asRecord(JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))));
    const methods = Array.isArray(claims?.amr) ? claims.amr : [];
    const times = methods
      .map((method) => asRecord(method)?.timestamp)
      .filter((time): time is number => typeof time === 'number' && Number.isFinite(time));
    return times.length > 0 ? Math.max(...times) * 1000 : null;
  } catch {
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'not_authenticated' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return json(500, { error: 'misconfigured' });

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only a valid user access token passes: the publishable key or an expired session do not.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json(401, { error: 'not_authenticated' });

  const signedIn = signedInAt(token);
  if (signedIn === null || Date.now() - signedIn > REAUTHENTICATION_WINDOW_MS) {
    return json(403, { error: 'reauthentication_required' });
  }

  // Everything the user created goes with the auth user (on delete cascade).
  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('delete-account failed:', deleteError.message);
    return json(500, { error: 'delete_failed' });
  }

  return json(200, { deleted: true });
});
