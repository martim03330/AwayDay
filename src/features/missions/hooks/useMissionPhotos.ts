import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyMissionPhotos } from '@/features/missions/api';

export const myMissionPhotosKey = (userId: string | null) => ['mission-photos', userId] as const;

export function useMyMissionPhotos(userId: string | null) {
  return useQuery({
    queryKey: myMissionPhotosKey(userId),
    queryFn: userId ? () => fetchMyMissionPhotos(userId) : skipToken,
    // Signed URLs last an hour: refetch well before they expire, and never keep them in the persisted cache.
    staleTime: 30 * 60 * 1000,
    gcTime: 45 * 60 * 1000,
    meta: { persist: false },
  });
}

export function useRefreshMissionPhotos(userId: string | null) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: myMissionPhotosKey(userId) });
}
