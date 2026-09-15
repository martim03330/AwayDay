/**
 * How easy it probably is to park somewhere on match day. An *estimate*, never a promise: no free source publishes
 * how full car parks are in Portugal (checked 2026-09-16), so this reads what is known — distance to the stadium, how
 * many spaces the car park has and whether it closes on match days — the way any fan would.
 *
 * The rule of thumb it encodes: what is glued to the stadium fills first, and a big car park a walk away is usually
 * still open when the near ones are full. Big games make everything near the ground worse.
 */

const METROS_POR_MINUTO = 80;
/** Streets are not straight lines: walking is longer than the distance in a straight line. */
const DETOUR_FACTOR = 1.3;

const PERTO_M = 500;
const LONGE_M = 1200;
const GRANDE_LUGARES = 300;
const PEQUENO_LUGARES = 50;

export type Facilidade = 'facil' | 'media' | 'dificil' | 'desconhecida';

export type ParqueParaFacilidade = {
  distanceM: number | null;
  capacity: number | null;
  openOnMatchdays: boolean | null;
};

export type EstimativaParque = {
  nivel: Facilidade;
  /** Why it is estimated like this, in one short line. */
  motivo: string;
};

/** Minutes on foot from a car park to the stadium; `null` when the distance is unknown. */
export function minutosAPe(distanceM: number | null) {
  if (distanceM === null) return null;
  return Math.max(1, Math.round((distanceM * DETOUR_FACTOR) / METROS_POR_MINUTO));
}

const PIOR: Record<Facilidade, Facilidade> = {
  facil: 'media',
  media: 'dificil',
  dificil: 'dificil',
  desconhecida: 'desconhecida',
};

/**
 * How much earlier than normal you have to be at a car park for it to still have a space. A car park that fills early
 * only has room for whoever gets there early: this is the honest price of parking next to the ground.
 */
export const MINUTOS_EXTRA: Record<Facilidade, number> = {
  facil: 0,
  media: 20,
  dificil: 45,
  desconhecida: 15,
};

/** The extra minutes this car park asks for on this game. */
export function minutosExtraDoParque(
  parque: ParqueParaFacilidade,
  { jogoGrande = false }: { jogoGrande?: boolean } = {}
) {
  return MINUTOS_EXTRA[facilidadeEstacionamento(parque, { jogoGrande }).nivel];
}

/** What the colour means, for the legend and for screen readers. */
export const ROTULO_FACILIDADE: Record<Facilidade, string> = {
  facil: 'Costuma haver lugar',
  media: 'Pode ser difícil',
  dificil: 'Enche cedo',
  desconhecida: 'Sem dados',
};

/**
 * The estimate for one car park. `jogoGrande` makes everything within a kilometre of the ground worse: more people,
 * more cars and streets cut off.
 */
export function facilidadeEstacionamento(
  parque: ParqueParaFacilidade,
  { jogoGrande = false }: { jogoGrande?: boolean } = {}
): EstimativaParque {
  if (parque.openOnMatchdays === false) {
    return { nivel: 'dificil', motivo: 'Fecha em dias de jogo.' };
  }
  if (parque.distanceM === null) {
    return { nivel: 'desconhecida', motivo: 'Não sabemos a que distância fica.' };
  }

  const lugares = parque.capacity;
  const grande = lugares !== null && lugares >= GRANDE_LUGARES;
  const pequeno = lugares !== null && lugares < PEQUENO_LUGARES;

  let nivel: Facilidade;
  let motivo: string;
  if (parque.distanceM < PERTO_M) {
    nivel = grande ? 'media' : 'dificil';
    motivo = 'Colado ao estádio: é o primeiro a encher.';
  } else if (parque.distanceM < LONGE_M) {
    nivel = grande ? 'facil' : 'media';
    motivo = grande
      ? `Perto do estádio, mas com ${lugares} lugares.`
      : 'A uns minutos a pé: enche, mas mais tarde.';
  } else {
    nivel = pequeno ? 'media' : 'facil';
    motivo = pequeno
      ? `Longe do estádio, mas só com ${lugares} lugares.`
      : 'Longe do estádio: costuma sobrar espaço.';
  }

  if (jogoGrande && parque.distanceM < LONGE_M) {
    const pior = PIOR[nivel];
    if (pior !== nivel)
      return { nivel: pior, motivo: `${motivo} Num jogo grande, ainda mais cedo.` };
  }
  return { nivel, motivo };
}
