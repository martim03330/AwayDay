import { dataEmLisboaAPartirDe, formatarHora } from '@/lib/datas';

/**
 * «Hoje há jogo ao pé de ti.»
 *
 * Para quem não marcou nada na app: um aviso de manhã, no próprio dia, quando há jogo num estádio perto de casa. Não
 * usa a localização do telemóvel — usa o estádio do clube da terra, que a pessoa já disse qual é. Puro: quem chama é
 * que agenda.
 *
 * Nunca na véspera (a app tem essa regra desde o início) e nunca para jogos que a pessoa já marcou: esses têm os
 * seus próprios avisos.
 */

const HORA_MS = 60 * 60 * 1000;

/** De manhã, com tempo para decidir, combinar boleia e ver onde almoçar. */
export const HORA_DO_AVISO = '10:00';
/** Jogos de manhã não dão para avisar às 10:00: avisa-se com esta antecedência. */
export const MINIMO_ANTES_HORAS = 3;
/** Até onde é que um estádio ainda é «ao pé de ti». */
export const RAIO_PERTO_KM = 40;

export type JogoPerto = {
  id: string;
  /** Apito, em ISO 8601. */
  inicio: string;
  nome: string;
  estadio: string;
  distanciaKm: number;
};

export type AvisoPerto = {
  id: string;
  jogoId: string;
  quando: Date;
  titulo: string;
  corpo: string;
};

/** Distância em linha reta, em quilómetros. */
export function distanciaKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Quando é que o aviso de um jogo deve tocar: às 10:00 desse dia, ou 3 h antes se o jogo for de manhã. */
export function horaDoAviso(inicioIso: string) {
  const apito = new Date(inicioIso);
  const manha = dataEmLisboaAPartirDe(apito, 0, HORA_DO_AVISO);
  const limite = apito.getTime() - MINIMO_ANTES_HORAS * HORA_MS;
  return new Date(Math.min(manha.getTime(), limite));
}

/** Os avisos a agendar, dos jogos perto que ainda estão para vir. */
export function avisosDeJogosPerto(jogos: readonly JogoPerto[], agora: number): AvisoPerto[] {
  return jogos
    .filter((jogo) => jogo.distanciaKm <= RAIO_PERTO_KM)
    .map((jogo) => ({ jogo, quando: horaDoAviso(jogo.inicio) }))
    .filter(({ quando }) => quando.getTime() > agora)
    .map(({ jogo, quando }) => ({
      id: jogo.id,
      jogoId: jogo.id,
      quando,
      titulo: 'Hoje há jogo ao pé de ti',
      corpo: `${jogo.nome} no ${jogo.estadio}, a ${Math.round(jogo.distanciaKm)} km. Apito às ${formatarHora(new Date(jogo.inicio))}.`,
    }))
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());
}
