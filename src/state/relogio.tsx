/**
 * Relógio da app. Em modo demo, a hora é deslocada para uma fase do dia de jogo e continua a andar.
 */

import { createContext, use, useState, type ReactNode } from 'react';

import { momentoDaFase, type FaseDiaDeJogo } from '@/lib/relogio';
import type { Jogo } from '@/mocks/tipos';

type Simulacao = { jogoId: string; fase: FaseDiaDeJogo };

type Relogio = {
  /** Diferença, em ms, entre a hora da app e a hora real (0 fora do modo demo). */
  desvioMs: number;
  simulacao: Simulacao | null;
  simularFase: (jogo: Jogo, fase: FaseDiaDeJogo) => void;
  usarHoraReal: () => void;
};

const RelogioContext = createContext<Relogio | null>(null);

export function RelogioProvider({ children }: { children: ReactNode }) {
  const [desvioMs, setDesvioMs] = useState(0);
  const [simulacao, setSimulacao] = useState<Simulacao | null>(null);

  const value: Relogio = {
    desvioMs,
    simulacao,
    simularFase: (jogo, fase) => {
      setDesvioMs(momentoDaFase(jogo, fase) - Date.now());
      setSimulacao({ jogoId: jogo.id, fase });
    },
    usarHoraReal: () => {
      setDesvioMs(0);
      setSimulacao(null);
    },
  };

  return <RelogioContext value={value}>{children}</RelogioContext>;
}

export function useRelogio() {
  const context = use(RelogioContext);
  if (!context) {
    throw new Error('useRelogio tem de ser usado dentro de <RelogioProvider>');
  }
  return context;
}
