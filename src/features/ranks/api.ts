import type {
  ClubAwaySupport,
  Division,
  DivisionMovement,
  LeaderboardPeriod,
  LeaderboardRow,
  LeaderboardScope,
  Mission,
  MissionKind,
  MyRanking,
  SeasonAttendance,
  VenueAttendance,
} from '@/features/ranks/types';
import { supabase } from '@/lib/supabase';

// The ranking is computed by the server from what the app confirmed (stadiums stamped on site, check-ins, approved
// photos). The phone only reads it: no XP, level or position is ever calculated or sent from here.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function division(value: number | null | undefined): Division {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : 5;
}

function movement(value: number | null | undefined): DivisionMovement {
  return value === 1 || value === -1 ? value : 0;
}

function missionKind(value: string): MissionKind {
  return value === 'achievement' || value === 'season' ? value : 'weekly';
}

function tier(value: number | null | undefined): Mission['tier'] {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

export async function fetchMyRanking(): Promise<MyRanking | null> {
  const { data, error } = await client().rpc('my_ranking');
  if (error) throw error;
  const row = data[0];
  if (!row) return null;
  return {
    totalXp: row.total_xp,
    level: row.level,
    levelXp: row.level_xp,
    nextLevelXp: row.next_level_xp,
    seasonId: row.season_id ?? null,
    seasonXp: row.season_xp,
    division: division(row.division),
    divisionMovement: movement(row.division_movement),
    divisionPosition: row.division_position,
    divisionSize: row.division_size,
    promotionSpots: row.promotion_spots,
    relegationSpots: row.relegation_spots,
    promotionMinXp: row.promotion_min_xp,
    streakWeeks: row.streak_weeks,
    bestStreakWeeks: row.best_streak_weeks,
    stadiums: row.stadiums,
    stadiumVisits: row.stadium_visits,
    showInRankings: row.show_in_rankings,
  };
}

export async function fetchLeaderboard(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  limit = 50
): Promise<LeaderboardRow[]> {
  const { data, error } = await client().rpc('ranking_leaderboard', {
    p_scope: scope,
    p_period: period,
    p_limit: limit,
  });
  if (error) throw error;
  return data.map((row) => ({
    position: row.rank_position,
    profileId: row.profile_id,
    isMe: row.is_me,
    displayName: row.display_name,
    clubId: row.club_id ?? null,
    level: row.level,
    xp: row.xp,
    division: division(row.division),
  }));
}

export async function fetchMyMissions(): Promise<Mission[]> {
  const { data, error } = await client().rpc('my_missions');
  if (error) throw error;
  return data.map((row) => ({
    id: row.mission_id,
    kind: missionKind(row.kind),
    family: row.family,
    tier: tier(row.tier),
    metric: row.metric,
    needsProofPhoto: row.metric === 'proof_photo',
    target: row.target,
    xp: row.xp,
    title: row.title,
    description: row.description,
    badge: row.badge ?? null,
    icon: row.icon,
    proofHint: row.proof_hint ?? null,
    sort: row.sort,
    weekStart: row.week_start ?? null,
    progress: row.progress,
    completedAt: row.completed_at ?? null,
  }));
}

export async function fetchVenueAttendance(): Promise<VenueAttendance[]> {
  const { data, error } = await client().rpc('venue_attendance');
  if (error) throw error;
  return data.map((row) => ({ venueId: row.venue_id, people: row.people, visits: row.visits }));
}

export async function fetchClubAwaySupport(): Promise<ClubAwaySupport[]> {
  const { data, error } = await client().rpc('club_away_support');
  if (error) throw error;
  return data.map((row) => ({ clubId: row.club_id, people: row.people, visits: row.visits }));
}

/** `null` until 5 different people have stamped a stadium this season. */
export async function fetchSeasonAttendance(): Promise<SeasonAttendance | null> {
  const { data, error } = await client().rpc('season_attendance');
  if (error) throw error;
  const row = data[0];
  return row ? { people: row.people, visits: row.visits, venues: row.venues } : null;
}
