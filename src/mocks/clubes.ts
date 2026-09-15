import { subscribeToFixtureCatalog } from '@/features/fixtures/store';
import type { Clube, Divisao } from '@/mocks/tipos';

// Clubs now come from Supabase (src/features/fixtures). This module keeps the interface the
// screens already use: the exports below are filled in place whenever the catalogue changes.

export const DIVISOES: readonly Divisao[] = [1, 2, 3];

export const nomesDivisao: Record<Divisao, string> = {
  1: 'Liga Portugal Betclic',
  2: 'Liga Portugal 2',
  3: 'Liga 3',
};

/**
 * First version of the app: only Liga Portugal has fixtures, so only its clubs can be picked (as your club or your
 * clube da terra). Liga 2 and Liga 3 clubs stay in the catalogue for a later version.
 */
export const DIVISOES_NA_ESCOLHA: readonly Divisao[] = [1];

export const clubes: Clube[] = [];

/** Portuguese clubs grouped by division, in alphabetical order. */
export const clubesPorDivisao: { divisao: Divisao; clubes: Clube[] }[] = [];

export function eClubeParaEscolher(clube: Clube) {
  return clube.divisao !== null && DIVISOES_NA_ESCOLHA.includes(clube.divisao);
}

/** The groups shown when picking a club. */
export function clubesParaEscolher() {
  return clubesPorDivisao.filter((grupo) => DIVISOES_NA_ESCOLHA.includes(grupo.divisao));
}

subscribeToFixtureCatalog((catalogo) => {
  clubes.splice(0, clubes.length, ...catalogo.clubs);
  clubesPorDivisao.splice(
    0,
    clubesPorDivisao.length,
    ...DIVISOES.map((divisao) => ({
      divisao,
      clubes: catalogo.clubs
        .filter((clube) => clube.divisao === divisao)
        .sort((a, b) => a.nomeCurto.localeCompare(b.nomeCurto, 'pt')),
    }))
  );
});

export function obterClube(id: string) {
  return clubes.find((clube) => clube.id === id);
}
