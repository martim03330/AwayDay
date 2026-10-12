// The shared-secret checks of auth.ts, on their own so the app's tests can load them without the Supabase client.
//
// - CRON_SECRET in `x-cron-secret`: functions run by pg_cron (fixtures, weather, nudges, recaps, meeting points).
// - NOTIFY_SECRET in `x-notify-secret`: the notification functions called by database triggers. A separate secret,
//   so a leak of one does not open the other; and those functions only take row ids, which they read again.

type DenoEnv = { env: { get(name: string): string | undefined } };

function readEnv(name: string): string | undefined {
  // Through globalThis so Node (the tests) can load this file; on Deno this is the real Deno.env.
  const deno = (globalThis as unknown as { Deno?: DenoEnv }).Deno;
  return deno?.env.get(name);
}

/** Whether `header` carries exactly the secret in env `name`. Always `false` while the secret is not set. */
function hasSecret(request: Request, name: string, header: string): boolean {
  const expected = readEnv(name) ?? '';
  const provided = request.headers.get(header) ?? '';
  if (!expected) return false;
  // Constant time, also in the length: how long the comparison takes says nothing about how much of the secret
  // matched, nor about how long it is.
  let difference = expected.length ^ provided.length;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ (provided.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/** Whether the request carries CRON_SECRET in `x-cron-secret`. */
export function hasCronSecret(request: Request): boolean {
  return hasSecret(request, 'CRON_SECRET', 'x-cron-secret');
}

/** Whether the request carries NOTIFY_SECRET in `x-notify-secret`. */
export function hasNotifySecret(request: Request): boolean {
  return hasSecret(request, 'NOTIFY_SECRET', 'x-notify-secret');
}
