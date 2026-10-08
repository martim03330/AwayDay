/**
 * Dormir fora: as datas da viagem e o link para procurar casa.
 *
 * O link é sempre uma *pesquisa* no Airbnb, com a cidade, as datas e as pessoas já preenchidas. Nunca guardamos o
 * link de um anúncio: o Airbnb não tem API pública e um anúncio apagado devolve HTTP 200 na mesma, por isso não há
 * forma honesta de saber se ainda existe. Uma pesquisa mostra sempre o que está disponível naquele momento.
 */

import { distanciaKm } from '@/lib/avisos-perto';
import type { Coordenadas, Regiao } from '@/mocks/tipos';

const AIRBNB = 'https://www.airbnb.pt/s';
const DIA_MS = 24 * 60 * 60 * 1000;

export type Estadia = { checkin: string; checkout: string };

/** A partir daqui, ninguém vai e volta no mesmo dia sem se arrepender. */
export const LONGE_KM = 250;

/**
 * Se faz sentido falar de dormida neste jogo, para quem é desta terra.
 *
 * Três casos, e o segundo é o que faltava: **quem é das ilhas precisa de dormida para vir ao continente**, por mais
 * perto que o estádio pareça no mapa — vai de avião e não há voo de volta a seguir ao apito. O primeiro é o
 * simétrico (ir do continente às ilhas ou ao estrangeiro), e o terceiro é a estrada longa de sempre.
 */
export function precisaDeDormida(
  estadio: { regiao: Regiao; coordenadas: Coordenadas },
  terra: { regiao: Regiao; coordenadas: Coordenadas } | null
) {
  if (estadio.regiao !== 'continente') return true;
  if (!terra) return false;
  if (terra.regiao !== 'continente') return true;
  return distanciaKm(terra.coordenadas, estadio.coordenadas) >= LONGE_KM;
}

/** A data em Portugal continental (YYYY-MM-DD), que é o fuso em que a malta pensa as viagens. */
function dataEmLisboa(ms: number) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon' }).format(new Date(ms));
}

/**
 * As noites de uma ida a um jogo: entrada na véspera do jogo e saída `noites` depois. Quem vai a um jogo longe
 * chega no dia antes — ninguém apanha um avião na manhã do jogo por gosto.
 */
export function datasDaEstadia(inicioIso: string, noites: number): Estadia {
  const apito = Date.parse(inicioIso);
  const entrada = apito - DIA_MS;
  return {
    checkin: dataEmLisboa(entrada),
    checkout: dataEmLisboa(entrada + Math.max(1, Math.round(noites)) * DIA_MS),
  };
}

/** Cidade e país como o Airbnb os escreve no endereço: "Ponta-Delgada--Portugal". */
function destino(cidade: string, pais: string) {
  return [cidade, pais]
    .map((parte) => parte.trim().replace(/\s+/g, '-'))
    .filter(Boolean)
    .join('--');
}

/**
 * Pesquisa de casas no Airbnb para esta cidade, nestas datas, para esta gente. Os preços, quando os há, são **por
 * noite e em euros inteiros**, que é como o filtro de preço do endereço do Airbnb os lê.
 */
export function linkAirbnb({
  cidade,
  pais,
  estadia,
  pessoas,
  precoMinPorNoite = null,
  precoMaxPorNoite = null,
}: {
  cidade: string;
  pais: string;
  estadia: Estadia;
  pessoas: number;
  precoMinPorNoite?: number | null;
  precoMaxPorNoite?: number | null;
}) {
  const parametros = new URLSearchParams({
    checkin: estadia.checkin,
    checkout: estadia.checkout,
    adults: String(Math.max(1, Math.round(pessoas))),
  });
  if (precoMinPorNoite !== null) parametros.set('price_min', String(precoMinPorNoite));
  if (precoMaxPorNoite !== null) parametros.set('price_max', String(precoMaxPorNoite));
  return `${AIRBNB}/${encodeURI(destino(cidade, pais))}/homes?${parametros}`;
}

/** Quanto cada um quer pagar pela dormida toda (todas as noites), em cêntimos. `max: null` é «mais de». */
export type Escalao = { minCentimos: number; maxCentimos: number | null };

/** Os escalões da pergunta «quanto queres pagar, só tu?»: de 50 em 50 euros, pela estadia toda. */
export const ESCALOES_POR_PESSOA: readonly Escalao[] = [
  { minCentimos: 0, maxCentimos: 5000 },
  { minCentimos: 5000, maxCentimos: 10000 },
  { minCentimos: 10000, maxCentimos: 15000 },
  { minCentimos: 15000, maxCentimos: 20000 },
  { minCentimos: 20000, maxCentimos: null },
];

/** Os tamanhos de casa para que se procura: o número de pessoas sai do orçamento, não se escolhe antes. */
export const TAMANHOS_DE_CASA = [2, 4, 6] as const;

export type PesquisaPorOrcamento = {
  pessoas: number;
  /** O que a casa toda pode custar, pelas noites todas, para cada um pagar dentro do escalão. */
  totalMinCentimos: number;
  totalMaxCentimos: number | null;
  link: string;
};

/**
 * A pergunta ao contrário: quem diz quanto quer pagar **só por si** recebe uma pesquisa por tamanho de casa, cada
 * uma com o preço já filtrado para que, dividida por essa gente, a casa caiba no escalão. Uma casa de 400 € para 4
 * fica a 100 € cada — tanto faz se a malta é conhecida ou não.
 *
 * O filtro do Airbnb é por noite: o total divide-se pelas noites. O máximo arredonda para cima e o mínimo para
 * baixo, para nunca deixar de fora uma casa que caiba no escalão.
 */
export function pesquisasPorOrcamento({
  cidade,
  pais,
  estadia,
  noites,
  escalao,
  tamanhos = TAMANHOS_DE_CASA,
}: {
  cidade: string;
  pais: string;
  estadia: Estadia;
  noites: number;
  escalao: Escalao;
  tamanhos?: readonly number[];
}): PesquisaPorOrcamento[] {
  const n = Math.max(1, Math.round(noites));
  return tamanhos.map((pessoas) => {
    const totalMinCentimos = escalao.minCentimos * pessoas;
    const totalMaxCentimos = escalao.maxCentimos === null ? null : escalao.maxCentimos * pessoas;
    const porNoite = n * 100;
    return {
      pessoas,
      totalMinCentimos,
      totalMaxCentimos,
      link: linkAirbnb({
        cidade,
        pais,
        estadia,
        pessoas,
        precoMinPorNoite: totalMinCentimos > 0 ? Math.floor(totalMinCentimos / porNoite) : null,
        precoMaxPorNoite: totalMaxCentimos === null ? null : Math.ceil(totalMaxCentimos / porNoite),
      }),
    };
  });
}

/**
 * O que cada um paga numa casa dividida: o custo total a dividir por quem lá dorme, arredondado para cima ao
 * cêntimo — a mesma regra da boleia, por isso o dono nunca paga menos do que a sua parte. O servidor faz esta conta
 * outra vez (`stay_share_cents`); isto é para a app poder mostrar o resultado antes de guardar.
 */
export function porPessoaNaCasa(totalCentimos: number, pessoas: number) {
  const gente = Math.max(1, Math.round(pessoas));
  return Math.ceil(totalCentimos / gente);
}

/**
 * The sites a shared house may link to, as the database enforces them (stay_plan_listing_url_check): Airbnb (with its
 * short links) and Booking. Any other address could be a look-alike payment page.
 */
const LIGACAO_DE_CASA =
  /^https:\/\/(www\.)?(airbnb\.(pt|com|es|fr|de|it|ie|nl|be|ch|co\.uk|com\.br)|abnb\.me|booking\.com)(\/|$)/;

export function ligacaoDeCasaValida(url: string) {
  return url.length <= 500 && LIGACAO_DE_CASA.test(url);
}

/** «Airbnb» or «Booking», and the address's host, to show next to the button; `null` for any other address. */
export function siteDaCasa(url: string): { nome: 'Airbnb' | 'Booking'; dominio: string } | null {
  const partes = LIGACAO_DE_CASA.exec(url);
  if (!partes?.[2]) return null;
  const dominio = partes[2];
  return { nome: dominio === 'booking.com' ? 'Booking' : 'Airbnb', dominio };
}
