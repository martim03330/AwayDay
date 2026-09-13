/**
 * Estado da demo, só em memória: volta ao início sempre que a app recarrega.
 */

import { createContext, use, useState, type ReactNode } from 'react';

import { avaliacoesIniciais } from '@/mocks/avaliacoes';
import { preferenciasIniciais, type TipoNotificacao } from '@/mocks/notificacoes';
import type { AvaliacaoVisita, Local, VisitaLocal } from '@/mocks/tipos';
import { visitasIniciais } from '@/mocks/visitas';

/** Estádios já visitados antes de qualquer avaliação. */
const ESTADIOS_VISITADOS_BASE = ['luz', 'alvalade', 'dragao', 'municipal-braga'];

export type NovaAvaliacao = Omit<AvaliacaoVisita, 'id' | 'atualizadaEm'>;

type PreferenciasNotificacoes = Readonly<Record<TipoNotificacao, boolean>>;

type AppState = {
  clubeFavoritoId: string;
  escolherClube: (clubeId: string) => void;
  /** Só muda quando o utilizador confirma; a sugestão nunca é aplicada sozinha. */
  clubeDaTerraId: string | null;
  confirmarClubeDaTerra: (clubeId: string) => void;
  /** Base mais os estádios das visitas avaliadas. */
  estadiosVisitados: readonly string[];
  /** Estádios registados de novo que ainda não fizeram a animação de carimbo no perfil. */
  estadiosPorCarimbar: readonly string[];
  marcarCarimbosVistos: () => void;
  fezCheckIn: (localId: string) => boolean;
  alternarCheckIn: (localId: string) => void;
  pessoasAqui: (local: Local) => number;
  visitasLocais: readonly VisitaLocal[];
  /** A visita verificada, se existir; senão a visita por verificar. */
  visitaDoLocal: (localId: string) => VisitaLocal | undefined;
  registarVisitaManual: (localId: string) => void;
  avaliacoes: readonly AvaliacaoVisita[];
  avaliacaoDoJogo: (jogoId: string) => AvaliacaoVisita | undefined;
  /** Cria ou atualiza a avaliação da visita (uma por jogo). */
  guardarAvaliacao: (avaliacao: NovaAvaliacao) => void;
  /** Desligados por omissão. */
  sonsLigados: boolean;
  alternarSons: () => void;
  notificacoes: PreferenciasNotificacoes;
  alternarNotificacao: (tipo: TipoNotificacao) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [clubeFavoritoId, setClubeFavoritoId] = useState('benfica');
  const [clubeDaTerraId, setClubeDaTerraId] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<ReadonlySet<string>>(new Set());
  const [visitasLocais, setVisitasLocais] = useState<readonly VisitaLocal[]>(visitasIniciais);
  const [avaliacoes, setAvaliacoes] = useState<readonly AvaliacaoVisita[]>(avaliacoesIniciais);
  const [estadiosPorCarimbar, setEstadiosPorCarimbar] = useState<readonly string[]>([]);
  const [sonsLigados, setSonsLigados] = useState(false);
  const [notificacoes, setNotificacoes] = useState<PreferenciasNotificacoes>(preferenciasIniciais);

  const estadiosVisitados = [
    ...new Set([...ESTADIOS_VISITADOS_BASE, ...avaliacoes.map((avaliacao) => avaliacao.estadioId)]),
  ];

  function alternarCheckIn(localId: string) {
    const idVisita = `check-in-${localId}`;

    if (checkIns.has(localId)) {
      setCheckIns((atuais) => {
        const proximos = new Set(atuais);
        proximos.delete(localId);
        return proximos;
      });
      setVisitasLocais((atuais) => atuais.filter((visita) => visita.id !== idVisita));
      return;
    }

    setCheckIns((atuais) => new Set(atuais).add(localId));
    setVisitasLocais((atuais) => [
      { id: idVisita, localId, data: new Date().toISOString(), verificado: true, origem: 'check-in' },
      ...atuais,
    ]);
  }

  function registarVisitaManual(localId: string) {
    setVisitasLocais((atuais) => {
      if (atuais.some((visita) => visita.localId === localId)) return atuais;
      return [
        {
          id: `manual-${localId}`,
          localId,
          data: new Date().toISOString(),
          verificado: false,
          origem: 'manual',
        },
        ...atuais,
      ];
    });
  }

  function guardarAvaliacao(nova: NovaAvaliacao) {
    if (!estadiosVisitados.includes(nova.estadioId)) {
      setEstadiosPorCarimbar((atuais) =>
        atuais.includes(nova.estadioId) ? atuais : [...atuais, nova.estadioId]
      );
    }

    const id = `avaliacao-${nova.jogoId}`;
    const registo: AvaliacaoVisita = { ...nova, id, atualizadaEm: new Date().toISOString() };
    setAvaliacoes((atuais) =>
      atuais.some((avaliacao) => avaliacao.id === id)
        ? atuais.map((avaliacao) => (avaliacao.id === id ? registo : avaliacao))
        : [registo, ...atuais]
    );
  }

  const value: AppState = {
    clubeFavoritoId,
    escolherClube: setClubeFavoritoId,
    clubeDaTerraId,
    confirmarClubeDaTerra: setClubeDaTerraId,
    estadiosVisitados,
    estadiosPorCarimbar,
    marcarCarimbosVistos: () => setEstadiosPorCarimbar([]),
    fezCheckIn: (localId) => checkIns.has(localId),
    alternarCheckIn,
    pessoasAqui: (local) => local.pessoasAqui + (checkIns.has(local.id) ? 1 : 0),
    visitasLocais,
    visitaDoLocal: (localId) =>
      visitasLocais.find((visita) => visita.localId === localId && visita.verificado) ??
      visitasLocais.find((visita) => visita.localId === localId),
    registarVisitaManual,
    avaliacoes,
    avaliacaoDoJogo: (jogoId) => avaliacoes.find((avaliacao) => avaliacao.jogoId === jogoId),
    guardarAvaliacao,
    sonsLigados,
    alternarSons: () => setSonsLigados((ligados) => !ligados),
    notificacoes,
    alternarNotificacao: (tipo) =>
      setNotificacoes((atuais) => ({ ...atuais, [tipo]: !atuais[tipo] })),
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
