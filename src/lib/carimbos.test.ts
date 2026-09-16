import { describe, expect, it } from 'vitest';

import { janelaDoCarimbo, podeCarimbar } from '@/lib/carimbos';

const inicio = '2026-09-20T19:30:00Z';
const apito = Date.parse(inicio);
const HORA = 60 * 60 * 1000;

describe('janelaDoCarimbo', () => {
  it('abre quatro horas antes e fecha cinco depois', () => {
    const { abre, fecha } = janelaDoCarimbo(inicio);
    expect(abre.toISOString()).toBe('2026-09-20T15:30:00.000Z');
    expect(fecha.toISOString()).toBe('2026-09-21T00:30:00.000Z');
  });
});

describe('podeCarimbar', () => {
  it('não deixa carimbar na véspera nem no dia seguinte', () => {
    expect(podeCarimbar(inicio, apito - 5 * HORA)).toBe(false);
    expect(podeCarimbar(inicio, apito - 4 * HORA)).toBe(true);
    expect(podeCarimbar(inicio, apito)).toBe(true);
    expect(podeCarimbar(inicio, apito + 5 * HORA)).toBe(true);
    expect(podeCarimbar(inicio, apito + 6 * HORA)).toBe(false);
  });
});
