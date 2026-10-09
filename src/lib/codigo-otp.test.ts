import { describe, expect, it } from 'vitest';

import { lerCodigo } from '@/lib/codigo-otp';

describe('lerCodigo', () => {
  it('reads six digits, with or without the space authenticator apps show', () => {
    expect(lerCodigo('123456')).toBe('123456');
    expect(lerCodigo('123 456')).toBe('123456');
    expect(lerCodigo(' 012 345 ')).toBe('012345');
  });

  it('refuses anything that is not exactly six digits', () => {
    expect(lerCodigo('12345')).toBeNull();
    expect(lerCodigo('1234567')).toBeNull();
    expect(lerCodigo('12a456')).toBeNull();
    expect(lerCodigo('')).toBeNull();
  });
});
