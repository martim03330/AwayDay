/**
 * Estado da demo, só em memória: volta ao início sempre que a app recarrega.
 */

import { createContext, use, useRef, useState, type ReactNode } from 'react';

import { deletePlaceVisit, recordPlaceVisit, recordReview } from '@/features/activity/api';
import { currentUserId } from '@/lib/session';
import { fotosIniciais } from '@/mocks/album';
import { avaliacoesIniciais } from '@/mocks/avaliacoes';
import {
  preferenciasIniciais,
  TIPOS_NOTIFICACAO,
  type TipoNotificacao,
} from '@/mocks/notificacoes';
import type {
  AvaliacaoVisita,
  FotoMissao,
  Local,
  MedicaoBarulho,
  Nota,
  VisitaLocal,
} from '@/mocks/tipos';
import { visitasIniciais } from '@/mocks/visitas';
import { useRelogio } from '@/state/relogio';

/** Estádios já visitados antes de qualquer avaliação. */
const ESTADIOS_VISITADOS_BASE = ['luz', 'alvalade', 'dragao', 'municipal-braga'];

/** Notas de exemplo, para a missão "Avalia 5 tascos" começar em curso. */
const NOTAS_TASCOS_INICIAIS: Partial<Record<string, Nota>> = {
  'tasca-terceiro-anel': 5,
  'bifanas-campanha': 4,
};

export type NovaAvaliacao = Omit<AvaliacaoVisita, 'id' | 'atualizadaEm'>;

type PreferenciasNotificacoes = Readonly<Record<TipoNotificacao, boolean>>;

/** `null` enquanto o utilizador não decidiu. Na demo nada é pedido ao sistema. */
export type EstadoPermissao = 'aceite' | 'recusada' | null;

export type Permissoes = { localizacao: EstadoPermissao; notificacoes: EstadoPermissao };

type AppState = {
  /** Em memória: cada arranque da app volta a mostrar o onboarding. */
  onboardingConcluido: boolean;
  /** Já passou pelo onboarding pelo menos uma vez (ao rever, as escolhas vêm preenchidas). */
  introducaoVista: boolean;
  permissoes: Permissoes;
  concluirOnboarding: (permissoes: Permissoes) => void;
  /** Guarda as permissões sem acabar a introdução: ainda falta o passo da conta. */
  guardarPermissoes: (permissoes: Permissoes) => void;
  /** Só para o deep link de demo: entra nas tabs sem mexer nas escolhas. */
  saltarOnboarding: () => void;
  reverIntroducao: () => void;
  clubeFavoritoId: string;
  escolherClube: (clubeId: string) => void;
  /** Só muda quando o utilizador confirma; a sugestão nunca é aplicada sozinha. */
  clubeDaTerraId: string | null;
  confirmarClubeDaTerra: (clubeId: string) => void;
  /** Base mais os estádios das visitas avaliadas. */
  estadiosVisitados: readonly string[];
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
  /** Pratos que o utilizador recomendou (cada um soma 1 às recomendações dos adeptos). */
  pratosRecomendados: ReadonlySet<string>;
  alternarRecomendacao: (pratoId: string) => void;
  /** A tua nota a cada tasco. */
  notasTascos: Readonly<Partial<Record<string, Nota>>>;
  darNotaTasco: (localId: string, nota: Nota) => void;
  /** Fotos de prova das missões: formam o álbum de recordações (uma por missão). */
  fotosMissoes: readonly FotoMissao[];
  /** Guarda a foto de prova; substitui a anterior da mesma missão. */
  adicionarFoto: (foto: Omit<FotoMissao, 'id'>) => void;
  apagarFoto: (fotoId: string) => void;
  /** Só medições válidas do barulhómetro; o som nunca é guardado. */
  medicoesBarulho: readonly MedicaoBarulho[];
  registarMedicao: (medicao: Omit<MedicaoBarulho, 'id'>) => void;
  /** Desligados por omissão. */
  sonsLigados: boolean;
  alternarSons: () => void;
  notificacoes: PreferenciasNotificacoes;
  alternarNotificacao: (tipo: TipoNotificacao) => void;
};

const AppStateContext = createContext<AppState | null>(null);

function alternarEmConjunto(conjunto: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const proximo = new Set(conjunto);
  if (proximo.has(id)) {
    proximo.delete(id);
  } else {
    proximo.add(id);
  }
  return proximo;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { desvioMs } = useRelogio();
  const [onboardingConcluido, setOnboardingConcluido] = useState(false);
  const [introducaoVista, setIntroducaoVista] = useState(false);
  const [permissoes, setPermissoes] = useState<Permissoes>({
    localizacao: null,
    notificacoes: null,
  });
  const [clubeFavoritoId, setClubeFavoritoId] = useState('benfica');
  const [clubeDaTerraId, setClubeDaTerraId] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<ReadonlySet<string>>(new Set());
  const [visitasLocais, setVisitasLocais] = useState<readonly VisitaLocal[]>(visitasIniciais);
  const [avaliacoes, setAvaliacoes] = useState<readonly AvaliacaoVisita[]>(avaliacoesIniciais);
  const [pratosRecomendados, setPratosRecomendados] = useState<ReadonlySet<string>>(new Set());
  const [notasTascos, setNotasTascos] =
    useState<Readonly<Partial<Record<string, Nota>>>>(NOTAS_TASCOS_INICIAIS);
  const [fotosMissoes, setFotosMissoes] = useState<readonly FotoMissao[]>(fotosIniciais);
  const [medicoesBarulho, setMedicoesBarulho] = useState<readonly MedicaoBarulho[]>([]);
  const [sonsLigados, setSonsLigados] = useState(false);
  const [notificacoes, setNotificacoes] = useState<PreferenciasNotificacoes>(preferenciasIniciais);
  /** Check-ins já enviados para a conta, para os apagar lá se forem anulados. */
  const checkInsNaConta = useRef(new Map<string, Promise<string | null>>());

  /**
   * Guarda na conta, se houver sessão, sem travar a app: a demo continua a funcionar sem rede.
   * Usa a hora real do servidor, nunca a hora simulada do modo demo.
   */
  function guardarNaConta<T>(acao: (userId: string) => Promise<T>) {
    const userId = currentUserId();
    if (!userId) return null;
    return acao(userId).catch((erro: unknown) => {
      if (__DEV__) console.warn('Não foi possível guardar na conta:', erro);
      return null;
    });
  }

  /** Hora da app (a simulada, no modo demo), para os registos baterem certo com o relógio do dia de jogo. */
  function agoraDaApp() {
    return new Date(Date.now() + desvioMs).toISOString();
  }

  function alternarCheckIn(localId: string) {
    const idVisita = `check-in-${localId}`;

    if (checkIns.has(localId)) {
      setCheckIns((atuais) => alternarEmConjunto(atuais, localId));
      setVisitasLocais((atuais) => atuais.filter((visita) => visita.id !== idVisita));
      const naConta = checkInsNaConta.current.get(localId);
      checkInsNaConta.current.delete(localId);
      void naConta?.then((visitaId) =>
        visitaId ? guardarNaConta(() => deletePlaceVisit(visitaId)) : null
      );
      return;
    }

    const pedido = guardarNaConta((userId) => recordPlaceVisit(userId, localId, 'check-in'));
    if (pedido) checkInsNaConta.current.set(localId, pedido);

    setCheckIns((atuais) => alternarEmConjunto(atuais, localId));
    setVisitasLocais((atuais) => [
      { id: idVisita, localId, data: agoraDaApp(), verificado: true, origem: 'check-in' },
      ...atuais,
    ]);
  }

  function registarVisitaManual(localId: string) {
    if (!visitasLocais.some((visita) => visita.localId === localId)) {
      void guardarNaConta((userId) => recordPlaceVisit(userId, localId, 'manual'));
    }
    setVisitasLocais((atuais) => {
      if (atuais.some((visita) => visita.localId === localId)) return atuais;
      return [
        {
          id: `manual-${localId}`,
          localId,
          data: agoraDaApp(),
          verificado: false,
          origem: 'manual',
        },
        ...atuais,
      ];
    });
  }

  function guardarAvaliacao(nova: NovaAvaliacao) {
    const id = `avaliacao-${nova.jogoId}`;
    const registo: AvaliacaoVisita = { ...nova, id, atualizadaEm: new Date().toISOString() };
    void guardarNaConta((userId) =>
      recordReview(userId, {
        fixtureId: nova.jogoId,
        stadium: nova.estadio,
        atmosphere: nova.ambiente,
        access: nova.acessos,
        comment: nova.comentario,
      })
    );
    setAvaliacoes((atuais) =>
      atuais.some((avaliacao) => avaliacao.id === id)
        ? atuais.map((avaliacao) => (avaliacao.id === id ? registo : avaliacao))
        : [registo, ...atuais]
    );
  }

  function adicionarFoto(foto: Omit<FotoMissao, 'id'>) {
    const registo: FotoMissao = { ...foto, id: `foto-${foto.missaoId}-${Date.now()}` };
    setFotosMissoes((atuais) => [
      registo,
      ...atuais.filter((atual) => atual.missaoId !== foto.missaoId),
    ]);
  }

  function registarMedicao(medicao: Omit<MedicaoBarulho, 'id'>) {
    const registo: MedicaoBarulho = { ...medicao, id: `medicao-${medicao.jogoId}-${Date.now()}` };
    setMedicoesBarulho((atuais) => [registo, ...atuais]);
  }

  function concluirOnboarding(escolhas: Permissoes) {
    const ligar = escolhas.notificacoes === 'aceite';
    setPermissoes(escolhas);
    setNotificacoes(
      Object.fromEntries(TIPOS_NOTIFICACAO.map((tipo) => [tipo, ligar])) as Record<
        TipoNotificacao,
        boolean
      >
    );
    setIntroducaoVista(true);
    setOnboardingConcluido(true);
  }

  const value: AppState = {
    onboardingConcluido,
    introducaoVista,
    permissoes,
    concluirOnboarding,
    guardarPermissoes: setPermissoes,
    saltarOnboarding: () => setOnboardingConcluido(true),
    reverIntroducao: () => setOnboardingConcluido(false),
    clubeFavoritoId,
    escolherClube: setClubeFavoritoId,
    clubeDaTerraId,
    confirmarClubeDaTerra: setClubeDaTerraId,
    estadiosVisitados: [
      ...new Set([...ESTADIOS_VISITADOS_BASE, ...avaliacoes.map((avaliacao) => avaliacao.estadioId)]),
    ],
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
    pratosRecomendados,
    alternarRecomendacao: (pratoId) =>
      setPratosRecomendados((atuais) => alternarEmConjunto(atuais, pratoId)),
    notasTascos,
    darNotaTasco: (localId, nota) => setNotasTascos((atuais) => ({ ...atuais, [localId]: nota })),
    fotosMissoes,
    adicionarFoto,
    apagarFoto: (fotoId) => setFotosMissoes((atuais) => atuais.filter((foto) => foto.id !== fotoId)),
    medicoesBarulho,
    registarMedicao,
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
