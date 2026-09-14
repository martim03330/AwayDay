// Season recap sentences, from the numbers computed in SQL. Only facts that exist become sentences, and
// nothing is said about what the user did not do. Pure and testable.

import type { Slots } from './nudge-slots.ts';
import { fill, seedFrom } from './nudge-text.ts';
import { capitalize, isArticle, withArticle, type Article } from './portuguese.ts';

export const MAX_RECAP_HEADLINE = 80;
export const MAX_RECAP_BODY = 600;

export type RecapStats = {
  seasonId: string;
  games: number;
  stadiums: number;
  newVenues: number;
  /** First visits this season, oldest first (may be fewer than `newVenues` if some are malformed). */
  newVenueNames: { name: string; article: Article }[];
  km: number | null;
  places: number;
  topPlace: { name: string; article: Article; visits: number } | null;
  averageScore: number | null;
  topDistrict: { name: string; games: number } | null;
};

export type RecapText = { headline: string; body: string };

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Reads the jsonb from season_recap_stats; `null` if anything is malformed. */
export function parseRecapStats(value: unknown): RecapStats | null {
  const fields = asRecord(value);
  if (!fields || typeof fields.season_id !== 'string') return null;
  const games = count(fields.games);
  const stadiums = count(fields.stadiums);
  const newVenues = count(fields.new_venues);
  const places = count(fields.places);
  if (games === null || stadiums === null || newVenues === null || places === null) return null;

  const newVenueNames = Array.isArray(fields.new_venue_names)
    ? fields.new_venue_names.flatMap((entry) => {
        const venue = asRecord(entry);
        return venue && typeof venue.name === 'string' && isArticle(venue.article)
          ? [{ name: venue.name, article: venue.article }]
          : [];
      })
    : [];

  const km = fields.km === null ? null : count(fields.km);
  if (fields.km !== null && km === null) return null;

  const placeFields = asRecord(fields.top_place);
  const placeVisits = count(placeFields?.visits);
  const topPlace =
    placeFields && typeof placeFields.name === 'string' && isArticle(placeFields.article) && placeVisits !== null
      ? { name: placeFields.name, article: placeFields.article, visits: placeVisits }
      : null;

  const average = fields.average_score;
  const averageScore = typeof average === 'number' && average >= 1 && average <= 5 ? average : null;

  const districtFields = asRecord(fields.top_district);
  const districtGames = count(districtFields?.games);
  const topDistrict =
    districtFields && typeof districtFields.name === 'string' && districtGames !== null
      ? { name: districtFields.name, games: districtGames }
      : null;

  return {
    seasonId: fields.season_id,
    games,
    stadiums,
    newVenues,
    newVenueNames,
    km,
    places,
    topPlace,
    averageScore,
    topDistrict,
  };
}

/** "2026-27" → "2026/27". */
export function seasonLabel(seasonId: string) {
  return seasonId.replace('-', '/');
}

const NUMBER = new Intl.NumberFormat('pt-PT');
const SCORE = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function plural(amount: number, singular: string, pluralForm: string) {
  return `${NUMBER.format(amount)} ${amount === 1 ? singular : pluralForm}`;
}

// Districts that take an article in Portuguese ("no Porto", "nos Açores"); the rest take none ("em Lisboa").
const DISTRICT_ARTICLES: Readonly<Record<string, Article>> = { Porto: 'o', Açores: 'os', Madeira: 'a', Guarda: 'a' };

function inDistrict(name: string) {
  const article = DISTRICT_ARTICLES[name] ?? '';
  const contraction = { o: 'no', a: 'na', os: 'nos', as: 'nas' } as const;
  return article === '' ? `em ${name}` : `${contraction[article]} ${name}`;
}

const LISTED_NEW_VENUES = 3;

/** "os Arcos, o Restelo e mais 6": up to three names, then how many more. */
function newVenuesPhrase(stats: RecapStats) {
  const shown = stats.newVenueNames.slice(0, LISTED_NEW_VENUES).map((venue) => withArticle(venue.article, venue.name));
  const rest = stats.newVenues - shown.length;
  const items = rest > 0 ? [...shown, `mais ${NUMBER.format(rest)}`] : shown;
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Slots for the recap. Only the facts that exist get a slot. */
export function recapSlots(stats: RecapStats): Slots {
  const slots: Record<string, string> = {
    epoca: seasonLabel(stats.seasonId),
    jogos: plural(stats.games, 'jogo', 'jogos'),
    estadios_novos: plural(stats.newVenues, 'estádio novo', 'estádios novos'),
    tascos: plural(stats.places, 'tasco', 'tascos'),
  };
  if (stats.newVenues > 0 && stats.newVenueNames.length > 0) slots.estreias = newVenuesPhrase(stats);
  if (stats.km !== null) slots.km = `${NUMBER.format(stats.km)} km`;
  if (stats.topDistrict) slots.distrito_em = inDistrict(stats.topDistrict.name);
  if (stats.topPlace) {
    const place = withArticle(stats.topPlace.article, stats.topPlace.name);
    slots.tasco = place;
    slots.Tasco = capitalize(place);
    slots.visitas_tasco = plural(stats.topPlace.visits, 'visita', 'visitas');
  }
  if (stats.averageScore !== null) slots.nota = SCORE.format(stats.averageScore);
  return slots;
}

const HEADLINES = ['A tua época {epoca}', '{epoca}: a tua época em resumo', 'Assim foi a tua época {epoca}'];
const CLOSINGS = ['Venha a próxima.', 'Agosto está já ali.', 'Guarda o cachecol, que isto volta já.'];

/** The recap from templates. Always within the length limits. */
export function templateRecap(stats: RecapStats, seed: number): RecapText {
  const slots = recapSlots(stats);
  const sentences: string[] = [];
  if (stats.games > 0) {
    if (stats.newVenues === 0) sentences.push('Foste a {jogos}, sempre em estádios que já conhecias.');
    else if (slots.estreias) sentences.push('Foste a {jogos} e estreaste {estadios_novos}: {estreias}.');
    else sentences.push('Foste a {jogos} e estreaste {estadios_novos}.');
  } else if (stats.places > 0) {
    sentences.push('Foi uma época mais de tasco do que de bancada: {tascos} diferentes.');
  }
  if (stats.km !== null && stats.km > 0) sentences.push('Somaste pelo menos {km} de estrada, contados em linha reta.');
  // With a single stadium there is nowhere else to compare with.
  if (stats.topDistrict && stats.stadiums >= 2) sentences.push('Onde mais andaste: {distrito_em}.');
  // Written so the verb never agrees with the place name ("as Bifanas" is plural).
  if (stats.topPlace) sentences.push('O tasco onde mais voltaste: {tasco}, com {visitas_tasco}.');
  if (stats.averageScore !== null) sentences.push('A nota média que deste aos estádios foi {nota}.');
  sentences.push(CLOSINGS[seed % CLOSINGS.length] ?? 'Venha a próxima.');

  const headline = fill(HEADLINES[seed % HEADLINES.length] ?? HEADLINES[0] ?? '', slots) ?? `A tua época ${slots.epoca}`;
  const body = fill(sentences.join(' '), slots) ?? '';
  return { headline: headline.slice(0, MAX_RECAP_HEADLINE), body: body.slice(0, MAX_RECAP_BODY) };
}

export function recapSeed(profileId: string, seasonId: string) {
  return seedFrom(`${profileId}:${seasonId}`);
}

const SCOLDING = [/nunca/i, /pregui/i, /vergonha/i, /falhaste/i, /devias/i, /só foste/i, /apenas/i, /pouco/i];

/**
 * Accepts a recap the model wrote with slots. `null` if it breaks a rule: unknown slots, digits, catalogue
 * names typed by hand, over the length limits, missing the season or the games, or scolding.
 */
export function acceptModelRecap(
  written: unknown,
  stats: RecapStats,
  catalogueNames: readonly string[]
): RecapText | null {
  const fields = asRecord(written);
  const headlineTemplate = fields?.headline;
  const bodyTemplate = fields?.body;
  if (typeof headlineTemplate !== 'string' || typeof bodyTemplate !== 'string') return null;
  if (/\d/.test(headlineTemplate + bodyTemplate)) return null;
  if (!headlineTemplate.includes('{epoca}')) return null;
  if (stats.games > 0 && !bodyTemplate.includes('{jogos}')) return null;

  const slots = recapSlots(stats);
  const headline = fill(headlineTemplate.trim(), slots);
  const body = fill(bodyTemplate.trim(), slots);
  if (!headline || !body || headline.length > MAX_RECAP_HEADLINE || body.length > MAX_RECAP_BODY) return null;

  const outsideSlots = `${headlineTemplate} ${bodyTemplate}`.replace(/\{[A-Za-z_]+\}/g, ' ').toLocaleLowerCase('pt-PT');
  if (catalogueNames.some((name) => name.length >= 3 && outsideSlots.includes(name.toLocaleLowerCase('pt-PT')))) {
    return null;
  }
  return SCOLDING.some((pattern) => pattern.test(`${headline} ${body}`)) ? null : { headline, body };
}
