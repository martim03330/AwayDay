import type { Division, Mission, MyRanking } from '@/features/ranks/types';

// Words and small calculations for showing the ranking. The numbers themselves come from the server.

/** Titles by level. Generic on purpose: no club or stadium names. */
const TITULOS: readonly { desde: number; titulo: string }[] = [
  { desde: 40, titulo: 'Lenda' },
  { desde: 30, titulo: 'Veterano' },
  { desde: 20, titulo: 'Bancada Fiel' },
  { desde: 15, titulo: 'Viajante' },
  { desde: 10, titulo: 'Habitual' },
  { desde: 5, titulo: 'Adepto' },
  { desde: 1, titulo: 'Estreante' },
];

export function tituloDoNivel(nivel: number) {
  return TITULOS.find((linha) => nivel >= linha.desde)?.titulo ?? 'Estreante';
}

/** The level at which the next title arrives, or `null` at the last one. */
export function proximoTitulo(nivel: number) {
  const seguinte = [...TITULOS].reverse().find((linha) => linha.desde > nivel);
  return seguinte ? { nivel: seguinte.desde, titulo: seguinte.titulo } : null;
}

export const NOMES_DIVISAO: Record<Division, string> = {
  1: 'Liga',
  2: 'Liga 2',
  3: 'Liga 3',
  4: 'Campeonato de Portugal',
  5: 'Distrital',
};

/** Between 0 and 1: how far along the current level. */
export function progressoNoNivel(ranking: Pick<MyRanking, 'totalXp' | 'levelXp' | 'nextLevelXp'>) {
  const largura = ranking.nextLevelXp - ranking.levelXp;
  if (largura <= 0) return 1;
  return Math.min(1, Math.max(0, (ranking.totalXp - ranking.levelXp) / largura));
}

export type ZonaDaDivisao = 'subida' | 'descida' | 'meio';

/**
 * Where the person stands if the season ended today. A blank season drops one division, so with no points yet
 * (and somewhere to drop to) it is the relegation zone.
 */
export function zonaDaDivisao(
  ranking: Pick<
    MyRanking,
    | 'division'
    | 'divisionPosition'
    | 'divisionSize'
    | 'promotionSpots'
    | 'relegationSpots'
    | 'seasonXp'
    | 'promotionMinXp'
  >
): ZonaDaDivisao {
  if (ranking.seasonXp <= 0) return ranking.division < 5 ? 'descida' : 'meio';
  if (
    ranking.division > 1 &&
    ranking.divisionPosition <= ranking.promotionSpots &&
    ranking.seasonXp >= ranking.promotionMinXp
  ) {
    return 'subida';
  }
  if (
    ranking.division < 5 &&
    ranking.relegationSpots > 0 &&
    ranking.divisionPosition > ranking.divisionSize - ranking.relegationSpots
  ) {
    return 'descida';
  }
  return 'meio';
}

const MEDALHAS = { 1: 'Bronze', 2: 'Prata', 3: 'Ouro' } as const;

export function nomeDoPatamar(tier: Mission['tier']) {
  return tier ? MEDALHAS[tier] : null;
}

/**
 * Achievements shown one per family: the first tier not yet done, or the top one when all are done. Earlier tiers
 * that are done are returned as `ganhos`, for the badge shelf.
 */
export function conquistasPorFamilia(missoes: readonly Mission[]) {
  const familias = new Map<string, Mission[]>();
  for (const missao of missoes) {
    if (missao.kind !== 'achievement') continue;
    familias.set(missao.family, [...(familias.get(missao.family) ?? []), missao]);
  }

  return [...familias.values()]
    .map((patamares) => {
      const ordenados = [...patamares].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || a.sort - b.sort);
      const atual = ordenados.find((missao) => missao.completedAt === null) ?? ordenados[ordenados.length - 1];
      return { atual, ganhos: ordenados.filter((missao) => missao.completedAt !== null) };
    })
    .sort((a, b) => a.atual.sort - b.atual.sort);
}

/** Monday of the week of a Lisbon day ('2026-10-08' -> '2026-10-05'), to tell this week's challenges from next. */
export function segundaFeiraDe(diaEmLisboa: string) {
  const [ano, mes, dia] = diaEmLisboa.split('-').map(Number);
  const data = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1));
  const recuar = (data.getUTCDay() + 6) % 7;
  data.setUTCDate(data.getUTCDate() - recuar);
  return data.toISOString().slice(0, 10);
}
