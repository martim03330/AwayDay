// What the group chat and the car chat share: reactions, quoted replies and the edit window. The rules live in the
// server (`react_*_message`, `edit_*_message`); these only mirror them so the app does not offer what it would refuse.

/** The reactions offered, in the order the bar shows them. Same list as `chat_reaction_allowed` in the database. */
export const REACOES = ['👍', '❤️', '😂', '😮', '😢', '⚽'] as const;

export type Emoji = (typeof REACOES)[number];

export type Reacao = { emoji: Emoji; count: number; mine: boolean };

/** The message a reply quotes. `body` is null when it is gone, hidden or from someone you blocked. */
export type Citacao = { id: string; displayName: string | null; body: string | null };

/** Same as `chat_edit_window()` in the database. */
export const JANELA_DE_EDICAO_MS = 15 * 60 * 1000;

function eEmoji(valor: unknown): valor is Emoji {
  return REACOES.some((emoji) => emoji === valor);
}

/** The reactions as the server sends them (`[{ emoji, count, mine }]`), skipping anything malformed. */
export function lerReacoes(valor: unknown): Reacao[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const emoji = Reflect.get(item, 'emoji');
    const count = Reflect.get(item, 'count');
    if (!eEmoji(emoji) || typeof count !== 'number' || count < 1) return [];
    return [{ emoji, count, mine: Reflect.get(item, 'mine') === true }];
  });
}

/** The quote of a reply, or null when the message is not a reply (or what it quoted was deleted). */
export function lerCitacao(
  replyToId: string | null,
  displayName: string | null,
  body: string | null
): Citacao | null {
  return replyToId ? { id: replyToId, displayName, body } : null;
}

/** My reaction to a message, if any. */
export function minhaReacao(reacoes: readonly Reacao[]): Emoji | null {
  return reacoes.find((reacao) => reacao.mine)?.emoji ?? null;
}

/** Tapping an emoji: the same one again takes it away (null), another one replaces it. */
export function proximaReacao(reacoes: readonly Reacao[], escolhida: Emoji): Emoji | null {
  return minhaReacao(reacoes) === escolhida ? null : escolhida;
}

/** Whether your own message can still be edited at `agora` (ms). */
export function aindaDaParaEditar(criadaEm: string, agora: number) {
  const criada = Date.parse(criadaEm);
  return Number.isFinite(criada) && agora - criada < JANELA_DE_EDICAO_MS;
}
