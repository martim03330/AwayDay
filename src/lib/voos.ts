/**
 * Voos para os jogos longe: o aeroporto de onde se parte e a pesquisa no Google Flights.
 *
 * Como nas casas, a app nunca diz preços nem qual é o voo mais barato: o Google Flights não tem API pública. O link
 * abre uma *pesquisa* com a partida, o destino e as datas já preenchidos; os preços aparecem lá, ao momento, e
 * ordenam-se pelo mais barato. Nada sai do telemóvel além do próprio link.
 */

import { distanciaEmLinhaRetaKm } from '@/lib/distancia';
import type { Estadia } from '@/lib/dormida';
import type { Coordenadas, Regiao } from '@/mocks/tipos';

export type Aeroporto = {
  /** Código IATA: é o que o Google Flights entende sem ambiguidade. */
  codigo: string;
  nome: string;
  coordenadas: Coordenadas;
};

/** Os aeroportos de Portugal com voos regulares para o estrangeiro ou entre o continente e as ilhas. */
export const AEROPORTOS: readonly Aeroporto[] = [
  { codigo: 'LIS', nome: 'Lisboa', coordenadas: { latitude: 38.7742, longitude: -9.1342 } },
  { codigo: 'OPO', nome: 'Porto', coordenadas: { latitude: 41.2481, longitude: -8.6814 } },
  { codigo: 'FAO', nome: 'Faro', coordenadas: { latitude: 37.0144, longitude: -7.9659 } },
  { codigo: 'FNC', nome: 'Funchal', coordenadas: { latitude: 32.6979, longitude: -16.7745 } },
  { codigo: 'PDL', nome: 'Ponta Delgada', coordenadas: { latitude: 37.7412, longitude: -25.6979 } },
  { codigo: 'TER', nome: 'Terceira', coordenadas: { latitude: 38.7618, longitude: -27.0908 } },
];

const GOOGLE_FLIGHTS = 'https://www.google.com/travel/flights';

/**
 * Se faz sentido falar de avião neste jogo: há mar ou fronteira pelo meio (ilhas ou estrangeiro, de um lado ou do
 * outro). Uma estrada longa no continente, por mais longa que seja, é para boleia, não para avião.
 */
export function precisaDeVoo(estadio: Regiao, terra: Regiao | null) {
  return estadio !== 'continente' || (terra !== null && terra !== 'continente');
}

/** O aeroporto mais perto de onde se parte; sem saber de onde, Lisboa, que é de onde sai a maior parte dos voos. */
export function aeroportoMaisPerto(partida: Coordenadas | null): Aeroporto {
  const lisboa = AEROPORTOS[0];
  if (!partida) return lisboa;
  return AEROPORTOS.reduce((melhor, aeroporto) =>
    distanciaEmLinhaRetaKm(partida, aeroporto.coordenadas) <
    distanciaEmLinhaRetaKm(partida, melhor.coordenadas)
      ? aeroporto
      : melhor
  );
}

/**
 * Pesquisa de voos de ida e volta no Google Flights: ida no dia em que se entra na casa, volta no dia em que se sai
 * (as mesmas datas da dormida, em `Europe/Lisbon`). O destino é a cidade do estádio e o país, que o Google Flights
 * resolve para os aeroportos que a servem; os preços vêm em euros e a página em português.
 */
export function linkGoogleFlights({
  origem,
  cidade,
  pais,
  estadia,
}: {
  origem: Aeroporto;
  cidade: string;
  pais: string;
  estadia: Estadia;
}) {
  const destino = [cidade, pais].map((parte) => parte.trim()).filter(Boolean).join(', ');
  const parametros = new URLSearchParams({
    q: `Flights from ${origem.codigo} to ${destino} on ${estadia.checkin} through ${estadia.checkout}`,
    hl: 'pt-PT',
    curr: 'EUR',
  });
  return `${GOOGLE_FLIGHTS}?${parametros}`;
}

/** Further than this from an island stadium, a meeting point is not on that island (São Miguel is ~65 km long). */
const RAIO_DA_ILHA_KM = 80;

/**
 * The notice for a ride to a game on an island: a car only makes sense for someone already there (or arriving by
 * plane or boat before the game). `null` on the mainland and abroad.
 */
export function avisoDeBoleiaNaIlha(regiao: Regiao) {
  if (regiao !== 'madeira' && regiao !== 'acores') return null;
  const onde = regiao === 'madeira' ? 'na Madeira' : 'nos Açores';
  return {
    titulo: `Jogo ${onde}`,
    mensagem: `Esta boleia faz sentido se já estiveres na ilha do estádio, ou se lá chegares de avião ou barco antes do jogo. O ponto de encontro tem de ser na ilha: do continente não se chega de carro.`,
  };
}

/** Whether a meeting point is on the island of the stadium (only asked for island games). */
export function partidaNaIlha(partida: Coordenadas, estadio: Coordenadas) {
  return distanciaEmLinhaRetaKm(partida, estadio) <= RAIO_DA_ILHA_KM;
}
