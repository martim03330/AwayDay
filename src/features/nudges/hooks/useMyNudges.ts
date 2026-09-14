import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyNudges, markNudgesRead } from '@/features/nudges/api';

const NUDGES_KEY = 'nudges';

export function useMyNudges(userId: string | null) {
  return useQuery({
    queryKey: [NUDGES_KEY, userId],
    queryFn: userId ? () => fetchMyNudges(userId) : skipToken,
    staleTime: 60 * 1000,
  });
}

export function useMarkNudgesRead(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('Not signed in.');
      return markNudgesRead(userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [NUDGES_KEY, userId] }),
  });
}
