import { distanciaEmLinhaRetaKm } from '@/lib/distancia';
import { formatarNumero } from '@/lib/formatos';
import type { Clube, Coordenadas, Venue } from '@/mocks/tipos';

/** Clubes portugueses cujo estádio fica mais perto da origem, do mais perto para o mais longe. */
export function clubesMaisPerto(
  origem: Coordenadas,
  clubes: readonly Clube[],
  estadios: readonly Venue[],
  quantidade = 3
) {
  return clubes
    .flatMap((clube) => {
      const estadio = estadios.find((candidato) => candidato.id === clube.estadioId);
      if (!estadio || estadio.pais !== 'Portugal') return [];
      return [{ clube, km: distanciaEmLinhaRetaKm(origem, estadio.coordenadas) }];
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, quantidade);
}

/**
 * «1 240 adeptos na app», só com o número real do servidor (que só o dá a partir de 5 pessoas). Sem número, nada:
 * nunca se mostra um número inventado.
 */
export function textoAdeptosNaApp(adeptos: number | undefined) {
  return adeptos ? `${formatarNumero(adeptos)} adeptos na app` : null;
}
