import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchRestroomsNear } from '@/features/restrooms/api';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Real public toilets near a stadium (OpenStreetMap); idle unless `enabled`. */
export function useRestroomsNear(venueId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['restrooms', venueId],
    queryFn: venueId && enabled ? () => fetchRestroomsNear(venueId) : skipToken,
    staleTime: ONE_DAY_MS,
  });
}
