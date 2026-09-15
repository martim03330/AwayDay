import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  defaultShouldDehydrateQuery,
  focusManager,
  QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

/** How long a persisted cache is trusted. Queries must live at least this long to be persisted. */
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Change when the shape of persisted data changes, so old caches are discarded. */
const CACHE_BUSTER = 'catalog-v3';
/** At launch, how long the app waits for fresh data when the saved copy is old. Offline, the saved copy is used. */
const LAUNCH_WAIT_MS = 3000;

/**
 * The data to open the app with: the saved copy while it is recent; otherwise fresh data from the server, waiting at
 * most LAUNCH_WAIT_MS (then, or offline, the saved copy). Without this, new data only showed from the launch after
 * the one that downloaded it.
 */
export async function freshOrSaved<T>(
  client: QueryClient,
  queryKey: QueryKey,
  fetchFresh: () => Promise<T>,
  staleTimeMs: number
): Promise<T | undefined> {
  const saved = client.getQueryData<T>(queryKey);
  const updatedAt = client.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
  if (saved !== undefined && Date.now() - updatedAt < staleTimeMs) return saved;
  const giveUp = new Promise<T | undefined>((resolve) =>
    setTimeout(() => resolve(saved), LAUNCH_WAIT_MS)
  );
  try {
    return await Promise.race([fetchFresh(), giveUp]);
  } catch {
    return saved;
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: CACHE_MAX_AGE_MS,
      networkMode: 'offlineFirst',
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'awayday-query-cache',
});

type QueryProviderProps = {
  children: ReactNode;
  /** Runs once the persisted cache is back in memory; children render when it finishes. */
  onRestored?: (client: QueryClient) => void | Promise<void>;
};

/**
 * TanStack Query with its cache persisted in AsyncStorage: the app opens with the last data it saw
 * and revalidates in the background. Children only render after the cache has been restored.
 */
export function QueryProvider({ children, onRestored }: QueryProviderProps) {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Refetch stale queries when the app comes back to the foreground.
    const subscription = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE_MS,
        buster: CACHE_BUSTER,
        // Queries can opt out with `meta: { persist: false }` (e.g. short-lived signed URLs).
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) && query.meta?.persist !== false,
        },
      }}
      onSuccess={() => {
        void Promise.resolve(onRestored?.(queryClient))
          .catch(() => undefined)
          .finally(() => setRestored(true));
      }}
      // A broken cache is discarded by TanStack Query; the app carries on with its bundled data.
      onError={() => setRestored(true)}>
      {restored ? children : null}
    </PersistQueryClientProvider>
  );
}
