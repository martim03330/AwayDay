import { skipToken, useQuery } from '@tanstack/react-query';

import {
  fetchClubAwaySupport,
  fetchLeaderboard,
  fetchMyMissions,
  fetchMyRanking,
  fetchSeasonAttendance,
  fetchVenueAttendance,
} from '@/features/ranks/api';
import type { LeaderboardPeriod, LeaderboardScope } from '@/features/ranks/types';

const MINUTE_MS = 60 * 1000;

/** Everything ranking-related for one user; invalidate it after a stamp, a check-in or a visibility change. */
export function rankingKey(userId: string | null) {
  return ['ranking', userId] as const;
}

export function useMyRanking(userId: string | null) {
  return useQuery({
    queryKey: [...rankingKey(userId), 'me'],
    queryFn: userId ? fetchMyRanking : skipToken,
    staleTime: MINUTE_MS,
  });
}

export function useLeaderboard(
  userId: string | null,
  scope: LeaderboardScope,
  period: LeaderboardPeriod
) {
  return useQuery({
    queryKey: [...rankingKey(userId), 'table', scope, period],
    queryFn: userId ? () => fetchLeaderboard(scope, period) : skipToken,
    staleTime: MINUTE_MS,
    // Other people's names: never kept on the phone between sessions.
    meta: { persist: false },
  });
}

export function useMyMissions(userId: string | null) {
  return useQuery({
    queryKey: [...rankingKey(userId), 'missions'],
    queryFn: userId ? fetchMyMissions : skipToken,
    staleTime: MINUTE_MS,
  });
}

export function useAttendance(userId: string | null) {
  const season = useQuery({
    queryKey: [...rankingKey(userId), 'attendance', 'season'],
    queryFn: userId ? fetchSeasonAttendance : skipToken,
    staleTime: 10 * MINUTE_MS,
  });
  const venues = useQuery({
    queryKey: [...rankingKey(userId), 'attendance', 'venues'],
    queryFn: userId ? fetchVenueAttendance : skipToken,
    staleTime: 10 * MINUTE_MS,
  });
  const clubs = useQuery({
    queryKey: [...rankingKey(userId), 'attendance', 'clubs'],
    queryFn: userId ? fetchClubAwaySupport : skipToken,
    staleTime: 10 * MINUTE_MS,
  });
  return { season, venues, clubs };
}
