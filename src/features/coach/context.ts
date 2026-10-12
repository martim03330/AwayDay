// Works out, on the phone, whether there may be something worth a coach message and the key to cache it
// under. The server decides for real, from SQL (coach_context); this only avoids asking when there is
// nothing to say and lets a cached message show straight away. Pure and testable.

import type { CoachMessage } from '@/features/coach/types';
import { fimDoJogo } from '@/lib/jogos';
import { faseDoDiaDeJogo, mostrarRelogio, type FaseDiaDeJogo } from '@/lib/relogio';
import type { Jogo } from '@/mocks/tipos';

const HOUR_MS = 60 * 60 * 1000;

/** Same numbers as coach_context in SQL. */
export const COACH_MILESTONES: readonly number[] = [3, 5, 10, 15, 20, 25, 30, 40, 50];
export const NEW_VENUE_WINDOW_MS = 7 * 24 * HOUR_MS;
export const ACTIVE_CHECK_IN_MS = 3 * HOUR_MS;
const AFTER_MATCH_MS = 3 * HOUR_MS;

export type CoachPhase = 'manha' | 'chegada' | 'antes_do_apito' | 'a_decorrer' | 'fim';

const PHASES: Readonly<Record<FaseDiaDeJogo, CoachPhase>> = {
  almoco: 'manha',
  'check-in': 'chegada',
  'a-caminho': 'antes_do_apito',
  'a-decorrer': 'a_decorrer',
  depois: 'fim',
};

type Fixture = Pick<Jogo, 'id' | 'casaId' | 'foraId' | 'estadioId' | 'inicio'>;

export type CoachInput = {
  userId: string;
  /** App time in ms (moved in demo mode). */
  now: number;
  supporterClubId: string | null;
  hometownClubId: string | null;
  fixtures: readonly Fixture[];
  visitedVenueIds: readonly string[];
  /** The latest check-in that is still on; `at` in app time. */
  lastCheckIn: { id: string; at: number } | null;
};

export type LocalCoachContext = {
  /** Nearest fixture, phase, stadium, last check-in and passport count, per user. */
  key: string;
  worthAsking: boolean;
};

export function localCoachContext(input: CoachInput): LocalCoachContext {
  const { now } = input;
  const plays = (fixture: Fixture, clubId: string | null) =>
    clubId !== null && (fixture.casaId === clubId || fixture.foraId === clubId);

  // `filter` already returns a new array, so `sort` never touches `input.fixtures`. Not `toSorted`: Hermes in
  // Expo Go does not have it and the app crashed on open for anyone signed in.
  const mine = input.fixtures
    .filter((fixture) => plays(fixture, input.supporterClubId) || plays(fixture, input.hometownClubId))
    .filter((fixture) => fimDoJogo(fixture).getTime() + AFTER_MATCH_MS > now)
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));

  const matchDay = mine.find((fixture) => plays(fixture, input.supporterClubId) && mostrarRelogio(fixture, now));
  const phase = matchDay ? PHASES[faseDoDiaDeJogo(matchDay, now)] : null;

  const visited = new Set(input.visitedVenueIds);
  const passport = visited.size;
  const checkInActive = input.lastCheckIn !== null && now - input.lastCheckIn.at <= ACTIVE_CHECK_IN_MS;
  const newVenueSoon = mine.some((fixture) => {
    const kickoff = Date.parse(fixture.inicio);
    return kickoff > now && kickoff - now <= NEW_VENUE_WINDOW_MS && !visited.has(fixture.estadioId);
  });

  // During the match the coach stays quiet.
  const worthAsking =
    phase !== 'a_decorrer' &&
    (phase !== null || checkInActive || COACH_MILESTONES.includes(passport) || newVenueSoon);

  const fixture = matchDay ?? mine[0];
  const key = [
    'v1',
    input.userId,
    fixture?.id ?? '-',
    phase ?? '-',
    fixture?.estadioId ?? '-',
    input.lastCheckIn ? `${input.lastCheckIn.id}@${input.lastCheckIn.at}` : '-',
    String(passport),
  ].join('|');

  return { key, worthAsking };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

/** Reads the coach-message response; `null` when there is no message or it is malformed. */
export function parseCoachMessage(payload: unknown): CoachMessage | null {
  const message = asRecord(asRecord(payload)?.message);
  return message &&
    typeof message.id === 'string' &&
    typeof message.body === 'string' &&
    typeof message.kind === 'string'
    ? {
        id: message.id,
        body: message.body,
        kind: message.kind,
        // Messages cached before this field existed have none.
        fixtureId: typeof message.fixtureId === 'string' ? message.fixtureId : null,
      }
    : null;
}
