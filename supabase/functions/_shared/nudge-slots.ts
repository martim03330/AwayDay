// Turns the facts computed in SQL into ready-made phrases ("slots"). Every value comes from the facts:
// if something is missing or malformed, there is no nudge instead of a guess. Pure and testable.

import {
  capitalize,
  isArticle,
  kmPhrase,
  minutesPhrase,
  ordinalPhrase,
  timePhrase,
  whenPhrase,
  withArticle,
  withPreposition,
  type Article,
} from './portuguese.ts';

export type NudgeKind =
  | 'tasco_primeira_visita'
  | 'marco_passaporte'
  | 'estadio_novo_em_casa'
  | 'clube_perto_de_ti';

export const NUDGE_KINDS: readonly NudgeKind[] = [
  'tasco_primeira_visita',
  'marco_passaporte',
  'estadio_novo_em_casa',
  'clube_perto_de_ti',
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
  return { clube: phrase, Clube: capitalize(phrase) };
}

function whenSlots(kickoff: Date, now: Date) {
  const when = whenPhrase(kickoff, now);
  return { quando: when, Quando: capitalize(when), hora: timePhrase(kickoff) };
}

/** Slots for one candidate, or `null` when its facts are incomplete. */
export function buildSlots(kind: NudgeKind, facts: unknown, now: Date): Slots | null {
  const fields = asRecord(facts);
  if (!fields) return null;
  const stadium = venue(fields.venue);

  switch (kind) {
    case 'tasco_primeira_visita': {
      const placeFields = asRecord(fields.place);
      const place = named(placeFields);
      const minutes = wholeNumber(placeFields?.walking_minutes, 0);
      const kickoff = instant(fields.kickoff_at);
      if (!stadium || !place || minutes === null || !kickoff) return null;
      const placePhrase = withArticle(place.article, place.name);
      return {
        ...venueSlots(stadium),
        ...whenSlots(kickoff, now),
        tasco: placePhrase,
        Tasco: capitalize(placePhrase),
        minutos: minutesPhrase(minutes),
      };
    }
    case 'estadio_novo_em_casa': {
      const club = named(fields.club);
      const kickoff = instant(fields.kickoff_at);
      if (!stadium || !club || !kickoff) return null;
      return { ...venueSlots(stadium), ...clubSlots(club), ...whenSlots(kickoff, now) };
    }
    case 'clube_perto_de_ti': {
      const club = named(fields.club);
      const kickoff = instant(fields.kickoff_at);
      const km = wholeNumber(fields.km, 1);
      if (!stadium || !club || !kickoff || km === null) return null;
      return { ...venueSlots(stadium), ...clubSlots(club), ...whenSlots(kickoff, now), km: kmPhrase(km) };
    }
    case 'marco_passaporte': {
      const count = wholeNumber(fields.count, 1);
      if (!stadium || count === null) return null;
      return { ...venueSlots(stadium), n: String(count), ordinal: ordinalPhrase(count) };
    }
  }
}
