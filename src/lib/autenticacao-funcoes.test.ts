import { afterEach, describe, expect, it } from 'vitest';

import { hasCronSecret } from '../../supabase/functions/_shared/cron-secret';
import {
  assuranceLevel,
  REAUTHENTICATION_WINDOW_MS,
  signedInAt,
  signedInRecently,
} from '../../supabase/functions/_shared/reauthentication';

type DenoStub = { env: { get(name: string): string | undefined } };
const globalWithDeno = globalThis as unknown as { Deno?: DenoStub };

function stubSecret(secret: string | undefined) {
  globalWithDeno.Deno = { env: { get: (name) => (name === 'CRON_SECRET' ? secret : undefined) } };
}

const request = (header?: string) =>
  new Request('https://example.test/fn', {
    method: 'POST',
    headers: header === undefined ? {} : { 'x-cron-secret': header },
  });

describe('hasCronSecret', () => {
  afterEach(() => {
    delete globalWithDeno.Deno;
  });

  it('accepts the exact secret', () => {
    stubSecret('s3cret-value');
    expect(hasCronSecret(request('s3cret-value'))).toBe(true);
  });

  it('refuses everything while the secret is not set', () => {
    stubSecret(undefined);
    expect(hasCronSecret(request(''))).toBe(false);
    expect(hasCronSecret(request())).toBe(false);
    stubSecret('');
    expect(hasCronSecret(request(''))).toBe(false);
    delete globalWithDeno.Deno;
    expect(hasCronSecret(request('anything'))).toBe(false);
  });

  it('refuses a missing header, a different length and one character off', () => {
    stubSecret('s3cret-value');
    expect(hasCronSecret(request())).toBe(false);
    expect(hasCronSecret(request('s3cret-valu'))).toBe(false);
    expect(hasCronSecret(request('s3cret-value!'))).toBe(false);
    expect(hasCronSecret(request('s3cret-valuf'))).toBe(false);
    expect(hasCronSecret(request('t3cret-value'))).toBe(false);
    expect(hasCronSecret(request('S3CRET-VALUE'))).toBe(false);
  });
});

const base64url = (text: string) =>
  btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/** A JWT-shaped token with this payload (the signature is not read: auth.getUser checks it first). */
function token(payload: unknown) {
  const encoded = base64url(JSON.stringify(payload));
  return `eyJhbGciOiJIUzI1NiJ9.${encoded}.signature`;
}

describe('signedInAt', () => {
  it('reads the amr timestamp in milliseconds', () => {
    expect(signedInAt(token({ amr: [{ method: 'password', timestamp: 1_790_000_000 }] }))).toBe(1_790_000_000_000);
  });

  it('uses the newest of several sign-ins', () => {
    expect(
      signedInAt(
        token({
          amr: [
            { method: 'password', timestamp: 1_790_000_000 },
            { method: 'otp', timestamp: 1_790_000_600 },
            { method: 'oauth', timestamp: 1_789_000_000 },
          ],
        })
      )
    ).toBe(1_790_000_600_000);
  });

  it('gives null without amr or with a malformed token', () => {
    expect(signedInAt(token({ sub: 'x' }))).toBeNull();
    expect(signedInAt(token({ amr: [] }))).toBeNull();
    expect(signedInAt(token({ amr: 'password' }))).toBeNull();
    expect(signedInAt(token({ amr: [{ method: 'password', timestamp: '1790000000' }] }))).toBeNull();
    expect(signedInAt(token(null))).toBeNull();
    expect(signedInAt('')).toBeNull();
    expect(signedInAt('not-a-jwt')).toBeNull();
    expect(signedInAt('a.%%%.c')).toBeNull();
    expect(signedInAt(`a.${base64url('{not json')}.c`)).toBeNull();
  });
});

describe('signedInRecently', () => {
  const signedIn = 1_790_000_000;
  const fresh = token({ amr: [{ method: 'password', timestamp: signedIn }] });

  it('is a 10-minute window', () => {
    expect(REAUTHENTICATION_WINDOW_MS).toBe(10 * 60 * 1000);
  });

  it('accepts 9:59 after signing in and refuses 10:01', () => {
    expect(signedInRecently(fresh, signedIn * 1000 + 9 * 60_000 + 59_000)).toBe(true);
    expect(signedInRecently(fresh, signedIn * 1000 + 10 * 60_000)).toBe(true);
    expect(signedInRecently(fresh, signedIn * 1000 + 10 * 60_000 + 1_000)).toBe(false);
  });

  it('uses the newest sign-in when there are several', () => {
    const several = token({
      amr: [
        { method: 'password', timestamp: signedIn - 3600 },
        { method: 'password', timestamp: signedIn },
      ],
    });
    expect(signedInRecently(several, signedIn * 1000 + 5 * 60_000)).toBe(true);
  });

  it('refuses without amr or with a malformed token', () => {
    expect(signedInRecently(token({ sub: 'x' }), signedIn * 1000)).toBe(false);
    expect(signedInRecently('garbage', signedIn * 1000)).toBe(false);
  });
});

describe('assuranceLevel', () => {
  it('reads the second factor from the token, and nothing else counts', () => {
    expect(assuranceLevel(token({ aal: 'aal2' }))).toBe('aal2');
    expect(assuranceLevel(token({ aal: 'aal1' }))).toBe('aal1');
    expect(assuranceLevel(token({ aal: 'aal3' }))).toBeNull();
    expect(assuranceLevel(token({}))).toBeNull();
    expect(assuranceLevel('not.a-jwt')).toBeNull();
    expect(assuranceLevel('')).toBeNull();
  });
});
