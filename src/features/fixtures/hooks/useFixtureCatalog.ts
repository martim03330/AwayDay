import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';

import { fetchFixtureCatalogRows } from '@/features/fixtures/api';
import { applyFixtureCatalogRows } from '@/features/fixtures/store';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export const fixtureCatalogQuery = queryOptions({
  queryKey: ['fixtures', 'catalog'],
  queryFn: fetchFixtureCatalogRows,
  staleTime: FIVE_MINUTES_MS,
});

/** Applies the persisted catalogue. Call once the query cache is restored, before screens render. */
export function restoreFixtureCatalog(queryClient: QueryClient) {
  const rows = queryClient.getQueryData(fixtureCatalogQuery.queryKey);
  if (rows) applyFixtureCatalogRows(rows);
}

/**
 * Revalidates the catalogue in the background. Fresh data is persisted and used from the next
 * launch, so fixtures never change under a screen that is already open.
 */
export function useFixtureCatalogSync() {
  useQuery(fixtureCatalogQuery);
}
