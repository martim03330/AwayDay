import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchPlaceCatalogRows } from '@/features/places/api';
import { applyPlaceCatalogRows, hasAppliedRealPlaces } from '@/features/places/store';
import type { PlaceCatalogRows } from '@/features/places/types';
import { savedOrFresh, separatelySavedQuery } from '@/lib/query-client';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const placeCatalogQuery = queryOptions({
  queryKey: ['places', 'catalog'],
  queryFn: () => fetchPlaceCatalogRows(),
  staleTime: FIVE_MINUTES_MS,
  // Too big for the shared cache blob: saved in its own entry (below).
  meta: { persist: false },
});

const savedPlaceCatalog = separatelySavedQuery<PlaceCatalogRows>(placeCatalogQuery.queryKey, 'awayday-place-catalog');

/**
 * Applies the places at launch, before screens render. A saved copy is applied right away (the sync hook then
 * revalidates it in the background); with no copy at all, it waits briefly for the server, and otherwise the app opens
 * with its bundled data. Call once the query cache is restored.
 */
export async function restorePlaceCatalog(queryClient: QueryClient) {
  await savedPlaceCatalog.restore(queryClient);
  const rows = await savedOrFresh(queryClient, placeCatalogQuery.queryKey, () =>
    queryClient.fetchQuery(placeCatalogQuery)
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
