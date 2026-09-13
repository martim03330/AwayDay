import type { AvaliacaoVisita, Competicao, Jogo } from '@/mocks/tipos';

const MINUTO_MS = 60 * 1000;

/** 90 min de jogo, 15 de intervalo e 10 de descontos. */
export const DURACAO_JOGO_MINUTOS = 115;

export type EstadoJogo = 'agendado' | 'a-decorrer' | 'terminado';

export type FiltroCompeticao = 'todas' | 'liga' | 'liga-2' | 'liga-3' | 'europa' | 'tacas';

export function fimDoJogo(jogo: Pick<Jogo, 'inicio'>) {
  return new Date(Date.parse(jogo.inicio) + DURACAO_JOGO_MINUTOS * MINUTO_MS);
}

export function estadoDoJogo(jogo: Pick<Jogo, 'inicio'>, agora: number): EstadoJogo {
  if (agora < Date.parse(jogo.inicio)) return 'agendado';
  if (agora < fimDoJogo(jogo).getTime()) return 'a-decorrer';
  return 'terminado';
}

export function eCompeticaoEuropeia(competicao: Competicao) {
  return competicao === 'champions' || competicao === 'liga-europa' || competicao === 'conference';
}

export function correspondeCompeticao(jogo: Pick<Jogo, 'competicao'>, filtro: FiltroCompeticao) {
  if (filtro === 'todas') return true;
  if (filtro === 'europa') return eCompeticaoEuropeia(jogo.competicao);
  if (filtro === 'tacas') {
    return jogo.competicao === 'taca-de-portugal' || jogo.competicao === 'taca-da-liga';
  }
  return jogo.competicao === filtro;
}

export function notaMedia(avaliacao: Pick<AvaliacaoVisita, 'estadio' | 'ambiente' | 'acessos'>) {
  return (avaliacao.estadio + avaliacao.ambiente + avaliacao.acessos) / 3;
}
