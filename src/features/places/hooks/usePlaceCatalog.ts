import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchPlaceCatalogRows } from '@/features/places/api';
import { applyPlaceCatalogRows, hasAppliedRealPlaces } from '@/features/places/store';
import { freshOrSaved } from '@/lib/query-client';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const placeCatalogQuery = queryOptions({
  queryKey: ['places', 'catalog'],
  queryFn: fetchPlaceCatalogRows,
  staleTime: FIVE_MINUTES_MS,
});

/**
 * Applies the places at launch, before screens render: the saved copy if recent, otherwise fresh data (waiting a
 * few seconds at most). Call once the query cache is restored.
 */
export async function restorePlaceCatalog(queryClient: QueryClient) {
  const rows = await freshOrSaved(
    queryClient,
    placeCatalogQuery.queryKey,
    () => queryClient.fetchQuery(placeCatalogQuery),
    FIVE_MINUTES_MS
  );
  if (rows) applyPlaceCatalogRows(rows);
}

/**
 * Revalidates the places in the background. If nothing was applied at launch (first open, offline), the first answer
 * is applied right away; later ones are used from the next launch, like the fixtures catalogue.
 */
export function usePlaceCatalogSync() {
  const { data } = useQuery(placeCatalogQuery);
  useEffect(() => {
    if (data && !hasAppliedRealPlaces()) applyPlaceCatalogRows(data);
  }, [data]);
}
