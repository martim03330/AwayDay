import { chaveDoDia } from '@/lib/datas';
import type { Local, VisitaLocal } from '@/mocks/tipos';

/**
 * Presença no dia de jogo. A demo não usa localização real: conta o check-in feito num tasco.
 */

/** Check-ins verificados no mesmo dia (em Lisboa) de `agora`, do mais recente para o mais antigo. */
export function checkInsDoDia(agora: number, visitas: readonly VisitaLocal[]) {
  const dia = chaveDoDia(new Date(agora));
  return visitas
    .filter((visita) => {
      const quando = Date.parse(visita.data);
      return visita.verificado && quando <= agora && chaveDoDia(new Date(quando)) === dia;
    })
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}

/** Fez check-in hoje num tasco perto deste estádio. */
export function temCheckInPerto(
  estadioId: string,
  agora: number,
  visitas: readonly VisitaLocal[],
  obterLocal: (id: string) => Local | undefined
) {
  return checkInsDoDia(agora, visitas).some(
    (visita) => obterLocal(visita.localId)?.estadioId === estadioId
  );
}
