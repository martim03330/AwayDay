import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchClubSupporterCounts,
  fetchMunicipalities,
  fetchMyHome,
  fetchMyProfile,
  fetchProfileCards,
  saveMyHome,
  saveProfileClub,
  setShareCheckinsWithGroups,
  updateMessagePreferences,
  updateRankingVisibility,
} from '@/features/profile/api';
import type { ClubRelation, MessagePreferences, MyHome } from '@/features/profile/types';

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

/** Sim ou não a dizer sozinho aos grupos em que tasco fazes check-in. */
export function useUpdateShareCheckins(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (share: boolean) => setShareCheckinsWithGroups(share),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, userId] }),
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

/** Os concelhos não mudam: lê-se uma vez e guarda-se no telemóvel. */
export function useMunicipalities(enabled = true) {
  return useQuery({
    queryKey: [PROFILE_KEY, 'municipalities'],
    queryFn: enabled ? fetchMunicipalities : skipToken,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });
}

/** De onde partes e como costumas ir; vazio enquanto não houver conta. */
export function useMyHome(userId: string | null) {
  return useQuery({
    queryKey: [PROFILE_KEY, userId, 'home'],
    queryFn: userId ? () => fetchMyHome(userId) : skipToken,
    staleTime: FIVE_MINUTES_MS,
  });
}

export function useSaveMyHome(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<MyHome>) => {
      if (!userId) throw new Error('Not signed in.');
      return saveMyHome(userId, changes);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PROFILE_KEY, userId, 'home'] }),
  });
}

/** Quantos adeptos de cada clube há na app (só clubes com 5 ou mais). Serve também sem conta. */
export function useClubSupporterCounts() {
  return useQuery({
    queryKey: [PROFILE_KEY, 'club-supporters'],
    queryFn: fetchClubSupporterCounts,
    staleTime: 60 * 60 * 1000,
  });
}
