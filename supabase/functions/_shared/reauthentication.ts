// When the session behind an access token last signed in, for actions that need a fresh sign-in (delete-account).
// Pure (no Deno or network APIs) so the app's tests can load it.

/** Deleting the account (and anything as permanent) needs a sign-in in the last 10 minutes. */
export const REAUTHENTICATION_WINDOW_MS = 10 * 60 * 1000;

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

/**
 * When the session behind an access token last signed in (ms), from the newest timestamp in the token's `amr`
 * claim; `null` if missing or malformed. Only call it with a token that `auth.getUser` has already accepted: this
 * reads the payload, it does not verify the signature.
 */
export function signedInAt(token: string): number | null {
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

/** Whether the token's session signed in within the reauthentication window, as of `now` (ms). */
export function signedInRecently(token: string, now: number): boolean {
  const signedIn = signedInAt(token);
  return signedIn !== null && now - signedIn <= REAUTHENTICATION_WINDOW_MS;
}

/**
 * The token's assurance level: 'aal2' after a second factor (authenticator app), 'aal1' with the password only, `null`
 * if missing or malformed. Admin powers need 'aal2'. Same caveat as signedInAt: only for a token already accepted.
 */
export function assuranceLevel(token: string): 'aal1' | 'aal2' | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const aal = asRecord(JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/'))))?.aal;
    return aal === 'aal1' || aal === 'aal2' ? aal : null;
  } catch {
    return null;
  }
}
