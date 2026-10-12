/** One piece of confetti, fully decided before it starts falling. */
export type Particula = {
  id: number;
  cor: string;
  forma: 'retangulo' | 'circulo';
  /** Where it starts across the screen, from 0 (left edge) to 1 (right edge). */
  x: number;
  /** Sideways drift by the time it reaches the bottom, in points (negative: to the left). */
  deriva: number;
  largura: number;
  altura: number;
  /** Turns while falling, in degrees (negative: the other way). */
  rotacao: number;
  atrasoMs: number;
  duracaoMs: number;
};

export const QUANTIDADE_CONFETTI = 50;
/** No piece is still falling after this: the layer can go. */
export const DURACAO_MAXIMA_CONFETTI_MS = 2000;

const ATRASO_MAXIMO_MS = 350;
const DURACAO_MINIMA_MS = 1200;

/**
 * The pieces of one burst, in the given colours (taken in turn, so every colour shows).
 * `aleatorio` is injectable for tests; it must return numbers in [0, 1).
 */
export function gerarParticulas(
  cores: readonly string[],
  quantidade = QUANTIDADE_CONFETTI,
  aleatorio: () => number = Math.random
): Particula[] {
  if (cores.length === 0 || quantidade <= 0) return [];
  const entre = (minimo: number, maximo: number) => minimo + aleatorio() * (maximo - minimo);

  return Array.from({ length: quantidade }, (_, id) => {
    const forma = aleatorio() < 0.3 ? 'circulo' : 'retangulo';
    const tamanho = entre(6, 10);
    const atrasoMs = Math.round(entre(0, ATRASO_MAXIMO_MS));
    return {
      id,
      cor: cores[id % cores.length] ?? cores[0] ?? '#000000',
      forma,
      x: aleatorio(),
      deriva: entre(-60, 60),
      largura: tamanho,
      altura: forma === 'circulo' ? tamanho : tamanho * 0.45,
      rotacao: entre(-720, 720),
      atrasoMs,
      // Late starters fall a bit faster, so the whole burst is over in time.
      duracaoMs: Math.round(entre(DURACAO_MINIMA_MS, DURACAO_MAXIMA_CONFETTI_MS - atrasoMs)),
    };
  });
}
