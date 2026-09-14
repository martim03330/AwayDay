// Nudge sentences. Templates always work and cost nothing. When the model is enabled, it also writes
// with slots only, and its sentence is accepted only if it follows every rule below. Pure and testable.

import type { NudgeKind, Slots } from './nudge-slots.ts';

export const MAX_NUDGE_LENGTH = 140;

type Template = {
  variants: readonly string[];
  /** Short version, used when every variant is too long for the names involved. */
  fallback: string;
  /** Each group lists interchangeable slots; at least one of each group must appear. */
  required: readonly (readonly string[])[];
};

export const NUDGE_TEMPLATES: Readonly<Record<NudgeKind, Template>> = {
  tasco_primeira_visita: {
    variants: [
      'Vais {estadio_a} pela primeira vez: {tasco} fica a {minutos} a pé. Fica a dica.',
      'Primeira vez {estadio_em}? {Tasco} fica a {minutos} do estádio. Chega cedo e petisca.',
      'Estreia {estadio_em} {quando}. Antes do apito, {tasco} fica a {minutos} a pé.',
    ],
    fallback: '{Tasco} fica a {minutos} a pé do estádio.',
    required: [['tasco', 'Tasco'], ['minutos']],
  },
  marco_passaporte: {
    variants: [
      '{ordinal} estádio no passaporte, com o carimbo {estadio_de}. Isto já é coleção, não é visita.',
      'Já vão {n} estádios diferentes no passaporte. Venha o próximo carimbo.',
      '{Estadio} foi o teu {ordinal} estádio. O passaporte agradece.',
    ],
    fallback: '{ordinal} estádio no passaporte. Venha o próximo.',
    required: [['n', 'ordinal']],
  },
  estadio_novo_em_casa: {
    variants: [
      '{Clube} joga em casa {quando} e ainda não foste {estadio_a}. Está ali um carimbo à tua espera.',
      '{Quando}, {clube} joga em casa, {estadio_em}. Ainda não tens esse carimbo no passaporte.',
      'Jogo {estadio_em} {quando}: {clube} em casa e um estádio que ainda te falta. Bora estrear?',
    ],
    fallback: '{Clube} joga em casa {quando}. Carimbo novo à vista.',
    required: [['clube', 'Clube'], ['quando', 'Quando']],
  },
  clube_perto_de_ti: {
    variants: [
      '{Clube} joga {quando} {estadio_em}, a {km} de ti. Dá para ir apoiar sem grande viagem.',
      '{Quando}, {clube} joga fora mas perto: {estadio_em}, a {km} de ti.',
      'Jogo fora com sabor a casa: {clube} {estadio_em} {quando}, a {km} de ti.',
    ],
    fallback: '{Clube} joga {quando}, a {km} de ti.',
    required: [['clube', 'Clube'], ['km']],
  },
};

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

function hasRequiredSlots(kind: NudgeKind, template: string) {
  const names = slotNames(template);
  return NUDGE_TEMPLATES[kind].required.every((group) => group.some((name) => names.has(name)));
}

/** Stable number from a text, to vary the template per user and day without randomness. */
export function seedFrom(text: string) {
  let hash = 0;
  for (const character of text) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  return hash;
}

/** Template sentence: variants from `seed` onwards, then the short fallback. Never over 140. */
export function templateNudge(kind: NudgeKind, slots: Slots, seed: number): string | null {
  const { variants, fallback } = NUDGE_TEMPLATES[kind];
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
 * or unknown slots, any digit, a catalogue name typed instead of a slot, over 140 characters once
 * filled, or scolding people who did not go to matches.
 */
export function acceptModelNudge(
  kind: NudgeKind,
  template: unknown,
  slots: Slots,
  catalogueNames: readonly string[]
): string | null {
  if (typeof template !== 'string') return null;
  const trimmed = template.trim();
  if (trimmed.length === 0 || /\d/.test(trimmed) || !hasRequiredSlots(kind, trimmed)) return null;

  const text = fill(trimmed, slots);
  if (!text || text.length > MAX_NUDGE_LENGTH) return null;

  const outsideSlots = trimmed.replace(SLOT, ' ').toLocaleLowerCase('pt-PT');
  const typesAName = catalogueNames.some(
    (name) => name.length >= 3 && outsideSlots.includes(name.toLocaleLowerCase('pt-PT'))
  );
  if (typesAName) return null;

  return SCOLDING.some((pattern) => pattern.test(text)) ? null : text;
}
