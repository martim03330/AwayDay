import type { RecapStats, SeasonRecap } from '@/features/recap/types';

// Reads the numbers saved by the server. Anything malformed shows as missing, never as a made-up number.

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function count(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function parseStats(value: unknown): RecapStats {
  const fields = asRecord(value);
  const place = asRecord(fields?.top_place);
  const district = asRecord(fields?.top_district);
  const km = fields?.km;
  const average = fields?.average_score;
  return {
    games: count(fields?.games),
    stadiums: count(fields?.stadiums),
    newVenues: count(fields?.new_venues),
    km: typeof km === 'number' && Number.isInteger(km) && km >= 0 ? km : null,
    places: count(fields?.places),
    topPlace:
      place && typeof place.name === 'string' ? { name: place.name, visits: count(place.visits) } : null,
    averageScore: typeof average === 'number' && average >= 1 && average <= 5 ? average : null,
    topDistrict: district && typeof district.name === 'string' ? district.name : null,
  };
}

/** "2026-27" → "2026/27". */
export function seasonLabel(seasonId: string) {
  return seasonId.replace('-', '/');
}

/** Text for the share sheet: the same words the user sees, signed by the app. */
export function shareMessage(recap: Pick<SeasonRecap, 'headline' | 'body'>) {
  return `${recap.headline}\n\n${recap.body}\n\nAwayDay`;
}
