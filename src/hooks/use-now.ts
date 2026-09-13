import { useEffect, useState } from 'react';

import { useRelogio } from '@/state/relogio';

const DEFAULT_INTERVAL_MS = 30 * 1000;

/**
 * Hora atual da app em ms, atualizada periodicamente: a real, ou a simulada no modo demo.
 * Usar sempre este hook (e não `Date.now()`) em tudo o que depende da hora.
 */
export function useNow(intervalMs = DEFAULT_INTERVAL_MS) {
  const { desvioMs } = useRelogio();
  const [real, setReal] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setReal(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return real + desvioMs;
}
