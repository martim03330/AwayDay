import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchApprovedPlacePhoto,
  fetchMyApprovedPhotoCount,
  fetchPendingPlacePhotos,
} from '@/features/places/api';

/** Signed links last an hour: refresh well before. */
const LINK_STALE_MS = 45 * 60 * 1000;

/** A fan's approved photo of a place, for places without a curated photo; idle unless `enabled`. */
export function useFanPhoto(placeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['place-photo', placeId],
    queryFn: enabled ? () => fetchApprovedPlacePhoto(placeId) : skipToken,
    staleTime: LINK_STALE_MS,
    gcTime: LINK_STALE_MS,
    meta: { persist: false },
  });
}

export function usePendingPlacePhotos(enabled: boolean) {
  return useQuery({
    queryKey: ['place-photo', 'pending'],
    queryFn: enabled ? fetchPendingPlacePhotos : skipToken,
    meta: { persist: false },
  });
}

export function useMyApprovedPhotoCount(userId: string | null) {
  return useQuery({
    queryKey: ['place-photo', 'mine-approved', userId],
    queryFn: userId ? fetchMyApprovedPhotoCount : skipToken,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshPlacePhotos() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['place-photo'] });
}
