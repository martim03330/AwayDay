// Who may call an Edge Function. Every function has verify_jwt off (so it also works with the new API keys), so
// each one must check the caller itself, before touching any data, with one of these:
// - authenticatedCaller: functions called by the app, with the user's session;
// - hasCronSecret: functions called by pg_cron.

import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2.116.0';

export type Caller = {
  user: User;
  /** The access token, already accepted by Supabase Auth. */
  token: string;
};

/**
 * The signed-in user behind the request, or `null` (answer 401). Only a valid user access token passes: the
 * publishable key, an expired session or a made-up token do not.
 */
export async function authenticatedCaller(request: Request, admin: SupabaseClient): Promise<Caller | null> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : { user: data.user, token };
}

/** Whether the request carries CRON_SECRET in `x-cron-secret`. Always `false` while the secret is not set. */
export function hasCronSecret(request: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET') ?? '';
  const provided = request.headers.get('x-cron-secret') ?? '';
  if (!expected || expected.length !== provided.length) return false;
  // Constant time: how long the comparison takes says nothing about how much of the secret matched.
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}
