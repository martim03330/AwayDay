import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * White status bar text while a screen with a green header is focused. Tabs keep their screens
 * mounted, so this follows focus rather than mounting.
 */
export function useBarraDeEstadoClara() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light', true);
      return () => setStatusBarStyle('dark', true);
    }, [])
  );
}
