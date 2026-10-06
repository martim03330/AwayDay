import { describe, expect, it } from 'vitest';

import { aproximarDoPresente, desvioDeLisboaMin } from '@/features/fixtures/demo-datas';

const horaEmLisboa = (iso: string) =>
  new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', weekday: 'long' }).format(
    new Date(iso)
  );

describe('desvioDeLisboaMin', () => {
  it('is one hour in summer and zero in winter', () => {
    expect(desvioDeLisboaMin(new Date('2026-08-28T19:30:00Z'))).toBe(60);
    expect(desvioDeLisboaMin(new Date('2026-12-04T20:30:00Z'))).toBe(0);
  });
});

describe('aproximarDoPresente', () => {
  const jogos = [
    { id: 'a', kickoff_at: '2026-08-28T19:30:00.000Z' }, // sexta, 20:30 em Lisboa (verão)
    { id: 'b', kickoff_at: '2026-09-11T19:30:00.000Z' },
  ];

  it('leaves games that are still to come alone', () => {
    expect(aproximarDoPresente(jogos, Date.parse('2026-08-01T00:00:00Z'))).toEqual(jogos);
  });

  it('moves past games forward so the first one is still to come, keeping the spacing', () => {
    const agora = Date.parse('2026-10-06T12:00:00Z');
    const movidos = aproximarDoPresente(jogos, agora);
    const [a, b] = movidos.map((jogo) => Date.parse(jogo.kickoff_at));
    expect(a).toBeGreaterThanOrEqual(agora);
    expect((b ?? 0) - (a ?? 0)).toBe(14 * 24 * 60 * 60 * 1000);
    expect(a - agora).toBeLessThan(7 * 24 * 60 * 60 * 1000);
  });

  it('keeps the weekday and the Lisbon time across the change to winter time', () => {
    const movidos = aproximarDoPresente(jogos, Date.parse('2026-11-10T12:00:00Z'));
    expect(horaEmLisboa(movidos[0]!.kickoff_at)).toBe(horaEmLisboa(jogos[0]!.kickoff_at));
  });

  it('does not change the list it was given', () => {
    aproximarDoPresente(jogos, Date.parse('2026-10-06T12:00:00Z'));
    expect(jogos[0]?.kickoff_at).toBe('2026-08-28T19:30:00.000Z');
  });
});
