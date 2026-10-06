/**
 * Os passos da introdução. Com conta há mais: a foto, de onde partes e como vais servem para as boleias e para os
 * outros te reconhecerem. Sem conta ficam o clube e os avisos, que vivem no telemóvel.
 */
export type PassoIntroducao = 'foto' | 'clube' | 'zona' | 'transporte' | 'avisos';

const COM_CONTA: readonly PassoIntroducao[] = ['foto', 'clube', 'zona', 'transporte', 'avisos'];
const SEM_CONTA: readonly PassoIntroducao[] = ['clube', 'avisos'];

function passos(comConta: boolean) {
  return comConta ? COM_CONTA : SEM_CONTA;
}

/** «2 de 5», para a barra de progresso. Um passo fora da lista conta como o primeiro. */
export function posicaoNaIntroducao(passo: PassoIntroducao, comConta: boolean) {
  const lista = passos(comConta);
  return { passo: Math.max(0, lista.indexOf(passo)) + 1, total: lista.length };
}

/** O passo a seguir, ou `null` quando a introdução acaba. */
export function passoSeguinte(passo: PassoIntroducao, comConta: boolean): PassoIntroducao | null {
  const lista = passos(comConta);
  const indice = lista.indexOf(passo);
  if (indice === -1) return lista[0] ?? null;
  return lista[indice + 1] ?? null;
}
