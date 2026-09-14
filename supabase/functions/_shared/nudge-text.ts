// Coach sentences. Templates always work and cost nothing. Names never act as the subject of a verb, so a
// plural name ("as Bifanas de Campanhã", "os Barreiros") cannot break the agreement, and a saved message
// never says "hoje" or "amanhã" about another day. When the model is enabled, it also writes with slots only,
// and its sentence is accepted only if it follows every rule below. Pure and testable.

import type { NudgeKind, Slots } from './nudge-slots.ts';

export const MAX_NUDGE_LENGTH = 140;

/** A kind can have more than one set of sentences, chosen from its facts (see templateIdFor). */
export type TemplateId = NudgeKind | 'estadio_novo_com_vou';

type Template = {
  /** Tried from the seed onwards; a variant whose slots are missing (e.g. no place nearby) is skipped. */
  variants: readonly string[];
  /** Short version, used when no variant fits in 140 characters with the names involved. */
  fallback: string;
  /** Each group lists interchangeable slots; at least one of each group must appear. */
  required: readonly (readonly string[])[];
};

const CLUB = ['clube_de', 'clube', 'Clube'];

export const NUDGE_TEMPLATES: Readonly<Record<TemplateId, Template>> = {
  dia_de_jogo_manha: {
    variants: [
      'Dia de jogo {clube_de}, com apito às {hora}. Almoço perto do estádio: {tasco}, a {minutos} a pé.',
      'Hoje há jogo {clube_de} {estadio_em}, às {hora}. Dá tempo para um almoço sem pressas.',
      'Dia de jogo {clube_de}! Apito às {hora}. Cachecol na mala e bom almoço.',
    ],
    fallback: 'Dia de jogo {clube_de}: apito às {hora}.',
    required: [CLUB, ['hora']],
  },
  dia_de_jogo_chegada: {
    variants: [
      'Jogo {clube_de} às {hora}. A {minutos} {estadio_de} tens {tasco}: boa paragem antes de entrar.',
      'Está quase: jogo {clube_de} às {hora}. Se parares num tasco pelo caminho, faz check-in.',
      'Apito às {hora} {estadio_em}. Chega com tempo, que as filas à porta não perdoam.',
    ],
    fallback: 'Jogo {clube_de} às {hora}. Chega com tempo.',
    required: [CLUB, ['hora']],
  },
  dia_de_jogo_antes_do_apito: {
    variants: [
      'Apito às {hora} {estadio_em}. Está na hora de seguir para o estádio.',
      'Jogo {clube_de} às {hora}: altura de pagar a conta e ir andando.',
      'Quase a começar o jogo {clube_de}. Bilhete à mão e bom jogo!',
    ],
    fallback: 'Apito às {hora}. Bom jogo!',
    required: [['hora', ...CLUB]],
  },
  dia_de_jogo_fim: {
    variants: [
      'Apito final no jogo {clube_de}. Se estiveste {estadio_em}, marca a presença e fica com o carimbo.',
      'Fim de jogo {estadio_em}. Se foste, deixa a tua nota ao estádio: ajuda quem vai a seguir.',
      'Acabou o jogo {clube_de}. Se estiveste na bancada, o carimbo {estadio_de} espera por ti.',
    ],
    fallback: 'Fim de jogo {clube_de}. Até ao próximo.',
    required: [[...CLUB, 'estadio_em', 'estadio_de']],
  },
  checkin_ativo: {
    variants: [
      'Check-in feito {tasco_em}. Se houver prato que valha a pena, recomenda-o aos outros adeptos.',
      'Check-in {tasco_em}, a {minutos} do estádio. Jogo às {hora}: dá para mais um petisco.',
      'Check-in {tasco_em}. Quando saíres, deixa a tua nota: ajuda quem vem a seguir.',
    ],
    fallback: 'Check-in {tasco_em}. Bom petisco!',
    required: [['tasco', 'Tasco', 'tasco_em']],
  },
  marco_passaporte: {
    variants: [
      '{ordinal} estádio no passaporte, com o carimbo {estadio_de}. Isto já é coleção, não é visita.',
      'Já vão {n} estádios diferentes no passaporte. Venha o próximo carimbo.',
      'Carimbo {estadio_de}: o teu {ordinal} estádio. O passaporte agradece.',
    ],
    fallback: '{ordinal} estádio no passaporte. Venha o próximo.',
    required: [['n', 'ordinal']],
  },
  estadio_novo: {
    variants: [
      'Jogo {clube_de} {dia}, {estadio_em}. É um estádio que ainda te falta e dá tempo para planear a ida.',
      '{Dia}, há jogo {clube_de} {estadio_em}. Ainda não tens esse carimbo no passaporte.',
      'Carimbo novo à vista: jogo {clube_de} {estadio_em}, {dia}, às {hora}.',
    ],
    fallback: 'Jogo {clube_de} {dia}. Carimbo novo à vista.',
    required: [CLUB, ['dia', 'Dia']],
  },
  // Already marked "Vou": the trip is planned, so no invitation, just the new stamp.
  estadio_novo_com_vou: {
    variants: [
      'Vais {estadio_a} {dia}: é estreia no passaporte. Chega cedo para conhecer os cantos à casa.',
      'Estreia {estadio_em} {dia}, às {hora}. Perto do estádio: {tasco}, a {minutos} a pé.',
      'Jogo {clube_de} {dia}, com estreia tua {estadio_em}. Carimbo novo a caminho.',
    ],
    fallback: 'Vais {estadio_a} {dia}. Carimbo novo à vista.',
    required: [['estadio_a', 'estadio_em', 'estadio_de'], ['dia', 'Dia']],
  },
};

/** Which set of sentences suits the facts: a new stadium reads differently once the user said "Vou". */
export function templateIdFor(kind: NudgeKind, facts: unknown): TemplateId {
  if (kind !== 'estadio_novo') return kind;
  const going = typeof facts === 'object' && facts !== null ? Reflect.get(facts, 'going') : false;
  return going === true ? 'estadio_novo_com_vou' : kind;
}

const SLOT = /\{([A-Za-z_]+)\}/g;

export function slotNames(template: string) {
  return new Set(Array.from(template.matchAll(SLOT), (match) => match[1] ?? ''));
}

/** Replaces every slot; `null` if the template uses a slot that does not exist. */
export function fill(template: string, slots: Slots): string | null {
  for (const name of slotNames(template)) {
    if (!Object.prototype.hasOwnProperty.call(slots, name)) return null;
  }
  const text = template.replace(SLOT, (_match, name: string) => slots[name] ?? '');
  return /[{}]/.test(text) ? null : text;
}

function hasRequiredSlots(id: TemplateId, template: string) {
  const names = slotNames(template);
  return NUDGE_TEMPLATES[id].required.every((group) => group.some((name) => names.has(name)));
}

/** Stable number from a text, to vary the template per user and context without randomness. */
export function seedFrom(text: string) {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  return hash;
}

/** Template sentence: variants from `seed` onwards, then the short fallback. Never over 140. */
export function templateNudge(id: TemplateId, slots: Slots, seed: number): string | null {
  const { variants, fallback } = NUDGE_TEMPLATES[id];
  for (let offset = 0; offset < variants.length; offset++) {
    const text = fill(variants[(seed + offset) % variants.length] ?? '', slots);
    if (text && text.length <= MAX_NUDGE_LENGTH) return text;
  }
  const text = fill(fallback, slots);
  return text && text.length <= MAX_NUDGE_LENGTH ? text : null;
}

const SCOLDING = [
  /nunca vais/i,
  /pregui/i,
  /vergonha/i,
  /falhaste/i,
  /devias ter/i,
  /abandon/i,
  /não tens ido/i,
  /já não vais/i,
  /desleix/i,
  /deixaste de/i,
];

/**
 * Accepts a sentence the model wrote with slots and fills it in. `null` when it breaks a rule: missing
 * or unknown slots, any digit, "hoje" or "amanhã", a catalogue name typed instead of a slot, over 140
 * characters once filled, or scolding people who did not go to matches.
 */
export function acceptModelNudge(
  id: TemplateId,
  template: unknown,
  slots: Slots,
  catalogueNames: readonly string[]
): string | null {
  if (typeof template !== 'string') return null;
  const trimmed = template.trim();
  if (trimmed.length === 0 || /\d/.test(trimmed) || !hasRequiredSlots(id, trimmed)) return null;
  if (/(?<!\p{L})(hoje|amanhã)(?!\p{L})/iu.test(trimmed)) return null;

  const text = fill(trimmed, slots);
  if (!text || text.length > MAX_NUDGE_LENGTH) return null;

  const outsideSlots = trimmed.replace(SLOT, ' ').toLocaleLowerCase('pt-PT');
  const typesAName = catalogueNames.some(
    (name) => name.length >= 3 && outsideSlots.includes(name.toLocaleLowerCase('pt-PT'))
  );
  if (typesAName) return null;

  return SCOLDING.some((pattern) => pattern.test(text)) ? null : text;
}
