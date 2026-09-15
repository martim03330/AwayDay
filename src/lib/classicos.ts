import type { Jogo } from '@/mocks/tipos';

/** The three clubs whose games against each other get safety notes for visiting fans. */
const GRANDES: readonly string[] = ['benfica', 'porto', 'sporting'];

/** Benfica, FC Porto and Sporting against each other, in any competition. */
export function eClassico(jogo: Pick<Jogo, 'casaId' | 'foraId'>) {
  return (
    jogo.casaId !== jogo.foraId && GRANDES.includes(jogo.casaId) && GRANDES.includes(jogo.foraId)
  );
}

/** Notes for this game's visiting fans: the ones about their club and the ones for any visitor. */
export function notasParaVisitante<Nota extends { visitingClubId: string | null }>(
  notas: readonly Nota[],
  visitanteId: string
) {
  return notas.filter(
    (nota) => nota.visitingClubId === null || nota.visitingClubId === visitanteId
  );
}
