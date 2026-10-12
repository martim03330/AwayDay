import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchFixtureCatalogRows } from '@/features/fixtures/api';
import { applyFixtureCatalogRows, hasAppliedRealFixtures } from '@/features/fixtures/store';
import type { FixtureCatalogRows } from '@/features/fixtures/types';
import { savedOrFresh, separatelySavedQuery } from '@/lib/query-client';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const fixtureCatalogQuery = queryOptions({
  queryKey: ['fixtures', 'catalog'],
  queryFn: () => fetchFixtureCatalogRows(),
  staleTime: FIVE_MINUTES_MS,
  // Too big for the shared cache blob: saved in its own entry (below).
  meta: { persist: false },
});

const savedFixtureCatalog = separatelySavedQuery<FixtureCatalogRows>(fixtureCatalogQuery.queryKey, 'awayday-fixture-catalog');

/**
 * Applies the catalogue at launch, before screens render. A saved copy is applied right away (the sync hook then
 * revalidates it in the background); with no copy at all, it waits briefly for the server, and otherwise the app opens
 * with its bundled data. Call once the query cache is restored.
 */
export async function restoreFixtureCatalog(queryClient: QueryClient) {
  await savedFixtureCatalog.restore(queryClient);
  const rows = await savedOrFresh(queryClient, fixtureCatalogQuery.queryKey, () =>
    queryClient.fetchQuery(fixtureCatalogQuery)
  );
  if (rows) applyFixtureCatalogRows(rows);
}

/**
 * Revalidates the catalogue in the background. If nothing was applied at launch (first open, offline), the first
 * answer is applied right away; later ones are used from the next launch, so fixtures never change under a screen
 * that is already open.
 */
export function useFixtureCatalogSync() {
  const { data } = useQuery(fixtureCatalogQuery);
  useEffect(() => {
    if (data && !hasAppliedRealFixtures()) applyFixtureCatalogRows(data);
  }, [data]);
}
