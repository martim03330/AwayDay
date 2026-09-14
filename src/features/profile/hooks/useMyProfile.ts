import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyProfile, saveProfileClub, updateMessagePreferences } from '@/features/profile/api';
import type { ClubRelation, MessagePreferences } from '@/features/profile/types';

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

export function useUpdateMessagePreferences(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: MessagePreferences) => {
      if (!userId) throw new Error('Not signed in.');
      return updateMessagePreferences(userId, preferences);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, userId] }),
  });
}
