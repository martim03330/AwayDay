/**
 * Ride rules the app shows and schedules: deadlines around the departure and the phone reminders for a ride the fan is
 * in. The server enforces the same numbers (supabase/migrations/20260916180000_ride_reliability.sql); these are for
 * display and reminders only. Pure: no I/O.
 */

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

/** A ride must be published at least this long before it leaves. */
export const CRIAR_HORAS_ANTES = 3;
/** Requests close (and unanswered ones expire) this long before departure; until then anyone cancels without a fault. */
export const PEDIDOS_FECHAM_HORAS_ANTES = 2;
/** Who turned up can be confirmed until this long after departure. */
export const CONFIRMAR_HORAS_DEPOIS = 48;
/** An unforeseen event can be reported until this long after departure. */
export const IMPREVISTO_HORAS_DEPOIS = 24;
/** Votes on an excuse close, and the ride is settled, this long after departure. */
export const VOTAR_HORAS_DEPOIS = 72;

export type PrazosBoleia = {
  /** Last moment to ask for a seat, answer requests or cancel without a fault. */
  pedidosFecham: Date;
  /** From departure until then: confirm who turned up. */
  confirmarAte: Date;
  /** From when requests close until then: report an unforeseen event. */
  imprevistoAte: Date;
  votarAte: Date;
};

export function prazosDaBoleia(partida: Date): PrazosBoleia {
  const saida = partida.getTime();
  return {
    pedidosFecham: new Date(saida - PEDIDOS_FECHAM_HORAS_ANTES * HORA_MS),
    confirmarAte: new Date(saida + CONFIRMAR_HORAS_DEPOIS * HORA_MS),
    imprevistoAte: new Date(saida + IMPREVISTO_HORAS_DEPOIS * HORA_MS),
    votarAte: new Date(saida + VOTAR_HORAS_DEPOIS * HORA_MS),
  };
}

/** What a participant can do at `agora`. */
export type FaseBoleia =
  /** Requests open, free cancellation. */
  | 'aberta'
  /** Requests closed: leaving now is a late cancellation unless an unforeseen event is accepted. */
  | 'fechada'
  /** Departed: confirm who turned up. */
  | 'a-confirmar'
  /** Nothing left to do. */
  | 'terminada';

export function faseDaBoleia(partida: Date, agora: number): FaseBoleia {
  const prazos = prazosDaBoleia(partida);
  if (agora < prazos.pedidosFecham.getTime()) return 'aberta';
  if (agora < partida.getTime()) return 'fechada';
  if (agora < prazos.confirmarAte.getTime()) return 'a-confirmar';
  return 'terminada';
}

/** Whether a ride leaving at `partida` can still be published at `agora`. */
export function podeCriarBoleia(partida: Date, agora: number) {
  return partida.getTime() - agora >= CRIAR_HORAS_ANTES * HORA_MS;
}

export function podeReportarImprevisto(partida: Date, agora: number) {
  const prazos = prazosDaBoleia(partida);
  return agora >= prazos.pedidosFecham.getTime() && agora <= prazos.imprevistoAte.getTime();
}

export type BoleiaParaAvisos = {
  id: string;
  /** The game, so tapping a reminder opens the ride. */
  jogoId: string;
  partida: Date;
  origem: string;
  papel: 'condutor' | 'passageiro';
};

export type AvisoBoleia = {
  id: string;
  jogoId: string;
  quando: Date;
  titulo: string;
  corpo: string;
};

/**
 * Reminders for rides the fan drives or has a seat in: the day before, 3 h before (with the no-show warning) and,
 * after departure, a nudge to confirm who turned up. Only future ones.
 */
export function avisosDasBoleias(
  boleias: readonly BoleiaParaAvisos[],
  agora: number
): AvisoBoleia[] {
  return boleias
    .flatMap((boleia) => {
      const saida = boleia.partida.getTime();
      const quem = boleia.papel === 'condutor' ? 'Levas' : 'Vais com';
      return [
        {
          id: `${boleia.id}:24h`,
          jogoId: boleia.jogoId,
          quando: new Date(saida - 24 * HORA_MS),
          titulo: 'Boleia amanhã',
          corpo:
            boleia.papel === 'condutor'
              ? `Sais de ${boleia.origem}. Se não puderes, cancela até 2 h antes para ninguém ficar em terra.`
              : `Encontro em ${boleia.origem}. Se não puderes, cancela até 2 h antes para não ficares com uma falta.`,
        },
        {
          id: `${boleia.id}:3h`,
          jogoId: boleia.jogoId,
          quando: new Date(saida - 3 * HORA_MS),
          titulo: 'Boleia daqui a 3 horas',
          corpo: `${quem} a malta a partir de ${boleia.origem}. Faltar sem avisar mancha a tua reputação.`,
        },
        {
          id: `${boleia.id}:confirmar`,
          jogoId: boleia.jogoId,
          quando: new Date(saida + 4 * HORA_MS),
          titulo: 'Quem apareceu?',
          corpo: 'Confirma quem foi na boleia. Ajuda a malta a saber em quem confiar.',
        },
      ];
    })
    .filter((aviso) => aviso.quando.getTime() > agora)
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());
}
