import { useEffect, useState } from 'react';

const DEFAULT_INTERVAL_MS = 30 * 1000;

/** Hora atual em ms, atualizada periodicamente para estados que dependem do relógio (ex.: fim do jogo). */
export function useNow(intervalMs = DEFAULT_INTERVAL_MS) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
