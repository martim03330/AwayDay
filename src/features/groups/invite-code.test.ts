import { describe, expect, it } from 'vitest';

import { parseInviteCode } from '@/features/groups/invite-code';

describe('parseInviteCode', () => {
  it('accepts a code as the server makes it', () => {
    expect(parseInviteCode('3f9a0c1b7e')).toBe('3f9a0c1b7e');
  });

  it('trims, lowercases and ignores spaces and dashes, like the server', () => {
    expect(parseInviteCode('  3F9A0-C1B7E ')).toBe('3f9a0c1b7e');
  });

  it('reads the code from an app link or the web invite page', () => {
    expect(parseInviteCode('Anda para o grupo: awayday://grupos/entrar?code=3f9a0c1b7e')).toBe('3f9a0c1b7e');
    expect(parseInviteCode('https://martim03330.github.io/awayday-legal/convite/?c=3F9A0C1B7E')).toBe('3f9a0c1b7e');
  });

  it('refuses anything that cannot be a code', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode('3f9a0c1b7')).toBeNull();
    expect(parseInviteCode('3f9a0c1b7e1')).toBeNull();
    expect(parseInviteCode('3f9a0c1b7_')).toBeNull();
    expect(parseInviteCode('awayday://grupos/entrar?code=curto')).toBeNull();
  });
});
