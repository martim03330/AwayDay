import type { TripExpense } from '@/features/trips/api';

/** The note on an expense that entered on its own (it follows the car or the house, nobody edits it). */
export function notaDaOrigem(source: TripExpense['source']): string | null {
  switch (source) {
    case 'boleia':
      return 'segue o carro';
    case 'casa':
      return 'segue a casa';
    default:
      return null;
  }
}

/**
 * Whether the house is in the accounts twice: the one that entered on its own and one typed by hand in the
 * «Casa» category (from before the house entered on its own, or by mistake).
 */
export function casaLancadaAMao(despesas: Pick<TripExpense, 'source' | 'category'>[]): boolean {
  return (
    despesas.some((d) => d.source === 'casa') &&
    despesas.some((d) => d.source === 'manual' && d.category === 'casa')
  );
}
