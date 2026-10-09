/**
 * When a ride should leave: suggested from the trip itself and adjustable by the driver in 15-minute steps. Pure: the
 * screen shows it, the server still checks the hard limits (published 3 h before, before kick-off, at most 3 days
 * before).
 */

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

/**
 * How long before kick-off to be at the stadium on a normal game: time for the tasco, the queue and the gates, not a
 * run from the car park. The same margin drives the suggested departure and the car park arrival time.
 */
export const MARGEM_MINUTOS = 60;
/** Big games (Benfica, FC Porto or Sporting involved, or European nights): more traffic, queues and police. */
export const MARGEM_JOGO_GRANDE_MINUTOS = 90;
export const PASSO_MINUTOS = 15;
/** Arriving closer than this to kick-off is not allowed. */
export const CHEGAR_ANTES_MINUTOS = 30;
/** The server refuses rides published less than this before they leave. */
export const PUBLICAR_HORAS_ANTES = 3;
/** The server refuses rides leaving more than this before kick-off. */
export const MAX_DIAS_ANTES = 3;

export type Trajeto = {
  /** Kick-off, in ISO 8601. */
  inicio: string;
  /** Driving time of the chosen route, in seconds; `null` before seeing the routes. */
  duracaoS: number | null;
  /** Walk from the chosen car park to the stadium; `null` when no car park was chosen. */
  minutosAPeDoParque: number | null;
  /** How much earlier this car park asks for, from `minutosExtraDoParque`: the ones that fill early need it. */
  minutosExtraDoParque?: number;
  jogoGrande: boolean;
};

function arredondarParaBaixo(ms: number) {
  const passo = PASSO_MINUTOS * MINUTO_MS;
  return Math.floor(ms / passo) * passo;
}

/** The margin used for this game, in minutes. */
export function margemMinutos(jogoGrande: boolean) {
  return jogoGrande ? MARGEM_JOGO_GRANDE_MINUTOS : MARGEM_MINUTOS;
}

/**
 * Suggested departure: kick-off minus the drive, the walk from the car park and the margin, rounded down to 15 minutes.
 * Without the routes yet, 3 hours before kick-off.
 */
export function saidaSugerida(trajeto: Trajeto): Date {
  const inicio = Date.parse(trajeto.inicio);
  if (trajeto.duracaoS === null) return new Date(arredondarParaBaixo(inicio - 3 * HORA_MS));
  const antes =
    trajeto.duracaoS * 1000 +
    (trajeto.minutosAPeDoParque ?? 0) * MINUTO_MS +
    (trajeto.minutosExtraDoParque ?? 0) * MINUTO_MS +
    margemMinutos(trajeto.jogoGrande) * MINUTO_MS;
  return new Date(arredondarParaBaixo(inicio - antes));
}

export type LimitesSaida = { maisCedo: Date; maisTarde: Date } | null;

/**
 * The window the driver can pick from: not earlier than 3 days before kick-off, not later than 30 minutes before it,
 * and never less than 3 hours from now (in 15-minute steps). `null` when the window is already closed.
 */
export function limitesDaSaida(inicioIso: string, agora: number): LimitesSaida {
  const inicio = Date.parse(inicioIso);
  const passo = PASSO_MINUTOS * MINUTO_MS;
  const maisCedo = Math.max(
    Math.ceil((inicio - MAX_DIAS_ANTES * 24 * HORA_MS) / passo) * passo,
    Math.ceil((agora + PUBLICAR_HORAS_ANTES * HORA_MS) / passo) * passo
  );
  const maisTarde = arredondarParaBaixo(inicio - CHEGAR_ANTES_MINUTOS * MINUTO_MS);
  if (maisCedo > maisTarde) return null;
  return { maisCedo: new Date(maisCedo), maisTarde: new Date(maisTarde) };
}

/** Keeps a departure inside the window. */
export function limitarSaida(saida: Date, limites: NonNullable<LimitesSaida>) {
  const ms = Math.min(
    Math.max(saida.getTime(), limites.maisCedo.getTime()),
    limites.maisTarde.getTime()
  );
  return new Date(ms);
}

/** Moves a departure by whole 15-minute steps (negative is earlier), inside the window. */
export function ajustarSaida(saida: Date, passos: number, limites: NonNullable<LimitesSaida>) {
  return limitarSaida(new Date(saida.getTime() + passos * PASSO_MINUTOS * MINUTO_MS), limites);
}

/** Whether leaving at `saida` gives less time than suggested (the driver should be warned). */
export function saidaApertada(saida: Date, sugerida: Date) {
  return saida.getTime() > sugerida.getTime();
}

/**
 * When to be at the car park: kick-off, minus the margin (an hour, an hour and a half on big games, so there is time
 * for the tasco), minus the walk to the ground, minus the extra the car park itself asks for. Rounded down to 5
 * minutes. Same margin as the suggested departure, so the two never disagree.
 */
export function chegadaRecomendada({
  inicio,
  minutosAPeDoParque,
  minutosExtraDoParque = 0,
  jogoGrande = false,
}: {
  inicio: string;
  minutosAPeDoParque: number | null;
  minutosExtraDoParque?: number;
  jogoGrande?: boolean;
}): Date {
  const antes =
    (margemMinutos(jogoGrande) + (minutosAPeDoParque ?? 0) + minutosExtraDoParque) * MINUTO_MS;
  const passo = 5 * MINUTO_MS;
  return new Date(Math.floor((Date.parse(inicio) - antes) / passo) * passo);
}
