import { subscribeToFixtureCatalog } from '@/features/fixtures/store';
import type { Competicao, Jogo } from '@/mocks/tipos';

// Fixtures now come from Supabase (src/features/fixtures). This module keeps the interface the
// screens already use: the exports below are filled in place whenever the catalogue changes.

export const nomesCompeticao: Record<Competicao, string> = {
  liga: 'Liga Portugal Betclic',
  'liga-2': 'Liga Portugal 2',
  'liga-3': 'Liga 3',
  'taca-de-portugal': 'Taça de Portugal',
  'taca-da-liga': 'Taça da Liga',
  champions: 'Liga dos Campeões',
  'liga-europa': 'Liga Europa',
  conference: 'Liga Conferência',
};

/** Fixtures sorted by kick-off. */
export const jogos: Jogo[] = [];

subscribeToFixtureCatalog((catalogo) => {
  Object.assign(nomesCompeticao, catalogo.competitionNames);
  jogos.splice(0, jogos.length, ...catalogo.fixtures);
});

export function obterJogo(id: string) {
  return jogos.find((jogo) => jogo.id === id);
}
