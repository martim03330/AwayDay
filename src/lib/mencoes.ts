// Mentions in the chats: «@Nome» for one person, «@todos» for everyone in the chat. The app works out who was
// mentioned from the names in the text; the server keeps only people who are really in that chat.

export const TODOS = 'todos';

export type Mencionavel = { profileId: string; nome: string; fotoUrl?: string | null };

/** Lower case, without accents: «Andre» finds «André». */
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function escapar(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The «@...» being typed at the end of the text (what comes after the @), or null when there is none. */
export function mencaoAEscrever(texto: string): string | null {
  const encontrada = /(?:^|\s)@([^\s@]{0,30})$/u.exec(texto);
  return encontrada ? encontrada[1] : null;
}

/** Who to offer for what was typed after the @: «todos» first when it fits, then people whose name starts with it. */
export function sugestoesDeMencao(
  consulta: string,
  pessoas: readonly Mencionavel[],
  maximo = 6
): { todos: boolean; pessoas: Mencionavel[] } {
  const procura = normalizar(consulta);
  const encontradas = pessoas.filter((pessoa) =>
    normalizar(pessoa.nome)
      .split(/\s+/)
      .some((palavra) => palavra.startsWith(procura))
  );
  return { todos: TODOS.startsWith(procura), pessoas: encontradas.slice(0, maximo) };
}

/** The text with the «@...» being typed replaced by the chosen name, and a space to keep writing. */
export function inserirMencao(texto: string, nome: string) {
  return texto.replace(/@[^\s@]*$/u, `@${nome} `);
}

/** «@Nome» counts only when followed by the end, a space or punctuation, never by more letters. */
function padraoDe(nomes: readonly string[]) {
  const ordenados = [...new Set(nomes)].filter((nome) => nome.length > 0).sort((a, b) => b.length - a.length);
  return new RegExp(`@(${[TODOS, ...ordenados].map(escapar).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
}

/** Who the text mentions: the people named with @ and whether it says «@todos». */
export function mencoesNoTexto(texto: string, pessoas: readonly Mencionavel[]) {
  const citados = new Set(
    [...texto.matchAll(padraoDe(pessoas.map((pessoa) => pessoa.nome)))].map((encontrada) =>
      encontrada[1].toLowerCase()
    )
  );
  return {
    todos: citados.has(TODOS),
    ids: [
      ...new Set(
        pessoas.filter((pessoa) => citados.has(pessoa.nome.toLowerCase())).map((pessoa) => pessoa.profileId)
      ),
    ],
  };
}

/** The text in pieces, the mentions apart, so a bubble can draw them in bold. */
export function partesComMencoes(texto: string, nomes: readonly string[]) {
  const partes: { texto: string; mencao: boolean }[] = [];
  let desde = 0;
  for (const encontrada of texto.matchAll(padraoDe(nomes))) {
    const inicio = encontrada.index;
    if (inicio > desde) partes.push({ texto: texto.slice(desde, inicio), mencao: false });
    partes.push({ texto: encontrada[0], mencao: true });
    desde = inicio + encontrada[0].length;
  }
  if (desde < texto.length) partes.push({ texto: texto.slice(desde), mencao: false });
  return partes;
}
