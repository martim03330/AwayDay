import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fetchGroupMembers, fetchGroupMessages } from '@/features/groups/api';
import { groupMessagesKey, usePrecarregarGrupos } from '@/features/groups/hooks/useGroups';
import { fetchGroupFixturePlans } from '@/features/groups/plans';

jest.mock('@/features/groups/api', () => ({
  fetchGroupMessages: jest.fn(async (groupId: string) => [{ id: `m-${groupId}` }]),
  fetchGroupMembers: jest.fn(async () => []),
}));
jest.mock('@/features/groups/plans', () => ({ fetchGroupFixturePlans: jest.fn(async () => []) }));

// Every test's cache is cleared at the end: its garbage-collection timers would keep Jest from exiting.
const caches: QueryClient[] = [];
function novaCache() {
  const client = new QueryClient();
  caches.push(client);
  return client;
}

function comCache(client: QueryClient) {
  return function Envolver({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('usePrecarregarGrupos', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => caches.splice(0).forEach((client) => client.clear()));

  it('fetches ahead the conversation of the three groups at the top, under the keys the group screen reads', async () => {
    const client = novaCache();
    renderHook(() => usePrecarregarGrupos(['a', 'b', 'c', 'd']), { wrapper: comCache(client) });

    await waitFor(() => expect(client.getQueryData(groupMessagesKey('c'))).toEqual([{ id: 'm-c' }]));
    expect(jest.mocked(fetchGroupMessages).mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'c']);
    expect(fetchGroupMembers).toHaveBeenCalledTimes(3);
    expect(fetchGroupFixturePlans).toHaveBeenCalledTimes(3);
    expect(client.getQueryData(groupMessagesKey('d'))).toBeUndefined();
    // Not saved on the phone, like the screen's own queries.
    expect(client.getQueryCache().find({ queryKey: groupMessagesKey('a') })?.meta).toEqual({ persist: false });
  });

  it('does not ask again for what it fetched less than a minute ago', async () => {
    const client = novaCache();
    const { rerender } = renderHook(({ ids }: { ids: string[] }) => usePrecarregarGrupos(ids), {
      wrapper: comCache(client),
      initialProps: { ids: ['a'] },
    });
    await waitFor(() => expect(client.getQueryData(groupMessagesKey('a'))).toBeDefined());

    rerender({ ids: ['a', 'b'] });
    await waitFor(() => expect(client.getQueryData(groupMessagesKey('b'))).toBeDefined());
    expect(jest.mocked(fetchGroupMessages).mock.calls.map(([id]) => id)).toEqual(['a', 'b']);
  });
});
