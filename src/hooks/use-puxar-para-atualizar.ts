import { useState } from 'react';

/**
 * Pull to refresh whose spinner shows only while the person's own pull is in flight. Tied to a query's
 * `isRefetching`, it also showed on every background refetch (coming back to a screen, an invalidation): the native
 * spinner pushed the whole page down and it then jumped back up. A failure keeps what is on screen.
 */
export function usePuxarParaAtualizar(refrescar: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  function onRefresh() {
    setRefreshing(true);
    void refrescar()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }

  return { refreshing, onRefresh };
}
