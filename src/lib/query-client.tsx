import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

/** How long a persisted cache is trusted. Queries must live at least this long to be persisted. */
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Change when the shape of persisted data changes, so old caches are discarded. */
const CACHE_BUSTER = 'catalog-v2';

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
  /** Runs once the persisted cache is back in memory, before any child renders. */
  onRestored?: (client: QueryClient) => void;
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
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS, buster: CACHE_BUSTER }}
      onSuccess={() => {
        onRestored?.(queryClient);
        setRestored(true);
      }}
      // A broken cache is discarded by TanStack Query; the app carries on with its bundled data.
      onError={() => setRestored(true)}>
      {restored ? children : null}
    </PersistQueryClientProvider>
  );
}
