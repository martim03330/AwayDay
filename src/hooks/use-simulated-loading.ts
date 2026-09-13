import { useEffect, useState } from 'react';

const MIN_DELAY_MS = 600;
const MAX_EXTRA_DELAY_MS = 300;

/**
 * Simula o tempo de resposta de uma API, já que todos os dados vêm de mocks locais.
 * Mudar `key` volta a mostrar o loading; `refresh` mantém o conteúdo e só mostra o indicador de atualização.
 */
export function useSimulatedLoading(key: string) {
  const [version, setVersion] = useState(0);
  const [completedRequest, setCompletedRequest] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const request = `${key}#${version}`;

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        setCompletedRequest(request);
        setRefreshing(false);
      },
      MIN_DELAY_MS + Math.random() * MAX_EXTRA_DELAY_MS
    );
    return () => clearTimeout(timeout);
  }, [request]);

  function refresh() {
    setRefreshing(true);
    setVersion((current) => current + 1);
  }

  return {
    loading: completedRequest !== request && !refreshing,
    refreshing,
    refresh,
  };
}
