import type { Avaliacao, Jogo } from '@/mocks/tipos';

const MINUTO_MS = 60 * 1000;

/** 90 min de jogo, 15 de intervalo e 10 de descontos. */
export const DURACAO_JOGO_MINUTOS = 115;

export type EstadoJogo = 'agendado' | 'a-decorrer' | 'terminado';

export type FiltroCompeticao = 'todas' | 'liga' | 'liga-2' | 'liga-3' | 'tacas';

export function fimDoJogo(jogo: Pick<Jogo, 'inicio'>) {
  return new Date(Date.parse(jogo.inicio) + DURACAO_JOGO_MINUTOS * MINUTO_MS);
}

export function estadoDoJogo(jogo: Pick<Jogo, 'inicio'>, agora: number): EstadoJogo {
  if (agora < Date.parse(jogo.inicio)) return 'agendado';
  if (agora < fimDoJogo(jogo).getTime()) return 'a-decorrer';
  return 'terminado';
}

export function correspondeCompeticao(jogo: Pick<Jogo, 'competicao'>, filtro: FiltroCompeticao) {
  if (filtro === 'todas') return true;
  if (filtro === 'tacas') {
    return jogo.competicao === 'taca-de-portugal' || jogo.competicao === 'taca-da-liga';
  }
  return jogo.competicao === filtro;
}

export function notaMedia(avaliacao: Pick<Avaliacao, 'estadio' | 'ambiente' | 'acessos'>) {
  return (avaliacao.estadio + avaliacao.ambiente + avaliacao.acessos) / 3;
}
