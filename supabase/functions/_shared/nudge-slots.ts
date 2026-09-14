// Turns the facts computed in SQL (coach_context) into ready-made phrases ("slots"). Every value comes from
// the facts: if something required is missing or malformed, there is no message instead of a guess.
// Pure and testable.

import {
  capitalize,
  dayPhrase,
  isArticle,
  minutesPhrase,
  ordinalPhrase,
  timePhrase,
  withArticle,
  withPreposition,
  type Article,
} from './portuguese.ts';

export type NudgeKind =
  | 'dia_de_jogo_manha'
  | 'dia_de_jogo_chegada'
  | 'dia_de_jogo_antes_do_apito'
  | 'dia_de_jogo_fim'
  | 'checkin_ativo'
  | 'marco_passaporte'
  | 'estadio_novo';

export const NUDGE_KINDS: readonly NudgeKind[] = [
  'dia_de_jogo_manha',
  'dia_de_jogo_chegada',
  'dia_de_jogo_antes_do_apito',
  'dia_de_jogo_fim',
  'checkin_ativo',
  'marco_passaporte',
  'estadio_novo',
];

export function isNudgeKind(value: unknown): value is NudgeKind {
  return typeof value === 'string' && (NUDGE_KINDS as readonly string[]).includes(value);
}

export type Slots = Readonly<Record<string, string>>;

type Named = { name: string; article: Article };

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function named(value: unknown, nameKey = 'name', articleKey = 'article'): Named | null {
  const fields = asRecord(value);
  if (!fields) return null;
  const name = fields[nameKey];
  const article = fields[articleKey];
  return typeof name === 'string' && name.trim().length > 0 && isArticle(article)
    ? { name: name.trim(), article }
    : null;
}

/** Prefers the well-known short name ("Barreiros") when there is one. */
function venue(value: unknown): Named | null {
  return named(value, 'short_name', 'short_article') ?? named(value);
}

function wholeNumber(value: unknown, minimum: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum ? value : null;
}

function instant(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function venueSlots(stadium: Named) {
  const phrase = withArticle(stadium.article, stadium.name);
  return {
    estadio: phrase,
    Estadio: capitalize(phrase),
    estadio_a: withPreposition('a', stadium.article, stadium.name),
    estadio_em: withPreposition('em', stadium.article, stadium.name),
    estadio_de: withPreposition('de', stadium.article, stadium.name),
  };
}

function clubSlots(club: Named) {
  const phrase = withArticle(club.article, club.name);
  return { clube: phrase, Clube: capitalize(phrase), clube_de: withPreposition('de', club.article, club.name) };
}

/** The place slots, or `null` when there is no place (it is optional for most kinds). */
function placeSlots(value: unknown) {
  const place = named(value);
  const minutes = wholeNumber(asRecord(value)?.walking_minutes, 0);
  if (!place || minutes === null) return null;
  const phrase = withArticle(place.article, place.name);
  return {
    tasco: phrase,
    Tasco: capitalize(phrase),
    tasco_em: withPreposition('em', place.article, place.name),
    minutos: minutesPhrase(minutes),
  };
}

/** Slots for one context, or `null` when its facts are incomplete. */
export function buildSlots(kind: NudgeKind, facts: unknown): Slots | null {
  const fields = asRecord(facts);
  if (!fields) return null;
  const stadium = venue(fields.venue);

  switch (kind) {
    case 'dia_de_jogo_manha':
    case 'dia_de_jogo_chegada':
    case 'dia_de_jogo_antes_do_apito':
    case 'dia_de_jogo_fim': {
      const club = named(fields.club);
      const kickoff = instant(fields.kickoff_at);
      if (!stadium || !club || !kickoff) return null;
      return { ...venueSlots(stadium), ...clubSlots(club), hora: timePhrase(kickoff), ...placeSlots(fields.place) };
    }
    case 'checkin_ativo': {
      const place = placeSlots(fields.place);
      if (!stadium || !place) return null;
      // Only when there is a match today at that stadium.
      const kickoff = instant(fields.kickoff_at);
      return { ...venueSlots(stadium), ...place, ...(kickoff ? { hora: timePhrase(kickoff) } : {}) };
    }
    case 'marco_passaporte': {
      const count = wholeNumber(fields.count, 1);
      if (!stadium || count === null) return null;
      return { ...venueSlots(stadium), n: String(count), ordinal: ordinalPhrase(count) };
    }
    case 'estadio_novo': {
      const club = named(fields.club);
      const kickoff = instant(fields.kickoff_at);
      if (!stadium || !club || !kickoff) return null;
      const day = dayPhrase(kickoff);
      return {
        ...venueSlots(stadium),
        ...clubSlots(club),
        dia: day,
        Dia: capitalize(day),
        hora: timePhrase(kickoff),
        ...placeSlots(fields.place),
      };
    }
  }
}
