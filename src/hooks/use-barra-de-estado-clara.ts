import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

import { useEstaEscuro } from '@/hooks/use-theme';

/**
 * Texto claro na barra de estado enquanto um ecrã de cabeçalho verde estiver à frente. As tabs mantêm os ecrãs
 * montados, por isso isto segue o foco e não a montagem.
 *
 * Ao sair, volta ao que a paleta pede: escuro sobre a cal, claro sobre o fundo de noite.
 */
export function useBarraDeEstadoClara() {
  const escuro = useEstaEscuro();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light', true);
      return () => setStatusBarStyle(escuro ? 'light' : 'dark', true);
    }, [escuro])
  );
}
