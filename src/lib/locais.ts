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

/** Confirmed places first; among suggestions, quick and cheap ones first, then the best ranked, then the nearest. */
export function ordenarTascos(locais: readonly Local[]) {
  return [...locais].sort(
    (a, b) =>
      // Places fans are known to go to (researched, with sources) first.
      Number(b.referencia !== null) - Number(a.referencia !== null) ||
      Number(b.confirmacao === 'confirmado') - Number(a.confirmacao === 'confirmado') ||
      Number(b.rapidoEBarato) - Number(a.rapidoEBarato) ||
      b.pontuacaoSugestao - a.pontuacaoSugestao ||
      a.distanciaMetros - b.distanciaMetros
  );
}
