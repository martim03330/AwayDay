import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchMyPlans } from '@/features/activity/api';

/** Under the attendance key, so marking or unmarking "going" refreshes it too. */
export function myPlansKey(userId: string | null) {
  return ['attendance', userId, 'plans'] as const;
}

/** Games the signed-in user is going to, with the tasco picked for each; idle while signed out. */
export function useMyPlans(userId: string | null) {
  return useQuery({
    queryKey: myPlansKey(userId),
    queryFn: userId ? () => fetchMyPlans(userId) : skipToken,
    staleTime: 60 * 1000,
  });
}
