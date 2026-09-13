import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { DURACAO_CARIMBO_MS } from '@/ui/carimbo';

/**
 * Deteta ids que entraram na lista depois de o ecrã os ter mostrado (ex.: estádio ou missão novos).
 * Só os marca como novos quando o ecrã está à vista, para a animação não correr em segundo plano.
 */
export function useCarimbosNovos(ids: readonly string[]) {
  const [vistos, setVistos] = useState<ReadonlySet<string>>(() => new Set(ids));
  const [focado, setFocado] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocado(true);
      return () => setFocado(false);
    }, [])
  );

  const novos = focado ? ids.filter((id) => !vistos.has(id)) : [];
  const chaveNovos = novos.join('|');

  useEffect(() => {
    if (!chaveNovos) return;
    const timeout = setTimeout(
      () => setVistos((atuais) => new Set([...atuais, ...chaveNovos.split('|')])),
      DURACAO_CARIMBO_MS + 150
    );
    return () => clearTimeout(timeout);
  }, [chaveNovos]);

  return (id: string) => novos.includes(id);
}
