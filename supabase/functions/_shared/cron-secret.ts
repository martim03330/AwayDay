// The pg_cron check of auth.ts, on its own so the app's tests can load it without the Supabase client.

type DenoEnv = { env: { get(name: string): string | undefined } };

function readEnv(name: string): string | undefined {
  // Through globalThis so Node (the tests) can load this file; on Deno this is the real Deno.env.
  const deno = (globalThis as unknown as { Deno?: DenoEnv }).Deno;
  return deno?.env.get(name);
}

/** Whether the request carries CRON_SECRET in `x-cron-secret`. Always `false` while the secret is not set. */
export function hasCronSecret(request: Request): boolean {
  const expected = readEnv('CRON_SECRET') ?? '';
  const provided = request.headers.get('x-cron-secret') ?? '';
  if (!expected || expected.length !== provided.length) return false;
  // Constant time: how long the comparison takes says nothing about how much of the secret matched.
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return difference === 0;
}
