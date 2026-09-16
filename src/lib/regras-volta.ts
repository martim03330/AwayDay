/**
 * Boleia de volta: when a fan who missed their transport can ask for a seat home, and when the driver is still
 * expected to answer. The same window lives in the database (`ride_return_opens_at`, `ride_return_closes_at`), which
 * is what actually decides; this is here so the app only shows the option when it exists.
 */

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

/** Com o apito: quem chegou ao estádio já sabe se tem maneira de voltar. */
export const ABRE_APOS_APITO_MINUTOS = 0;
/** About an hour after the final whistle: after that the cars are gone. */
export const FECHA_APOS_APITO_MINUTOS = 210;
/** The driver still has an hour after the window closes to answer whoever asked. */
export const RESPOSTA_EXTRA_MINUTOS = 60;

export type JanelaDaVolta = { abre: Date; fecha: Date };

export function janelaDaVolta(inicioIso: string): JanelaDaVolta {
  const inicio = Date.parse(inicioIso);
  return {
    abre: new Date(inicio + ABRE_APOS_APITO_MINUTOS * MINUTO_MS),
    fecha: new Date(inicio + FECHA_APOS_APITO_MINUTOS * MINUTO_MS),
  };
}

/** Whether a fan can ask for a seat home right now. */
export function podePedirVolta(inicioIso: string, agora: number) {
  const { abre, fecha } = janelaDaVolta(inicioIso);
  return agora >= abre.getTime() && agora <= fecha.getTime();
}

/** Whether the driver is still expected to answer requests for a seat home. */
export function podeResponderVolta(inicioIso: string, agora: number) {
  return agora <= janelaDaVolta(inicioIso).fecha.getTime() + RESPOSTA_EXTRA_MINUTOS * MINUTO_MS;
}

/** Whether the game is close enough for the app to mention seats home at all (from kick-off to the end of the day). */
export function eDiaDeVolta(inicioIso: string, agora: number) {
  const inicio = Date.parse(inicioIso);
  return agora >= inicio && agora <= inicio + 12 * HORA_MS;
}
