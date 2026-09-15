import { chaveDoDia, dataEmLisboaAPartirDe } from '@/lib/datas';
import { fimDoJogo } from '@/lib/jogos';
import type { Jogo, Local, UltimoTransporte } from '@/mocks/tipos';

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

/** Mais do que isto antes do apito: fase do almoço. */
export const ANTECEDENCIA_ALMOCO_MS = 4 * HORA_MS;
/** Menos do que isto antes do apito: está na hora de andar. */
export const ANTECEDENCIA_A_CAMINHO_MS = 90 * MINUTO_MS;
/** O relógio continua visível até este tempo depois do apito final. */
export const JANELA_DEPOIS_DO_JOGO_MS = 3 * HORA_MS;
/** Tempo para passar a porta e chegar ao lugar. */
export const MARGEM_PARA_ENTRAR_MINUTOS = 15;

export type FaseDiaDeJogo = 'almoco' | 'check-in' | 'a-caminho' | 'a-decorrer' | 'depois';

export const FASES_DIA_DE_JOGO: readonly FaseDiaDeJogo[] = [
  'almoco',
  'check-in',
  'a-caminho',
  'a-decorrer',
  'depois',
];

export const nomesFase: Record<FaseDiaDeJogo, string> = {
  almoco: 'Almoço',
  'check-in': 'Check-in',
  'a-caminho': 'A caminho',
  'a-decorrer': 'Em jogo',
  depois: 'Depois do apito',
};

export function eFaseDiaDeJogo(valor: string): valor is FaseDiaDeJogo {
  return (FASES_DIA_DE_JOGO as readonly string[]).includes(valor);
}

export function faseDoDiaDeJogo(jogo: Pick<Jogo, 'inicio'>, agora: number): FaseDiaDeJogo {
  const inicio = Date.parse(jogo.inicio);
  if (agora >= fimDoJogo(jogo).getTime()) return 'depois';
  if (agora >= inicio) return 'a-decorrer';
  const falta = inicio - agora;
  if (falta > ANTECEDENCIA_ALMOCO_MS) return 'almoco';
  if (falta > ANTECEDENCIA_A_CAMINHO_MS) return 'check-in';
  return 'a-caminho';
}

/** Visível desde as 00:00 (Lisboa) do dia do jogo até 3 h depois do apito final. */
export function mostrarRelogio(jogo: Pick<Jogo, 'inicio'>, agora: number) {
  const inicio = Date.parse(jogo.inicio);
  if (agora >= fimDoJogo(jogo).getTime() + JANELA_DEPOIS_DO_JOGO_MS) return false;
  return agora >= inicio || chaveDoDia(new Date(agora)) === chaveDoDia(new Date(inicio));
}

/** Um instante representativo de cada fase, usado pelo modo demo. */
export function momentoDaFase(jogo: Pick<Jogo, 'inicio'>, fase: FaseDiaDeJogo) {
  const inicio = Date.parse(jogo.inicio);
  switch (fase) {
    case 'almoco':
      return inicio - 5 * HORA_MS;
    case 'check-in':
      return inicio - 150 * MINUTO_MS;
    case 'a-caminho':
      return inicio - 45 * MINUTO_MS;
    case 'a-decorrer':
      return inicio + 50 * MINUTO_MS;
    case 'depois':
      return fimDoJogo(jogo).getTime() + 20 * MINUTO_MS;
  }
}

/** "3 h 05 min" acima de uma hora, "38 min 07 s" abaixo. */
export function formatarContagem(ms: number) {
  const segundosTotais = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(segundosTotais / 3600);
  const minutos = Math.floor((segundosTotais % 3600) / 60);
  const segundos = segundosTotais % 60;
  if (horas > 0) return `${horas} h ${String(minutos).padStart(2, '0')} min`;
  return `${minutos} min ${String(segundos).padStart(2, '0')} s`;
}

/** O tasco com melhor petiscómetro; em empate, o mais perto do estádio. */
export function tascoParaAlmocar(locais: readonly Local[]) {
  return [...locais].sort(
    (a, b) => (b.petiscometro ?? 0) - (a.petiscometro ?? 0) || a.distanciaMetros - b.distanciaMetros
  )[0];
}

/** O tasco com mais gente agora; em empate, o mais perto do estádio. */
export function tascoMaisConcorrido(
  locais: readonly Local[],
  pessoasAqui: (local: Local) => number | null
) {
  return [...locais].sort(
    (a, b) => (pessoasAqui(b) ?? 0) - (pessoasAqui(a) ?? 0) || a.distanciaMetros - b.distanciaMetros
  )[0];
}

/** Última hora para sair a pé e ainda entrar antes do apito. */
export function horaLimiteParaSair(jogo: Pick<Jogo, 'inicio'>, minutosAPe: number) {
  return new Date(
    Date.parse(jogo.inicio) - (minutosAPe + MARGEM_PARA_ENTRAR_MINUTOS) * MINUTO_MS
  );
}

/** Partida do último transporte: no dia do jogo, ou no dia seguinte se for antes do fim do jogo. */
export function partidaDoUltimoTransporte(jogo: Pick<Jogo, 'inicio'>, transporte: UltimoTransporte) {
  const inicio = new Date(jogo.inicio);
  const noDiaDoJogo = dataEmLisboaAPartirDe(inicio, 0, transporte.hora);
  return noDiaDoJogo.getTime() >= fimDoJogo(jogo).getTime()
    ? noDiaDoJogo
    : dataEmLisboaAPartirDe(inicio, 1, transporte.hora);
}
