import { describe, expect, it } from 'vitest';

import { janelaDaVolta, podePedirVolta, podeResponderVolta } from '@/lib/regras-volta';

const inicio = '2026-09-20T19:30:00Z';
const apito = Date.parse(inicio);
const MIN = 60 * 1000;

describe('janelaDaVolta', () => {
  it('abre com o apito e fecha cerca de uma hora depois do fim', () => {
    const { abre, fecha } = janelaDaVolta(inicio);
    expect(abre.toISOString()).toBe('2026-09-20T19:30:00.000Z');
    expect(fecha.toISOString()).toBe('2026-09-20T23:00:00.000Z');
  });
});

describe('podePedirVolta', () => {
  it('abre com o apito e fecha quando os carros já foram', () => {
    expect(podePedirVolta(inicio, apito - 1 * MIN)).toBe(false);
    expect(podePedirVolta(inicio, apito)).toBe(true);
    expect(podePedirVolta(inicio, apito + 30 * MIN)).toBe(true);
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
