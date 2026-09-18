import { dataEmLisboaAPartirDe } from '@/lib/datas';
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

/** O próximo jogo (a decorrer ou agendado) num estádio. */
export function proximoJogoNoEstadio(jogos: readonly Jogo[], estadioId: string, agora: number) {
  return jogos
    .filter((jogo) => jogo.estadioId === estadioId && estadoDoJogo(jogo, agora) !== 'terminado')
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
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

/** The user's clubs: the one they support and, when set and different, their home-town club. */
export function clubesDoUtilizador(clubeFavoritoId: string, clubeDaTerraId: string | null): string[] {
  return clubeDaTerraId && clubeDaTerraId !== clubeFavoritoId
    ? [clubeFavoritoId, clubeDaTerraId]
    : [clubeFavoritoId];
}

export function eJogoDosClubes(jogo: Pick<Jogo, 'casaId' | 'foraId'>, clubeIds: readonly string[]) {
  return clubeIds.includes(jogo.casaId) || clubeIds.includes(jogo.foraId);
}

/**
 * Whether a fixture still belongs in the games list. Upcoming and live ones always do. A finished one
 * stays only for someone who went, until the end of the following day in Lisbon, so there is time to
 * review it; after that it lives in the user's history. Fixtures are never deleted: they keep counting
 * for stats, recaps and rankings.
 */
export function ficaNaListaDeJogos(jogo: Pick<Jogo, 'inicio'>, agora: number, foste: boolean) {
  if (estadoDoJogo(jogo, agora) !== 'terminado') return true;
  if (!foste) return false;
  return agora < dataEmLisboaAPartirDe(fimDoJogo(jogo), 2, '00:00').getTime();
}
