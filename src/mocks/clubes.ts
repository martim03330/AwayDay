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

export const clubes: Clube[] = [];

/** Portuguese clubs grouped by division, in alphabetical order. */
export const clubesPorDivisao: { divisao: Divisao; clubes: Clube[] }[] = [];

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
