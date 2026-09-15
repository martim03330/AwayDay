import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchFixtureCatalogRows } from '@/features/fixtures/api';
import { applyFixtureCatalogRows, hasAppliedRealFixtures } from '@/features/fixtures/store';
import { freshOrSaved } from '@/lib/query-client';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const fixtureCatalogQuery = queryOptions({
  queryKey: ['fixtures', 'catalog'],
  queryFn: fetchFixtureCatalogRows,
  staleTime: FIVE_MINUTES_MS,
});

/**
 * Applies the catalogue at launch, before screens render: the saved copy if recent, otherwise fresh data (waiting a
 * few seconds at most). Call once the query cache is restored.
 */
export async function restoreFixtureCatalog(queryClient: QueryClient) {
  const rows = await freshOrSaved(
    queryClient,
    fixtureCatalogQuery.queryKey,
    () => queryClient.fetchQuery(fixtureCatalogQuery),
    FIVE_MINUTES_MS
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
