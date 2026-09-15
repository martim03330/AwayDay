// Keeps fixtures in sync with football-data.org. pg_cron calls it every 6 hours with a secret header.
// The API key only exists in this function's secrets (FOOTBALL_DATA_API_KEY); the app never calls the API and reads
// the cached fixtures from public.fixture. Clubs are matched by club.football_data_id; fixtures are upserted by id.
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { hasCronSecret } from '../_shared/auth.ts';

const API_BASE = 'https://api.football-data.org/v4';
/**
 * football-data.org competition code -> our competition id. The free plan covers the Primeira Liga and the Champions
 * League. Only fixtures between clubs we know (club.football_data_id) are kept: in the Champions League, the games of
 * Portuguese clubs, with their opponents added by hand.
 */
const COMPETITIONS = [
  { code: 'PPL', competitionId: 'liga' },
  { code: 'CL', competitionId: 'champions' },
] as const;
/** Knockout stages: name shown in the app and a slug for the fixture id (legs of different rounds must not clash). */
const STAGES: Readonly<Record<string, { name: string; slug: string }>> = {
  PLAYOFFS: { name: 'Play-off', slug: 'playoff' },
  LAST_16: { name: 'Oitavos de final', slug: 'oitavos' },
  QUARTER_FINALS: { name: 'Quartos de final', slug: 'quartos' },
  SEMI_FINALS: { name: 'Meias-finais', slug: 'meias' },
  FINAL: { name: 'Final', slug: 'final' },
};
/** Fixtures without a real date: not shown until they get one. */
const SKIPPED_STATUSES = new Set(['POSTPONED', 'CANCELLED', 'SUSPENDED', 'AWARDED']);
/** Statuses with a kick-off time that football-data.org already confirmed. */
const CONFIRMED_STATUSES = new Set([
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'EXTRA_TIME',
  'PENALTY_SHOOTOUT',
  'FINISHED',
]);

type Club = {
  id: string;
  country: string;
  home_venue_id: string | null;
  european_venue_id: string | null;
  football_data_id: number;
};

type FixtureRow = {
  id: string;
  external_id: string;
  competition_id: string;
  stage: string;
  home_club_id: string;
  away_club_id: string;
  venue_id: string;
  kickoff_at: string;
  kickoff_confirmed: boolean;
  season_id: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

/** "2026-08-08" -> "2026-27". */
function seasonIdFor(startDate: string) {
  const year = Number(startDate.slice(0, 4));
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

function stageName(stage: unknown, matchday: unknown) {
  const round = typeof matchday === 'number' ? `Jornada ${matchday}` : null;
  if (stage === 'REGULAR_SEASON') return round ?? 'Jogo';
  if (stage === 'LEAGUE_STAGE') return round ? `Fase de liga · ${round}` : 'Fase de liga';
  return (typeof stage === 'string' ? STAGES[stage]?.name : undefined) ?? 'Jogo';
}

/**
 * League fixtures keep the ids already in use ("casa-fora-2026-27"). Other competitions add the competition and, in
 * the knockouts, the round, so a league game and a European game between the same clubs never share an id.
 */
function fixtureId(
  competitionId: string,
  stage: unknown,
  home: string,
  away: string,
  seasonId: string
) {
  if (competitionId === 'liga') return `${home}-${away}-${seasonId}`;
  const slug = typeof stage === 'string' ? STAGES[stage]?.slug : undefined;
  return [home, away, competitionId, slug, seasonId].filter(Boolean).join('-');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!hasCronSecret(request)) return json(401, { error: 'not_authorized' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('FOOTBALL_DATA_API_KEY');
  if (!url || !serviceRoleKey || !apiKey) return json(500, { error: 'misconfigured' });

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clubsResult = await admin
    .from('club')
    .select('id, country, home_venue_id, european_venue_id, football_data_id')
    .not('football_data_id', 'is', null);
  if (clubsResult.error) return json(500, { error: 'clubs_failed' });
  const clubsByTeam = new Map<number, Club>();
  for (const row of clubsResult.data as Club[]) clubsByTeam.set(row.football_data_id, row);

  const summary = { fetched: 0, upserted: 0, skipped_status: 0, unmatched_teams: [] as string[] };

  for (const competition of COMPETITIONS) {
    const response = await fetch(`${API_BASE}/competitions/${competition.code}/matches`, {
      headers: { 'X-Auth-Token': apiKey },
    });
    if (!response.ok) {
      console.error(`football-data ${competition.code} answered ${response.status}`);
      return json(502, { error: 'football_data_failed', status: response.status });
    }

    const body = asRecord(await response.json());
    const season = asRecord(asRecord(body?.competition)?.currentSeason ?? null);
    const matches = Array.isArray(body?.matches) ? body.matches : [];
    const firstDate = matches.length > 0 ? asRecord(matches[0])?.utcDate : null;
    const startDate =
      typeof season?.startDate === 'string'
        ? season.startDate
        : typeof firstDate === 'string'
          ? firstDate
          : null;
    if (!startDate) continue;
    const seasonId = seasonIdFor(startDate);

    const seasonRow = await admin.from('season').upsert(
      {
        id: seasonId,
        starts_on: `${seasonId.slice(0, 4)}-07-01`,
        ends_on: `${Number(seasonId.slice(0, 4)) + 1}-06-30`,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
    if (seasonRow.error) return json(500, { error: 'season_failed' });

    const rows: FixtureRow[] = [];
    const unmatched = new Set<string>();
    for (const item of matches) {
      const match = asRecord(item);
      if (!match) continue;
      summary.fetched += 1;
      const status = typeof match.status === 'string' ? match.status : '';
      if (SKIPPED_STATUSES.has(status)) {
        summary.skipped_status += 1;
        continue;
      }
      const homeTeam = asRecord(match.homeTeam);
      const awayTeam = asRecord(match.awayTeam);
      const home = typeof homeTeam?.id === 'number' ? clubsByTeam.get(homeTeam.id) : undefined;
      const away = typeof awayTeam?.id === 'number' ? clubsByTeam.get(awayTeam.id) : undefined;
      // Only games of Portuguese clubs: two known foreign opponents playing each other are left out.
      if (home?.country !== 'Portugal' && away?.country !== 'Portugal') continue;
      const venueId =
        competition.competitionId === 'liga'
          ? home?.home_venue_id
          : (home?.european_venue_id ?? home?.home_venue_id);
      if (
        !home ||
        !away ||
        !venueId ||
        typeof match.utcDate !== 'string' ||
        typeof match.id !== 'number'
      ) {
        // One of the clubs is Portuguese here: the other is an opponent still missing.
        if (!home && away && typeof homeTeam?.name === 'string')
          unmatched.add(`${homeTeam.id}:${homeTeam.name}`);
        if (!away && home && typeof awayTeam?.name === 'string')
          unmatched.add(`${awayTeam.id}:${awayTeam.name}`);
        continue;
      }
      rows.push({
        id: fixtureId(competition.competitionId, match.stage, home.id, away.id, seasonId),
        external_id: `football-data:${match.id}`,
        competition_id: competition.competitionId,
        stage: stageName(match.stage, match.matchday),
        home_club_id: home.id,
        away_club_id: away.id,
        venue_id: venueId,
        kickoff_at: match.utcDate,
        kickoff_confirmed: CONFIRMED_STATUSES.has(status),
        season_id: seasonId,
      });
    }
    summary.unmatched_teams.push(...unmatched);

    for (let start = 0; start < rows.length; start += 200) {
      const chunk = rows.slice(start, start + 200);
      const { error } = await admin.from('fixture').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error('sync-fixtures upsert failed:', error.message);
        return json(500, { error: 'upsert_failed' });
      }
      summary.upserted += chunk.length;
    }
  }

  return json(200, summary);
});
