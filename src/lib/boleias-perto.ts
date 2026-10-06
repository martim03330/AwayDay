import { distanciaEmLinhaRetaKm } from '@/lib/distancia';
import type { Coordenadas } from '@/mocks/tipos';

type BoleiaOrdenavel = {
  origin: Coordenadas;
  isMine: boolean;
  myStatus: string | null;
  driverIsFriend: boolean;
};

/** Mine, or one I asked to join: these always stay on top, whatever the distance. */
function eMinha(boleia: BoleiaOrdenavel) {
  return boleia.isMine || boleia.myStatus === 'accepted' || boleia.myStatus === 'requested';
}

/**
 * Straight-line km from where the person usually leaves for games (the centre of their concelho) to where the car
 * leaves, rounded to the km. `null` when we do not know where they leave from.
 */
export function kmDePartida(partida: Coordenadas | null, origem: Coordenadas) {
  if (!partida) return null;
  return Math.round(distanciaEmLinhaRetaKm(partida, origem));
}

/**
 * The rides of a game in the order that helps: mine and the ones I asked for first, then friends, then the rest by
 * how close they leave to me. Without a known starting point the server's order stays as it is.
 */
export function ordenarBoleiasPorPerto<T extends BoleiaOrdenavel>(
  boleias: readonly T[],
  partida: Coordenadas | null
): T[] {
  if (!partida) return [...boleias];
  return boleias
    .map((boleia, indice) => ({ boleia, indice, km: kmDePartida(partida, boleia.origin) ?? 0 }))
    .sort((a, b) => {
      const minhas = Number(eMinha(b.boleia)) - Number(eMinha(a.boleia));
      if (minhas !== 0) return minhas;
      const amigos = Number(b.boleia.driverIsFriend) - Number(a.boleia.driverIsFriend);
      if (amigos !== 0) return amigos;
      return a.km - b.km || a.indice - b.indice;
    })
    .map(({ boleia }) => boleia);
}
