/**
 * The words for a plan sent to another group, so nobody takes it for one of their own: on the card and the plan in
 * the group that received it, which group it comes from.
 */

/** Whether the plan is shown in a group other than its own. */
export function deOutroGrupo(plano: { groupId: string }, grupoAtualId: string | null | undefined) {
  return !!grupoAtualId && plano.groupId !== grupoAtualId;
}

/** The card's top line: who invites, and from which group when it is not this one. */
export function conviteDoCartao(
  quemConvidou: string | undefined,
  plano: { groupId: string; groupName: string },
  grupoAtualId: string | null | undefined
) {
  if (quemConvidou === 'eu') return 'Convidaste a malta';
  const quem = quemConvidou ?? null;
  if (deOutroGrupo(plano, grupoAtualId)) {
    return quem ? `${quem} · ${plano.groupName} convida` : `Convite de ${plano.groupName}`;
  }
  return quem ? `${quem} convida` : 'Convite para o jogo';
}

/** In the group that received it: the plan, the car and the house are another group's, opened to this one. */
export function origemDoPlano(plano: { groupId: string; groupName: string }, grupoAtualId: string | null | undefined) {
  return deOutroGrupo(plano, grupoAtualId) ? `Plano de «${plano.groupName}», aberto a este grupo` : null;
}

/** The label on a car or a house of a group the viewer is not in (they see it because a plan was sent to them). */
export function rotuloDeOutroGrupo(tipo: 'boleia' | 'casa', grupo: string) {
  return tipo === 'boleia' ? `Boleia de «${grupo}», aberta ao teu grupo` : `Casa de «${grupo}», aberta ao teu grupo`;
}
