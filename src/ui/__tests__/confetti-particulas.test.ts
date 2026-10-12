import { describe, expect, it } from 'vitest';

import { DURACAO_MAXIMA_CONFETTI_MS, gerarParticulas, QUANTIDADE_CONFETTI } from '@/ui/confetti-particulas';

/** A fixed sequence, so the burst is the same on every run. */
function sequencia(valores: readonly number[]) {
  let indice = 0;
  return () => valores[indice++ % valores.length] ?? 0;
}

describe('gerarParticulas', () => {
  it('makes the default number of pieces, cycling through every colour', () => {
    const particulas = gerarParticulas(['#ff0000', '#ffffff']);
    expect(particulas).toHaveLength(QUANTIDADE_CONFETTI);
    expect(new Set(particulas.map((particula) => particula.cor))).toEqual(new Set(['#ff0000', '#ffffff']));
    expect(particulas[0]?.cor).toBe('#ff0000');
    expect(particulas[1]?.cor).toBe('#ffffff');
    expect(new Set(particulas.map((particula) => particula.id)).size).toBe(QUANTIDADE_CONFETTI);
  });

  it('no colours or no pieces: nothing to throw', () => {
    expect(gerarParticulas([])).toEqual([]);
    expect(gerarParticulas(['#000'], 0)).toEqual([]);
  });

  it.each([
    ['lowest', sequencia([0])],
    ['highest', sequencia([0.999999])],
    ['mixed', sequencia([0.1, 0.9, 0.5, 0.25, 0.75, 0.33, 0.66])],
  ])('every piece lands inside the screen and the burst is over in time (%s)', (_nome, aleatorio) => {
    for (const particula of gerarParticulas(['#123456'], 60, aleatorio)) {
      expect(particula.x).toBeGreaterThanOrEqual(0);
      expect(particula.x).toBeLessThan(1);
      expect(particula.atrasoMs).toBeGreaterThanOrEqual(0);
      expect(particula.duracaoMs).toBeGreaterThan(0);
      expect(particula.atrasoMs + particula.duracaoMs).toBeLessThanOrEqual(DURACAO_MAXIMA_CONFETTI_MS);
      expect(particula.largura).toBeGreaterThan(0);
      expect(particula.altura).toBeGreaterThan(0);
    }
  });

  it('circles are round, rectangles are strips', () => {
    const circulo = gerarParticulas(['#000'], 1, sequencia([0.1, 0.5]))[0];
    expect(circulo?.forma).toBe('circulo');
    expect(circulo?.altura).toBe(circulo?.largura);
    const retangulo = gerarParticulas(['#000'], 1, sequencia([0.9, 0.5]))[0];
    expect(retangulo?.forma).toBe('retangulo');
    expect(retangulo?.altura).toBeLessThan(retangulo?.largura ?? 0);
  });
});
