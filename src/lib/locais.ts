import type { Local } from '@/mocks/tipos';

/** Só mostramos locais a menos deste tempo a pé do estádio. */
export const MAX_MINUTOS_A_PE = 20;

/** Locais a menos de 20 min a pé, ordenados por distância, e quantos ficaram de fora. */
export function filtrarPorTempoAPe(locais: readonly Local[]) {
  const perto = locais
    .filter((local) => local.minutosAPe < MAX_MINUTOS_A_PE)
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros);

  return { perto, maisLonge: locais.length - perto.length };
}
