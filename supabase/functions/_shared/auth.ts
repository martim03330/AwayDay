// Who may call an Edge Function. Every function has verify_jwt off (so it also works with the new API keys), so
// each one must check the caller itself, before touching any data, with one of these:
// - authenticatedCaller: functions called by the app, with the user's session;
// - hasCronSecret: functions called by pg_cron;
// - hasNotifySecret: the notification functions called by database triggers.

import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2.116.0';

export { hasCronSecret, hasNotifySecret } from './cron-secret.ts';

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
