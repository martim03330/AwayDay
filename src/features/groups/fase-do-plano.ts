/**
 * Where a plan stands against its game. At kick-off the plan stops changing (the server refuses answers and changes
 * from then on): it stays as a record of who went. Plans are real data, so this uses the real clock, not demo time.
 */
export type FaseDoPlano = 'antes' | 'a-decorrer' | 'terminado';

/** About how long a game lasts with half-time and stoppages: after this, it is over. */
const DURACAO_DO_JOGO_MS = 2.5 * 60 * 60 * 1000;

export function faseDoPlano(plano: { kickoffAt: string }, agoraMs: number): FaseDoPlano {
  const inicio = Date.parse(plano.kickoffAt);
  if (!Number.isFinite(inicio) || agoraMs < inicio) return 'antes';
  return agoraMs < inicio + DURACAO_DO_JOGO_MS ? 'a-decorrer' : 'terminado';
}

/** The short line on the card and the plan once nobody can change it any more. */
export function avisoDoPlanoFechado(fase: Exclude<FaseDoPlano, 'antes'>) {
  return fase === 'a-decorrer'
    ? 'O jogo já começou: o plano já não muda.'
    : 'O jogo já foi. O plano fica como recordação de quem foi.';
}

/** A plan stays pinned until a few hours after kick-off: the group is still talking about that game. */
const FIXADO_DEPOIS_DO_APITO_MS = 3 * 60 * 60 * 1000;

/** The next game the group combined, if any: the soonest still to come (or just played). */
export function proximoPlano<P extends { kickoffAt: string }>(planos: readonly P[], agora: number): P | null {
  return (
    [...planos]
      .filter((plano) => Date.parse(plano.kickoffAt) + FIXADO_DEPOIS_DO_APITO_MS > agora)
      .sort((a, b) => Date.parse(a.kickoffAt) - Date.parse(b.kickoffAt))[0] ?? null
  );
}
