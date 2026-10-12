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

/** Every Portuguese division can be picked as your club, even before its fixtures are in the app. */
export const DIVISOES_NA_ESCOLHA: readonly Divisao[] = [1, 2, 3];

/** Only Liga Portugal has fixtures for now (sync-fixtures). Liga 2 and Liga 3 come in a later version. */
export const DIVISOES_COM_JOGOS: readonly Divisao[] = [1];

/** Whether the app already has this club's fixtures. */
export function temJogosNaApp(clube: Pick<Clube, 'divisao'>) {
  return clube.divisao !== null && DIVISOES_COM_JOGOS.includes(clube.divisao);
}

/** Shown wherever a club without fixtures can be picked or is someone's club. */
export const TEXTO_SEM_JOGOS = 'Os jogos da Liga 2 e da Liga 3 ainda não estão disponíveis. Chegam em breve.';

/**
 * The clube da terra makes most sense with Liga 2 and Liga 3 clubs, which have no fixtures in the first version: it
 * stays out of the introduction, the profile and the fixtures list. What was already chosen is kept.
 */
export const MOSTRAR_CLUBE_DA_TERRA = false;

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

export function obterClube(id: string | null | undefined) {
  return clubes.find((clube) => clube.id === id);
}
