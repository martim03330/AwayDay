/**
 * Dormir fora: as datas da viagem e o link para procurar casa.
 *
 * O link é sempre uma *pesquisa* no Airbnb, com a cidade, as datas e as pessoas já preenchidas. Nunca guardamos o
 * link de um anúncio: o Airbnb não tem API pública e um anúncio apagado devolve HTTP 200 na mesma, por isso não há
 * forma honesta de saber se ainda existe. Uma pesquisa mostra sempre o que está disponível naquele momento.
 */

const AIRBNB = 'https://www.airbnb.pt/s';
const DIA_MS = 24 * 60 * 60 * 1000;

export type Estadia = { checkin: string; checkout: string };

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

/** Pesquisa de casas no Airbnb para esta cidade, nestas datas, para esta gente. */
export function linkAirbnb({
  cidade,
  pais,
  estadia,
  pessoas,
}: {
  cidade: string;
  pais: string;
  estadia: Estadia;
  pessoas: number;
}) {
  const parametros = new URLSearchParams({
    checkin: estadia.checkin,
    checkout: estadia.checkout,
    adults: String(Math.max(1, Math.round(pessoas))),
  });
  return `${AIRBNB}/${encodeURI(destino(cidade, pais))}/homes?${parametros}`;
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
