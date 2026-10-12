// Which chats have their realtime channel connected right now. While one is, every change already arrives through
// it, so the safety refresh of that chat can be rare; when the channel drops (weak signal at the stadium gate), the
// chat goes back to refreshing often.

const ligados = new Set<string>();

export function marcarCanal(topico: string, ligado: boolean) {
  if (ligado) ligados.add(topico);
  else ligados.delete(topico);
}

export function canalLigado(topico: string) {
  return ligados.has(topico);
}

/** How often a chat refreshes by itself: rarely with the channel connected, `semCanalMs` without it. */
export function intervaloDaConversa(topico: string, semCanalMs: number) {
  return canalLigado(topico) ? 5 * 60 * 1000 : semCanalMs;
}
