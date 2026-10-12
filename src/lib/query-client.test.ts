import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => void storage.set(key, value),
    removeItem: async (key: string) => void storage.delete(key),
  },
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) }, Platform: {} }));

const { savedOrFresh, separatelySavedQuery } = await import('@/lib/query-client');

const DAY_MS = 24 * 60 * 60 * 1000;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let key = 0;
let client: QueryClient;
let storageKey: string;
let queryKey: string[];

beforeEach(() => {
  storage.clear();
  client = new QueryClient();
  key += 1;
  storageKey = `catalog-${key}`;
  queryKey = ['catalog', String(key)];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('separatelySavedQuery', () => {
  it('puts a recent saved copy in the client, dated when it was fetched', async () => {
    const savedAt = Date.now() - DAY_MS;
    storage.set(storageKey, JSON.stringify({ version: 1, savedAt, data: { rows: [1] } }));
    const data = await separatelySavedQuery<{ rows: number[] }>(queryKey, storageKey).restore(client);
    expect(data).toEqual({ rows: [1] });
    expect(client.getQueryState(queryKey)?.dataUpdatedAt).toBe(savedAt);
  });

  it('ignores and deletes a copy of another version, too old or broken', async () => {
    for (const raw of [
      JSON.stringify({ version: 0, savedAt: Date.now(), data: 1 }),
      JSON.stringify({ version: 1, savedAt: Date.now() - 8 * DAY_MS, data: 1 }),
      '{not json',
    ]) {
      storage.set(storageKey, raw);
      const fresh = new QueryClient();
      expect(await separatelySavedQuery(queryKey, storageKey).restore(fresh)).toBeUndefined();
      expect(storage.has(storageKey)).toBe(false);
    }
  });

  it('saves every successful fetch in its own entry and deletes it when the query is removed', async () => {
    const saved = separatelySavedQuery<number>(queryKey, storageKey);
    await saved.restore(client);
    await client.fetchQuery({ queryKey, queryFn: async () => 42 });
    await flush();
    const entry = JSON.parse(storage.get(storageKey) ?? 'null');
    expect(entry).toMatchObject({ version: 1, data: 42 });
    expect(entry.savedAt).toBe(client.getQueryState(queryKey)?.dataUpdatedAt);

    client.removeQueries({ queryKey });
    await flush();
    expect(storage.has(storageKey)).toBe(false);
  });
});

describe('savedOrFresh', () => {
  it('opens with the saved copy, however old, without waiting for the server', async () => {
    client.setQueryData(queryKey, 'saved', { updatedAt: Date.now() - 3 * DAY_MS });
    const fetchFresh = vi.fn(async () => 'fresh');
    expect(await savedOrFresh(client, queryKey, fetchFresh)).toBe('saved');
    expect(fetchFresh).not.toHaveBeenCalled();
  });

  it('with no saved copy, waits for the server', async () => {
    expect(await savedOrFresh(client, queryKey, async () => 'fresh')).toBe('fresh');
  });

  it('with no saved copy, gives up after 1.5 s or when the server fails', async () => {
    vi.useFakeTimers();
    const slow = savedOrFresh(client, queryKey, () => new Promise<string>(() => undefined));
    await vi.advanceTimersByTimeAsync(1499);
    let settled = false;
    void slow.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await slow).toBeUndefined();
    vi.useRealTimers();

    expect(await savedOrFresh(client, queryKey, () => Promise.reject(new Error('offline')))).toBeUndefined();
  });
});
