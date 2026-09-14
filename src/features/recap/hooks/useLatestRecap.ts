import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchLatestRecap, markRecapShared } from '@/features/recap/api';

const RECAP_KEY = 'season-recap';

export function useLatestRecap(userId: string | null) {
  return useQuery({
    queryKey: [RECAP_KEY, userId],
    queryFn: userId ? () => fetchLatestRecap(userId) : skipToken,
    staleTime: 60 * 60 * 1000,
  });
}

export function useMarkRecapShared(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markRecapShared,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RECAP_KEY, userId] }),
  });
}
