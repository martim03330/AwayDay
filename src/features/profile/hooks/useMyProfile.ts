import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchMyProfile,
  fetchProfileCards,
  saveProfileClub,
  updateMessagePreferences,
  updateRankingVisibility,
} from '@/features/profile/api';
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

/**
 * Os cartões destas pessoas (foto, terra, sinais das boleias), para mostrar ao lado dos nomes. Uma consulta só para
 * a lista toda: um pedido por pessoa punha a app a fazer dez pedidos para desenhar um grupo.
 */
export function useProfileCards(profileIds: string[]) {
  const chave = [...profileIds].sort().join(',');
  return useQuery({
    queryKey: [PROFILE_KEY, 'cards', chave],
    queryFn: profileIds.length > 0 ? () => fetchProfileCards(profileIds) : skipToken,
    staleTime: FIVE_MINUTES_MS,
    meta: { persist: false },
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

export function useUpdateRankingVisibility(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (showInRankings: boolean) => {
      if (!userId) throw new Error('Not signed in.');
      return updateRankingVisibility(userId, showInRankings);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, userId] }),
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
