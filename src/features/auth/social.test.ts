import { describe, expect, it } from 'vitest';

import { authErrorMessage, socialAuthErrorMessage } from '@/features/auth/errors';
import {
  appleDisplayName,
  isSocialCancel,
  randomNonce,
  sha256Hex,
  socialMetadataUpdate,
} from '@/features/auth/social';

// Reference hashes from Node's crypto (`createHash('sha256').update(text, 'utf8').digest('hex')`).
const NODE_A: Record<number, string> = {
  1: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
  55: '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318',
  56: 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a',
  63: '7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34',
  64: 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb',
  65: '635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0',
  119: '31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb',
  120: '2f3d335432c70b580af0e8e1b3674a7c020d683aa5f73aaaedfdc55af904c21c',
  128: '6836cf13bac400e9105071cd6af47084dfacad4e5e302c94bfed24e013afb73e',
  1000: '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
};
const NODE_TEXT: Record<string, string> = {
  'Zé do Café': '954449e10c8cac7e67fca51bc6bab94ae29db8ba828c136b743f216ac2e2f517',
  Conceição: '2aa2e491181b3607d43458546a56f5117a062862216d2bbeacb360b5423374c9',
  '⚽🏟️': 'b549873ca8e1da4bd77fac12c4a90cd5e0bd1f7ff85a0ec8968069efb3434862',
  'ação 漢字 😀': '0d3c8ef8cd16eb2df3aa1856d2b97653fd6b0df4cb8cda187705ba4ccd167d70',
};

/** A UUID v4 look-alike for the fallbacks (the real sources are the platform's). */
let contador = 0;
const fakeUuid = () => {
  contador += 1;
  return `${contador.toString(16).padStart(8, '0')}-aaaa-4bbb-8ccc-${'d'.repeat(12)}`;
};

describe('sha256Hex', () => {
  it('matches the known vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches Node across block boundaries and non-ASCII text', () => {
    for (const [length, hash] of Object.entries(NODE_A)) {
      expect(sha256Hex('a'.repeat(Number(length)))).toBe(hash);
    }
    for (const [text, hash] of Object.entries(NODE_TEXT)) {
      expect(sha256Hex(text)).toBe(hash);
    }
  });
});

describe('randomNonce', () => {
  it('is 64 lower-case hex characters and new every time', () => {
    const a = randomNonce();
    const b = randomNonce();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('uses getRandomValues first', () => {
    const nonce = randomNonce({ crypto: { getRandomValues: (bytes) => bytes.fill(0xab) } });
    expect(nonce).toBe('ab'.repeat(32));
  });

  it('falls back to two UUIDs (randomUUID, then expo.uuidv4)', () => {
    expect(randomNonce({ crypto: { randomUUID: fakeUuid } })).toMatch(/^[0-9a-f]{64}$/);
    const upper = () => fakeUuid().toUpperCase();
    expect(randomNonce({ expo: { uuidv4: upper } })).toMatch(/^[0-9a-f]{64}$/);
  });

  it('skips a source that throws', () => {
    const nonce = randomNonce({
      crypto: {
        getRandomValues: () => {
          throw new Error('no');
        },
      },
      expo: { uuidv4: fakeUuid },
    });
    expect(nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never falls back to Math.random', () => {
    expect(() => randomNonce({})).toThrow();
  });
});

describe('appleDisplayName', () => {
  it('joins given and family names', () => {
    expect(appleDisplayName({ givenName: 'Maria', familyName: 'Silva' })).toBe('Maria Silva');
    expect(appleDisplayName({ givenName: ' João ', middleName: 'Pedro', familyName: null })).toBe('João');
  });

  it('uses the nickname when there is no name', () => {
    expect(appleDisplayName({ givenName: null, familyName: '', nickname: 'Zé' })).toBe('Zé');
  });

  it('gives null when nothing usable came (later sign-ins, or the person hid it)', () => {
    expect(appleDisplayName(null)).toBeNull();
    expect(appleDisplayName({ givenName: null, familyName: null })).toBeNull();
    expect(appleDisplayName({ givenName: 'A' })).toBeNull();
    expect(appleDisplayName({ givenName: 'A'.repeat(41) })).toBeNull();
  });
});

describe('socialMetadataUpdate', () => {
  const now = new Date('2026-10-13T12:00:00.000Z');

  it('records the terms on a new account', () => {
    expect(socialMetadataUpdate({ email: 'a@b.pt' }, '2026-10-12', now, null)).toEqual({
      data: { terms_version: '2026-10-12', terms_accepted_at: '2026-10-13T12:00:00.000Z' },
      saveName: null,
    });
  });

  it('keeps the terms an account already accepted', () => {
    expect(socialMetadataUpdate({ terms_version: '2026-09-01', display_name: 'Rui' }, '2026-10-12', now, null)).toEqual(
      { data: null, saveName: null }
    );
  });

  it("saves Apple's name on a new account", () => {
    expect(socialMetadataUpdate(undefined, '2026-10-12', now, 'Maria Silva')).toEqual({
      data: {
        terms_version: '2026-10-12',
        terms_accepted_at: '2026-10-13T12:00:00.000Z',
        full_name: 'Maria Silva',
      },
      saveName: 'Maria Silva',
    });
  });

  it("never replaces the name of an account that has one (email account now signing in with Apple)", () => {
    const result = socialMetadataUpdate(
      { display_name: 'O Rui', terms_version: '2026-10-12' },
      '2026-10-12',
      now,
      'Rui Costa'
    );
    expect(result).toEqual({ data: null, saveName: null });
    expect(socialMetadataUpdate({ full_name: 'Ana', terms_version: 'x' }, 'y', now, 'Ana Lopes').saveName).toBeNull();
  });
});

describe('isSocialCancel', () => {
  it('knows the cancel codes of Apple and Google', () => {
    expect(isSocialCancel({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isSocialCancel({ code: 'SIGN_IN_CANCELLED' })).toBe(true);
    expect(isSocialCancel({ code: '-5' })).toBe(true);
    expect(isSocialCancel({ code: 12501 })).toBe(true);
  });

  it('does not hide real errors', () => {
    expect(isSocialCancel({ code: 'provider_disabled' })).toBe(false);
    expect(isSocialCancel(new Error('x'))).toBe(false);
    expect(isSocialCancel(null)).toBe(false);
    expect(isSocialCancel('ERR_REQUEST_CANCELED')).toBe(false);
  });
});

describe('socialAuthErrorMessage', () => {
  it('says when Apple or Google is not switched on yet', () => {
    const message = 'Este tipo de entrada ainda não está ligado. Usa o email por agora.';
    expect(socialAuthErrorMessage({ code: 'provider_disabled' })).toBe(message);
    expect(authErrorMessage({ code: 'oauth_provider_not_supported' })).toBe(message);
  });

  it('a refused token gets its own message', () => {
    expect(socialAuthErrorMessage({ code: 'validation_failed' })).toBe(
      'Não conseguimos confirmar essa conta. Tenta outra vez ou usa o email.'
    );
  });

  it('everything else as on the email screens', () => {
    expect(socialAuthErrorMessage({ code: 'captcha_failed' })).toBe(authErrorMessage({ code: 'captcha_failed' }));
    expect(socialAuthErrorMessage({ name: 'AuthRetryableFetchError' })).toBe(
      'Sem ligação. Verifica a internet e tenta outra vez.'
    );
  });
});
