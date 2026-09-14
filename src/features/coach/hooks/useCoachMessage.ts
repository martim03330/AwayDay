import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchCoachMessage } from '@/features/coach/api';

const COACH_KEY = 'coach';

/**
 * The message for one context key, cached (and persisted) per key with no expiry: while the context stays
 * the same, the message stays and the server is not asked again. A new key asks once, in the background.
 */
export function useCoachMessage(contextKey: string | null, worthAsking: boolean, now: number) {
  return useQuery({
    queryKey: [COACH_KEY, contextKey],
    queryFn: contextKey && worthAsking ? () => fetchCoachMessage(new Date(now)) : skipToken,
    staleTime: Infinity,
    retry: 1,
  });
}
