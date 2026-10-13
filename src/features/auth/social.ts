// Pure helpers for signing in with Apple and Google (no React Native imports, so Vitest runs them as they are).

/** Round constants of SHA-256: the first 32 bits of the fractional parts of the cube roots of the first 64 primes. */
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
];

/** UTF-8 bytes of a string, without TextEncoder (not promised by every runtime the app runs in). */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

/**
 * SHA-256 of a text (UTF-8), as lower-case hex. Apple gets this hash of the nonce; Supabase gets the raw nonce and
 * checks that its hash is the one inside Apple's token. Written here because expo-crypto is not a dependency.
 */
export function sha256Hex(text: string): string {
  const bytes = utf8(text);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Message length in bits, 64-bit big-endian (the high word is enough for any text this app hashes).
  const high = Math.floor(bitLength / 0x100000000);
  bytes.push((high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
  bytes.push((bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff, (bitLength >>> 8) & 0xff, bitLength & 0xff);

  const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rotr = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const choice = (e & f) ^ (~e & g);
      const t1 = (h + s1 + choice + K[i] + w[i]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

type RandomSources = {
  crypto?: { getRandomValues?: (bytes: Uint8Array) => Uint8Array; randomUUID?: () => string };
  expo?: { uuidv4?: () => string };
};

/**
 * A fresh random nonce (64 hex characters, 256 bits) for one Apple sign-in. From the platform's secure generator,
 * in order: `crypto.getRandomValues`, two `crypto.randomUUID`, two `expo.uuidv4` (installed natively by
 * expo-modules-core in every Expo app). Never Math.random: a guessable nonce would let a stolen token be replayed.
 * Throws when none is there.
 */
export function randomNonce(sources: RandomSources = globalThis as RandomSources): string {
  const fromBytes = () => {
    const getRandomValues = sources.crypto?.getRandomValues;
    if (!getRandomValues) return undefined;
    const bytes = getRandomValues.call(sources.crypto, new Uint8Array(32));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  const fromUuids = (uuid: (() => string) | undefined) =>
    uuid ? `${uuid()}${uuid()}`.replace(/-/g, '').toLowerCase() : undefined;
  const candidates = [
    fromBytes,
    () => fromUuids(sources.crypto?.randomUUID?.bind(sources.crypto)),
    () => fromUuids(sources.expo?.uuidv4),
  ];
  for (const candidate of candidates) {
    try {
      const nonce = candidate();
      if (nonce && /^[0-9a-f]{60,64}$/.test(nonce)) return nonce;
    } catch {
      // Try the next source.
    }
  }
  throw new Error('No secure random source for the sign-in nonce.');
}

/** The name parts Apple gives (only on the first sign-in, and the person may leave them out). */
export type AppleNameParts = {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
  nickname?: string | null;
};

/** «Given Family» from Apple's name, or `null` when there is nothing usable (fewer than 2 or more than 40 letters). */
export function appleDisplayName(parts: AppleNameParts | null | undefined): string | null {
  if (!parts) return null;
  const full = [parts.givenName, parts.familyName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');
  const name = full || (parts.nickname ?? '').trim();
  return name.length >= 2 && name.length <= 40 ? name : null;
}

/** What `updateUser` should add to the metadata after a social sign-in, or `null` when nothing is missing. */
export type SocialMetadataUpdate = {
  terms_version?: string;
  terms_accepted_at?: string;
  full_name?: string;
};

/**
 * After signing in with Apple or Google:
 * - terms: an account without `terms_version` (made just now by the social sign-in) records the version accepted
 *   on screen («Ao continuar, aceitas…») and when. One that already has it keeps it.
 * - Apple's name: kept as `full_name` only for an account that has no name in its metadata yet (a new one). An email
 *   account that now also signs in with Apple keeps the name it chose. `saveName` tells the caller to also make it
 *   the profile name (the profile was made, before the name was known, as «Adepto»).
 */
export function socialMetadataUpdate(
  metadata: Record<string, unknown> | null | undefined,
  termsVersion: string,
  now: Date,
  appleName: string | null
): { data: SocialMetadataUpdate | null; saveName: string | null } {
  const current = metadata ?? {};
  const data: SocialMetadataUpdate = {};
  if (typeof current.terms_version !== 'string' || !current.terms_version) {
    data.terms_version = termsVersion;
    data.terms_accepted_at = now.toISOString();
  }
  const hasName = ['display_name', 'full_name', 'name'].some(
    (key) => typeof current[key] === 'string' && String(current[key]).trim().length > 0
  );
  const saveName = appleName && !hasName ? appleName : null;
  if (saveName) data.full_name = saveName;
  return { data: Object.keys(data).length > 0 ? data : null, saveName };
}

/** Cancel codes of the native sheets: closing Apple's or Google's sheet is not an error. */
const CANCEL_CODES = new Set(['ERR_REQUEST_CANCELED', 'ERR_CANCELED', 'SIGN_IN_CANCELLED', '-5', '12501']);

export function isSocialCancel(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code: unknown = Reflect.get(error, 'code');
  return (typeof code === 'string' || typeof code === 'number') && CANCEL_CODES.has(String(code));
}
