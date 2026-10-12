import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  defaultShouldDehydrateQuery,
  focusManager,
  hashKey,
  QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

/** How long a persisted cache is trusted. Queries must live at least this long to be persisted. */
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Change when the shape of persisted data changes, so old caches are discarded. v4: the big catalogues left the
 * shared blob for their own entries.
 */
const CACHE_BUSTER = 'catalog-v4';
/** Change when the shape of a separately saved query changes, so old copies are ignored. */
const SAVED_QUERY_VERSION = 1;
/** At launch, with no saved copy at all, how long the app waits for fresh data before opening with bundled data. */
const LAUNCH_WAIT_MS = 1500;

/** A query saved in its own AsyncStorage entry, outside the shared cache blob. */
type SavedQuery<T> = { version: number; savedAt: number; data: T };

/** The saved entry, or `null` when it is not valid JSON. */
function parseSaved<T>(raw: string) {
  try {
    return JSON.parse(raw) as Partial<SavedQuery<T>> | null;
  } catch {
    return null;
  }
}

/** Hashes of the queries saved in their own entry: the shared blob leaves them out. */
const separatelySavedHashes = new Set<string>();

/**
 * A big query (a whole catalogue) kept in its own AsyncStorage entry instead of the shared cache blob, which on
 * Android must stay under ~2 MB per entry. `restore` puts the saved copy back in the query client; after that, every
 * successful fetch is saved again, and removing the query (e.g. on sign-out) deletes the copy.
 */
export function separatelySavedQuery<T>(queryKey: QueryKey, storageKey: string) {
  const queryHash = hashKey(queryKey);
  separatelySavedHashes.add(queryHash);
  let watching = false;

  function save(client: QueryClient) {
    if (watching) return;
    watching = true;
    client.getQueryCache().subscribe((event) => {
      if (event.query.queryHash !== queryHash) return;
      if (event.type === 'removed') {
        AsyncStorage.removeItem(storageKey).catch(() => undefined);
        return;
      }
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const saved: SavedQuery<T> = {
        version: SAVED_QUERY_VERSION,
        savedAt: event.query.state.dataUpdatedAt,
        data: event.action.data as T,
      };
      AsyncStorage.setItem(storageKey, JSON.stringify(saved)).catch(() => undefined);
    });
  }

  return {
    /**
     * Puts the saved copy (if any, recent and of this version) in the query client, dated when it was fetched so it
     * revalidates as usual, then starts saving every new answer. Returns the data now in the client, if any.
     */
    async restore(client: QueryClient): Promise<T | undefined> {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const saved = raw === null ? null : parseSaved<T>(raw);
        const usable =
          saved !== null &&
          saved.version === SAVED_QUERY_VERSION &&
          typeof saved.savedAt === 'number' &&
          saved.data !== undefined &&
          Date.now() - saved.savedAt < CACHE_MAX_AGE_MS;
        const newer = (client.getQueryState(queryKey)?.dataUpdatedAt ?? 0) >= (saved?.savedAt ?? 0);
        if (usable && !newer) client.setQueryData<T>(queryKey, saved.data, { updatedAt: saved.savedAt });
        // A broken or outdated copy goes away; the next answer replaces it anyway.
        else if (raw !== null && !usable) AsyncStorage.removeItem(storageKey).catch(() => undefined);
      } catch {
        // Unreadable storage: open without the saved copy.
      } finally {
        save(client);
      }
      return client.getQueryData<T>(queryKey);
    },
  };
}

/**
 * The data to open the app with. A saved copy, however old, opens the app right away (the query revalidates it in
 * the background once mounted). Only with no copy at all does it wait for the server, at most LAUNCH_WAIT_MS; then,
 * or offline, it gives `undefined` and the app opens with its bundled data.
 */
export async function savedOrFresh<T>(
  client: QueryClient,
  queryKey: QueryKey,
  fetchFresh: () => Promise<T>
): Promise<T | undefined> {
  const saved = client.getQueryData<T>(queryKey);
  if (saved !== undefined) return saved;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), LAUNCH_WAIT_MS);
  });
  try {
    return await Promise.race([fetchFresh(), giveUp]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
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

  const finishRestore = () => {
    void Promise.resolve(onRestored?.(queryClient))
      .catch(() => undefined)
      .finally(() => setRestored(true));
  };

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
        // Queries can opt out with `meta: { persist: false }` (e.g. short-lived signed URLs). Separately saved
        // queries (the catalogues) have their own entries.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) &&
            query.meta?.persist !== false &&
            !separatelySavedHashes.has(query.queryHash),
        },
      }}
      onSuccess={finishRestore}
      // A broken cache is discarded by TanStack Query; the catalogues have their own entries and still come back.
      onError={finishRestore}>
      {restored ? children : null}
    </PersistQueryClientProvider>
  );
}
