import { chaveDoDia } from '@/lib/datas';
import type { Jogo, Local, VisitaLocal } from '@/mocks/tipos';

/**
 * Presença no dia de jogo. A demo não usa localização real: conta o check-in feito num tasco.
 */

/** Same as the server (public.checkin): presence at a tasco lasts at most 3 hours. */
export const DURACAO_CHECK_IN_MS = 3 * 60 * 60 * 1000;

/**
 * Check-ins still on: less than 3 hours old, and no game started since then at the tasco's stadium (whoever was
 * there went to the game). Most recent first.
 */
export function checkInsAtivos(
  agora: number,
  visitas: readonly VisitaLocal[],
  obterLocal: (id: string) => Pick<Local, 'estadioId'> | undefined,
  jogos: readonly Pick<Jogo, 'estadioId' | 'inicio'>[]
) {
  return checkInsDoDia(agora, visitas).filter((visita) => {
    const quando = Date.parse(visita.data);
    if (agora - quando > DURACAO_CHECK_IN_MS) return false;
    const estadioId = obterLocal(visita.localId)?.estadioId;
    return !jogos.some((jogo) => {
      const apito = Date.parse(jogo.inicio);
      return jogo.estadioId === estadioId && apito > quando && apito <= agora;
    });
  });
}

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
