/**
 * Estado da demo, só em memória: volta ao início sempre que a app recarrega.
 */

import { createContext, use, useState, type ReactNode } from 'react';

import { avaliacoesIniciais } from '@/mocks/avaliacoes';
import { obterJogo } from '@/mocks/jogos';
import type { Avaliacao, Local } from '@/mocks/tipos';

/** Estádios já visitados antes de qualquer avaliação. */
const ESTADIOS_VISITADOS_BASE = ['luz', 'alvalade', 'dragao', 'municipal-braga'];

type Avaliacoes = Readonly<Partial<Record<string, Avaliacao>>>;

type AppState = {
  clubeFavoritoId: string;
  escolherClube: (clubeId: string) => void;
  /** Base mais os estádios dos jogos avaliados. */
  estadiosVisitados: readonly string[];
  fezCheckIn: (localId: string) => boolean;
  alternarCheckIn: (localId: string) => void;
  pessoasAqui: (local: Local) => number;
  totalCheckIns: number;
  avaliacoes: Avaliacoes;
  guardarAvaliacao: (avaliacao: Avaliacao) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [clubeFavoritoId, setClubeFavoritoId] = useState('benfica');
  const [checkIns, setCheckIns] = useState<ReadonlySet<string>>(new Set());
  const [avaliacoes, setAvaliacoes] = useState<Avaliacoes>(() =>
    Object.fromEntries(avaliacoesIniciais.map((avaliacao) => [avaliacao.jogoId, avaliacao]))
  );

  function alternarCheckIn(localId: string) {
    setCheckIns((atuais) => {
      const proximos = new Set(atuais);
      if (proximos.has(localId)) {
        proximos.delete(localId);
      } else {
        proximos.add(localId);
      }
      return proximos;
    });
  }

  function guardarAvaliacao(avaliacao: Avaliacao) {
    setAvaliacoes((atuais) => ({ ...atuais, [avaliacao.jogoId]: avaliacao }));
  }

  const estadiosAvaliados = Object.keys(avaliacoes).flatMap((jogoId) => {
    const estadioId = obterJogo(jogoId)?.estadioId;
    return estadioId ? [estadioId] : [];
  });

  const value: AppState = {
    clubeFavoritoId,
    escolherClube: setClubeFavoritoId,
    estadiosVisitados: [...new Set([...ESTADIOS_VISITADOS_BASE, ...estadiosAvaliados])],
    fezCheckIn: (localId) => checkIns.has(localId),
    alternarCheckIn,
    pessoasAqui: (local) => local.pessoasAqui + (checkIns.has(local.id) ? 1 : 0),
    totalCheckIns: checkIns.size,
    avaliacoes,
    guardarAvaliacao,
  };

  return <AppStateContext value={value}>{children}</AppStateContext>;
}

export function useAppState() {
  const context = use(AppStateContext);
  if (!context) {
    throw new Error('useAppState tem de ser usado dentro de <AppStateProvider>');
  }
  return context;
}
