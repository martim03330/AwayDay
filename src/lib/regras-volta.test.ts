import { describe, expect, it } from 'vitest';

import { janelaDaVolta, podePedirVolta, podeResponderVolta } from '@/lib/regras-volta';

const inicio = '2026-09-20T19:30:00Z';
const apito = Date.parse(inicio);
const MIN = 60 * 1000;

describe('janelaDaVolta', () => {
  it('opens about half time and closes about an hour after the end', () => {
    const { abre, fecha } = janelaDaVolta(inicio);
    expect(abre.toISOString()).toBe('2026-09-20T20:30:00.000Z');
    expect(fecha.toISOString()).toBe('2026-09-20T23:00:00.000Z');
  });
});

describe('podePedirVolta', () => {
  it('is closed before half time and after the cars are gone', () => {
    expect(podePedirVolta(inicio, apito)).toBe(false);
    expect(podePedirVolta(inicio, apito + 30 * MIN)).toBe(false);
    expect(podePedirVolta(inicio, apito + 60 * MIN)).toBe(true);
    expect(podePedirVolta(inicio, apito + 150 * MIN)).toBe(true);
    expect(podePedirVolta(inicio, apito + 210 * MIN)).toBe(true);
    expect(podePedirVolta(inicio, apito + 211 * MIN)).toBe(false);
  });
});

describe('podeResponderVolta', () => {
  it('gives the driver an hour more than the fan has to ask', () => {
    expect(podeResponderVolta(inicio, apito + 250 * MIN)).toBe(true);
    expect(podeResponderVolta(inicio, apito + 271 * MIN)).toBe(false);
  });
});
