import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyProfile, saveProfileClub } from '@/features/profile/api';
import type { ClubRelation } from '@/features/profile/types';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const PROFILE_KEY = 'profile';

/** Profile of the signed-in user; idle while signed out. */
export function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: [PROFILE_KEY, userId],
    queryFn: userId ? () => fetchMyProfile(userId) : skipToken,
    staleTime: FIVE_MINUTES_MS,
  });
}

export function useSaveProfileClub(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ relation, clubId }: { relation: ClubRelation; clubId: string | null }) => {
      if (!userId) throw new Error('Not signed in.');
      return saveProfileClub(userId, relation, clubId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, userId] }),
  });
}

/** Drops every cached profile (they are persisted), e.g. after signing out. */
export function useForgetProfiles() {
  const queryClient = useQueryClient();
  return () => queryClient.removeQueries({ queryKey: [PROFILE_KEY] });
}
