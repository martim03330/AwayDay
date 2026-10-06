const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

/** Minutes Lisbon is ahead of UTC at a given moment (60 in summer, 0 in winter). */
export function desvioDeLisboaMin(instante: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instante)
      .map((parte) => [parte.type, parte.value])
  );
  const comoUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute)
  );
  return Math.round((comoUtc - Math.floor(instante.getTime() / 60000) * 60000) / 60000);
}

/**
 * The demo's sample games carry fixed dates, which end up in the past and leave demo mode showing «Jornada de
 * descanso». This moves them forward by whole weeks until the first one is still to come: same weekday, same spacing,
 * and the same time on Lisbon's clock (corrected when the move crosses a summer/winter time change).
 */
export function aproximarDoPresente<T extends { kickoff_at: string }>(jogos: readonly T[], agora: number): T[] {
  if (jogos.length === 0) return [...jogos];
  const primeiro = Math.min(...jogos.map((jogo) => Date.parse(jogo.kickoff_at)));
  if (primeiro >= agora) return [...jogos];
  const semanas = Math.ceil((agora - primeiro) / SEMANA_MS);
  return jogos.map((jogo) => {
    const antes = new Date(jogo.kickoff_at);
    const depois = new Date(antes.getTime() + semanas * SEMANA_MS);
    const acerto = (desvioDeLisboaMin(antes) - desvioDeLisboaMin(depois)) * 60000;
    return { ...jogo, kickoff_at: new Date(depois.getTime() + acerto).toISOString() };
  });
}
