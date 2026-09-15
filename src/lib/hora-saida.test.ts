import { describe, expect, it } from 'vitest';

import {
  ajustarSaida,
  limitesDaSaida,
  limitarSaida,
  margemMinutos,
  saidaApertada,
  saidaSugerida,
} from '@/lib/hora-saida';

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const inicio = '2026-09-20T19:30:00Z';
const apito = Date.parse(inicio);

describe('saidaSugerida', () => {
  it('without routes, 3 h before kick-off', () => {
    const sugerida = saidaSugerida({
      inicio,
      duracaoS: null,
      minutosAPeDoParque: null,
      jogoGrande: false,
    });
    expect(sugerida.toISOString()).toBe('2026-09-20T16:30:00.000Z');
  });

  it('drive + walk + 45 min on a normal game, rounded down to 15 min', () => {
    // 2 h 12 drive + 9 min walk + 45 min = 3 h 06 before 19:30 -> 16:24 -> 16:15
    const sugerida = saidaSugerida({
      inicio,
      duracaoS: 132 * 60,
      minutosAPeDoParque: 9,
      jogoGrande: false,
    });
    expect(sugerida.toISOString()).toBe('2026-09-20T16:15:00.000Z');
  });

  it('30 min more on a big game', () => {
    const normal = saidaSugerida({
      inicio,
      duracaoS: 3600,
      minutosAPeDoParque: 0,
      jogoGrande: false,
    });
    const grande = saidaSugerida({
      inicio,
      duracaoS: 3600,
      minutosAPeDoParque: 0,
      jogoGrande: true,
    });
    expect(normal.getTime() - grande.getTime()).toBe(30 * MIN);
    expect(margemMinutos(true) - margemMinutos(false)).toBe(30);
  });

  it('without a car park, no walk is added', () => {
    const semParque = saidaSugerida({
      inicio,
      duracaoS: 3600,
      minutosAPeDoParque: null,
      jogoGrande: false,
    });
    // 1 h + 45 min before 19:30 = 17:45
    expect(semParque.toISOString()).toBe('2026-09-20T17:45:00.000Z');
  });
});

describe('limitesDaSaida', () => {
  it('from 3 h from now (rounded up) until 30 min before kick-off', () => {
    const agora = Date.parse('2026-09-20T10:07:00Z');
    const limites = limitesDaSaida(inicio, agora);
    expect(limites?.maisCedo.toISOString()).toBe('2026-09-20T13:15:00.000Z');
    expect(limites?.maisTarde.toISOString()).toBe('2026-09-20T19:00:00.000Z');
  });

  it('never earlier than 3 days before kick-off', () => {
    const agora = apito - 10 * 24 * HORA;
    expect(limitesDaSaida(inicio, agora)?.maisCedo.toISOString()).toBe('2026-09-17T19:30:00.000Z');
  });

  it('closed when there are less than 3 h 30 left', () => {
    expect(limitesDaSaida(inicio, apito - 3 * HORA)).toBeNull();
  });
});

describe('ajustarSaida and limitarSaida', () => {
  const limites = limitesDaSaida(inicio, Date.parse('2026-09-20T10:00:00Z'));
  if (!limites) throw new Error('window expected');

  it('moves in 15-minute steps', () => {
    const saida = new Date('2026-09-20T16:00:00Z');
    expect(ajustarSaida(saida, 1, limites).toISOString()).toBe('2026-09-20T16:15:00.000Z');
    expect(ajustarSaida(saida, -2, limites).toISOString()).toBe('2026-09-20T15:30:00.000Z');
  });

  it('stays inside the window', () => {
    expect(ajustarSaida(new Date('2026-09-20T18:45:00Z'), 4, limites).toISOString()).toBe(
      '2026-09-20T19:00:00.000Z'
    );
    expect(limitarSaida(new Date('2026-09-20T08:00:00Z'), limites).toISOString()).toBe(
      '2026-09-20T13:00:00.000Z'
    );
  });
});

describe('saidaApertada', () => {
  it('warns only when leaving later than suggested', () => {
    const sugerida = new Date('2026-09-20T16:15:00Z');
    expect(saidaApertada(new Date('2026-09-20T16:30:00Z'), sugerida)).toBe(true);
    expect(saidaApertada(sugerida, sugerida)).toBe(false);
    expect(saidaApertada(new Date('2026-09-20T15:45:00Z'), sugerida)).toBe(false);
  });
});
