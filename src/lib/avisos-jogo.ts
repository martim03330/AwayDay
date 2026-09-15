import { chaveDoDia, dataEmLisboaAPartirDe, formatarHora } from '@/lib/datas';
import { horaLimiteParaSair } from '@/lib/relogio';
import type { Jogo, Local } from '@/mocks/tipos';

/**
 * "O meu jogo": the times that matter on the day and the reminders the phone schedules for a game the fan is going to.
 * Pure: the caller schedules them. Reminders to plan never come on the day before the game (time to plan the trip).
 */

const MINUTO_MS = 60 * 1000;

/** Plan reminder: this many days before, at this time in Lisbon. */
export const DIAS_ANTES_DO_LEMBRETE = 3;
export const HORA_DO_LEMBRETE = '19:00';
/** Get to the tasco this long before kick-off. */
export const CHEGAR_AO_TASCO_MINUTOS_ANTES = 150;
/** Leave the tasco a little before the last possible moment. */
export const FOLGA_PARA_SAIR_MINUTOS = 10;
/** Without a tasco: head to the stadium this long before kick-off. */
export const IR_PARA_O_ESTADIO_MINUTOS_ANTES = 90;

export type HorasDoPlano = {
  /** `null` without a tasco. */
  chegarAoTasco: Date | null;
  sairParaOEstadio: Date;
};

export type AvisoJogo = { id: string; quando: Date; titulo: string; corpo: string };

export function horasDoPlano(
  jogo: Pick<Jogo, 'inicio'>,
  local: Pick<Local, 'minutosAPe'> | null
): HorasDoPlano {
  const inicio = Date.parse(jogo.inicio);
  if (!local) {
    return {
      chegarAoTasco: null,
      sairParaOEstadio: new Date(inicio - IR_PARA_O_ESTADIO_MINUTOS_ANTES * MINUTO_MS),
    };
  }
  return {
    chegarAoTasco: new Date(inicio - CHEGAR_AO_TASCO_MINUTOS_ANTES * MINUTO_MS),
    sairParaOEstadio: new Date(
      horaLimiteParaSair(jogo, local.minutosAPe).getTime() - FOLGA_PARA_SAIR_MINUTOS * MINUTO_MS
    ),
  };
}

/**
 * The reminders still in the future. With a provisional kick-off time only the plan reminder: the day may hold, the
 * hours may not.
 */
export function avisosDoJogo(
  jogo: Pick<Jogo, 'id' | 'inicio' | 'horaConfirmada'>,
  equipas: { casa: string; fora: string },
  local: Pick<Local, 'nome' | 'minutosAPe'> | null,
  agora: number
): AvisoJogo[] {
  const inicio = new Date(jogo.inicio);
  const nomeDoJogo = `${equipas.casa} x ${equipas.fora}`;
  const avisos: AvisoJogo[] = [];

  const plano = dataEmLisboaAPartirDe(inicio, -DIAS_ANTES_DO_LEMBRETE, HORA_DO_LEMBRETE);
  const vespera = chaveDoDia(dataEmLisboaAPartirDe(inicio, -1, '12:00'));
  if (chaveDoDia(plano) !== vespera) {
    avisos.push({
      id: `${jogo.id}:plano`,
      quando: plano,
      titulo: `Faltam ${DIAS_ANTES_DO_LEMBRETE} dias para o ${nomeDoJogo}`,
      corpo: local
        ? `Tasco escolhido: ${local.nome}. Vê a que horas deves sair e combina com a malta.`
        : 'Escolhe o tasco para antes do jogo e combina a ida com a malta.',
    });
  }

  if (jogo.horaConfirmada) {
    const horas = horasDoPlano(jogo, local);
    if (local && horas.chegarAoTasco) {
      avisos.push({
        id: `${jogo.id}:tasco`,
        quando: horas.chegarAoTasco,
        titulo: `Hora de ir para ${local.nome}`,
        corpo: `O ${nomeDoJogo} começa às ${formatarHora(inicio)}.`,
      });
    }
    avisos.push({
      id: `${jogo.id}:estadio`,
      quando: horas.sairParaOEstadio,
      titulo: 'Hora de ir para o estádio',
      corpo: local
        ? `São ${local.minutosAPe} min a pé de ${local.nome} até ao estádio. O jogo começa às ${formatarHora(inicio)}.`
        : `O ${nomeDoJogo} começa às ${formatarHora(inicio)}.`,
    });
  }

  return avisos.filter((aviso) => aviso.quando.getTime() > agora);
}
