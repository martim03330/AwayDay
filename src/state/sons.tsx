/**
 * Sons curtos da app. Vivem na raiz para não serem cortados quando um ecrã ou painel fecha.
 * Só tocam em resposta direta a um toque do utilizador, e só com o toggle "Sons" ligado.
 */

import { setAudioModeAsync, useAudioPlayer, type AudioPlayer } from 'expo-audio';
import { createContext, use, useEffect, type ReactNode } from 'react';

import { useAppState } from '@/state/app-state';

const SOM_CHECK_IN: number = require('@/assets/sounds/check-in.wav');
const SOM_CARIMBO: number = require('@/assets/sounds/carimbo.wav');

type Sons = {
  tocarCheckIn: () => void;
  tocarCarimbo: () => void;
};

const SonsContext = createContext<Sons | null>(null);

export function SonsProvider({ children }: { children: ReactNode }) {
  const { sonsLigados } = useAppState();
  // Com os sons desligados não carregamos ficheiros nem mexemos na sessão de áudio.
  const checkIn = useAudioPlayer(sonsLigados ? SOM_CHECK_IN : null);
  const carimbo = useAudioPlayer(sonsLigados ? SOM_CARIMBO : null);

  useEffect(() => {
    if (!sonsLigados) return;
    // Respeita o modo silencioso e não interrompe a música de outras apps.
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  }, [sonsLigados]);

  function tocar(player: AudioPlayer) {
    if (!sonsLigados) return;
    void player.seekTo(0);
    player.play();
  }

  return (
    <SonsContext value={{ tocarCheckIn: () => tocar(checkIn), tocarCarimbo: () => tocar(carimbo) }}>
      {children}
    </SonsContext>
  );
}

export function useSons() {
  const context = use(SonsContext);
  if (!context) {
    throw new Error('useSons tem de ser usado dentro de <SonsProvider>');
  }
  return context;
}
