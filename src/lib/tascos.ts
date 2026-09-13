import type { UtilizadorRanking, VisitaLocal } from '@/mocks/tipos';

export const ID_UTILIZADOR = 'tu';

/** Pontuação: tascos diferentes com pelo menos uma visita verificada. */
export function contarTascosVerificados(visitas: readonly VisitaLocal[]) {
  return new Set(visitas.filter((visita) => visita.verificado).map((visita) => visita.localId)).size;
}

/** Ranking por tascos verificados; em caso de empate, ficas à frente. */
export function montarRanking(outros: readonly UtilizadorRanking[], utilizador: UtilizadorRanking) {
  return [...outros, utilizador]
    .sort((a, b) => {
      const diferenca = b.tascosVerificados - a.tascosVerificados;
      if (diferenca !== 0) return diferenca;
      if (a.id === utilizador.id) return -1;
      if (b.id === utilizador.id) return 1;
      return 0;
    })
    .map((entrada, indice) => ({ ...entrada, posicao: indice + 1 }));
}
