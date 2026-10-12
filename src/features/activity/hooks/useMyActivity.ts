import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchMyDishRecommendations,
  fetchMyNoiseMeasurements,
  fetchMyPlaceRatings,
  fetchMyPlaceSubScores,
  fetchMyPlaceVotes,
  fetchMyToiletAnswers,
  fetchMyPlaceVisits,
  fetchMyReviews,
} from '@/features/activity/api';

const ACTIVITY_KEY = 'activity';
const STALE_MS = 60 * 1000;

/** Everything under this key belongs to one user's activity; invalidate it after any write. */
export function myActivityKey(userId: string | null) {
  return [ACTIVITY_KEY, userId] as const;
}

export const myReviewsKey = (userId: string | null) => [...myActivityKey(userId), 'reviews'] as const;
export const myPlaceVisitsKey = (userId: string | null) => [...myActivityKey(userId), 'place-visits'] as const;
export const myPlaceRatingsKey = (userId: string | null) => [...myActivityKey(userId), 'place-ratings'] as const;
export const myNoiseMeasurementsKey = (userId: string | null) =>
  [...myActivityKey(userId), 'noise-measurements'] as const;
export const myDishRecommendationsKey = (userId: string | null) =>
  [...myActivityKey(userId), 'dish-recommendations'] as const;
export const myPlaceSubScoresKey = (userId: string | null) =>
  [...myActivityKey(userId), 'place-sub-scores'] as const;
export const myPlaceVotesKey = (userId: string | null) =>
  [...myActivityKey(userId), 'place-votes'] as const;
export const myToiletAnswersKey = (userId: string | null) =>
  [...myActivityKey(userId), 'toilet-answers'] as const;

export function useMyReviews(userId: string | null) {
  return useQuery({
    queryKey: myReviewsKey(userId),
    queryFn: userId ? () => fetchMyReviews(userId) : skipToken,
    staleTime: STALE_MS,
  });
}

export function useMyPlaceVisits(userId: string | null) {
  return useQuery({
    queryKey: myPlaceVisitsKey(userId),
    queryFn: userId ? () => fetchMyPlaceVisits(userId) : skipToken,
    staleTime: STALE_MS,
    // Which tascos and when: a history of where the person was, so it is never written to the phone's disk.
    meta: { persist: false },
  });
}

export function useMyPlaceRatings(userId: string | null) {
  return useQuery({
    queryKey: myPlaceRatingsKey(userId),
    queryFn: userId ? () => fetchMyPlaceRatings(userId) : skipToken,
    staleTime: STALE_MS,
  });
}

export function useMyNoiseMeasurements(userId: string | null) {
  return useQuery({
    queryKey: myNoiseMeasurementsKey(userId),
    queryFn: userId ? () => fetchMyNoiseMeasurements(userId) : skipToken,
    staleTime: STALE_MS,
  });
}

export function useMyDishRecommendations(userId: string | null) {
  return useQuery({
    queryKey: myDishRecommendationsKey(userId),
    queryFn: userId ? () => fetchMyDishRecommendations(userId) : skipToken,
    staleTime: STALE_MS,
  });
}

export function useMyPlaceSubScores(userId: string | null) {
  return useQuery({
    queryKey: myPlaceSubScoresKey(userId),
    queryFn: userId ? () => fetchMyPlaceSubScores(userId) : skipToken,
    staleTime: STALE_MS,
  });
}

export function useMyPlaceVotes(userId: string | null) {
  return useQuery({
    queryKey: myPlaceVotesKey(userId),
    queryFn: userId ? () => fetchMyPlaceVotes(userId) : skipToken,
    staleTime: STALE_MS,
  });
}

export function useMyToiletAnswers(userId: string | null) {
  return useQuery({
    queryKey: myToiletAnswersKey(userId),
    queryFn: userId ? () => fetchMyToiletAnswers(userId) : skipToken,
    staleTime: STALE_MS,
  });
}

/** Refetches all of the user's activity (after a write, or after bringing local activity into the account). */
export function useRefreshMyActivity(userId: string | null) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: myActivityKey(userId) });
}
