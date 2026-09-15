import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchPlaceCatalogRows } from '@/features/places/api';
import { applyPlaceCatalogRows, hasAppliedRealPlaces } from '@/features/places/store';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const placeCatalogQuery = queryOptions({
  queryKey: ['places', 'catalog'],
  queryFn: fetchPlaceCatalogRows,
  staleTime: FIVE_MINUTES_MS,
});

/** Applies the persisted places. Call once the query cache is restored, before screens render. */
export function restorePlaceCatalog(queryClient: QueryClient) {
  const rows = queryClient.getQueryData(placeCatalogQuery.queryKey);
  if (rows) applyPlaceCatalogRows(rows);
}

/**
 * Revalidates the places in the background. There is no bundled copy, so the very first answer is applied right
 * away; later ones are persisted and used from the next launch, like the fixtures catalogue.
 */
export function usePlaceCatalogSync() {
  const { data } = useQuery(placeCatalogQuery);
  useEffect(() => {
    if (data && !hasAppliedRealPlaces()) applyPlaceCatalogRows(data);
  }, [data]);
}
