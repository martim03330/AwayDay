import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchSafetyNotes } from '@/features/safety/api';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Safety notes for a stadium; idle unless `enabled` (only derbies ask). */
export function useSafetyNotes(venueId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['safety', venueId],
    queryFn: venueId && enabled ? () => fetchSafetyNotes(venueId) : skipToken,
    staleTime: ONE_DAY_MS,
  });
}
