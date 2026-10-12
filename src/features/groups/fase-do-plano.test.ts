import { describe, expect, it } from 'vitest';

import { faseDoPlano, proximoPlano } from '@/features/groups/fase-do-plano';

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

describe('proximoPlano', () => {
  const agora = Date.parse('2026-10-12T12:00:00Z');
  const em = (horas: number) => ({ kickoffAt: new Date(agora + horas * 3_600_000).toISOString() });

  it('pins the soonest game still to come', () => {
    expect(proximoPlano([em(48), em(5), em(24)], agora)).toEqual(em(5));
  });

  it('keeps a game pinned for a few hours after kick-off, then lets it go', () => {
    expect(proximoPlano([em(-2), em(24)], agora)).toEqual(em(-2));
    expect(proximoPlano([em(-4), em(24)], agora)).toEqual(em(24));
  });

  it('pins nothing without plans to come', () => {
    expect(proximoPlano([em(-10)], agora)).toBeNull();
    expect(proximoPlano([], agora)).toBeNull();
  });
});
