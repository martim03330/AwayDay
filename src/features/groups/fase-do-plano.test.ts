import { describe, expect, it } from 'vitest';

import { faseDoPlano } from '@/features/groups/fase-do-plano';

const plano = { kickoffAt: '2026-10-09T19:15:00.000Z' };
const em = (iso: string) => Date.parse(iso);

describe('faseDoPlano', () => {
  it('is open until kick-off, to the second', () => {
    expect(faseDoPlano(plano, em('2026-10-09T19:14:59Z'))).toBe('antes');
    expect(faseDoPlano(plano, em('2026-10-09T19:15:00Z'))).toBe('a-decorrer');
  });

  it('is over about two and a half hours after kick-off', () => {
    expect(faseDoPlano(plano, em('2026-10-09T21:44:00Z'))).toBe('a-decorrer');
    expect(faseDoPlano(plano, em('2026-10-09T21:45:00Z'))).toBe('terminado');
    expect(faseDoPlano(plano, em('2026-10-20T12:00:00Z'))).toBe('terminado');
  });

  it('treats a broken date as still open (the server has the final word)', () => {
    expect(faseDoPlano({ kickoffAt: 'nope' }, em('2026-10-20T12:00:00Z'))).toBe('antes');
  });
});
