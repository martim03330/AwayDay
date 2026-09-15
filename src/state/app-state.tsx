/**
 * App state. Where the data comes from depends on the mode:
 * - demo mode: sample data and simulated time, in memory only; nothing goes to the account or stays on the phone;
 * - without an account: the user's activity is kept on this phone;
 * - with an account: the activity comes from the account and every change is written there.
 * Device preferences (introduction, permissions, sounds, demo mode) always stay on the phone.
 */

import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import {
  deletePlaceVisit,
  recommendDish,
  recordNoiseMeasurement,
  recordPlaceVisit,
  recordReview,
  savePlaceRating,
  savePlaceSubScores,
  unrecommendDish,
  votePlace,
  type PlaceSubScores,
} from '@/features/activity/api';
import { useMyAttendance } from '@/features/activity/hooks/useAttendance';
import {
  myDishRecommendationsKey,
  myPlaceRatingsKey,
  myPlaceSubScoresKey,
  myPlaceVotesKey,
  myPlaceVisitsKey,
  myReviewsKey,
  useMyDishRecommendations,
  useMyNoiseMeasurements,
  useMyPlaceSubScores,
  useMyPlaceVotes,
  useMyPlaceRatings,
  useMyPlaceVisits,
  useMyReviews,
  useRefreshMyActivity,
} from '@/features/activity/hooks/useMyActivity';
import {
  NoiseMeasurementRefused,
  type PlaceVisitRecord,
  type ReviewRecord,
} from '@/features/activity/types';
import { deleteMissionPhoto, saveMissionPhoto } from '@/features/missions/api';
import {
  myMissionPhotosKey,
  useMyMissionPhotos,
  useRefreshMissionPhotos,
} from '@/features/missions/hooks/useMissionPhotos';
import type { MissionPhoto } from '@/features/missions/types';
import { saveNotificationPreference } from '@/features/profile/api';
import {
  notificationPreferencesKey,
  useNotificationPreferences,
  useRefreshNotificationPreferences,
} from '@/features/profile/hooks/useNotificationPreferences';
import { setDemoFixturesActive } from '@/features/fixtures/store';
import { setDemoPlacesActive } from '@/features/places/store';
import type { NotificationKind, NotificationPreferences } from '@/features/profile/types';
import { useNow } from '@/hooks/use-now';
import { checkInsDoDia } from '@/lib/presenca';
import { currentUserId, useUserId } from '@/lib/session';
import { fotosIniciais } from '@/mocks/album';
import { avaliacoesIniciais } from '@/mocks/avaliacoes';
import { obterJogo } from '@/mocks/jogos';
import { preferenciasIniciais, type TipoNotificacao } from '@/mocks/notificacoes';
import type {
  AvaliacaoVisita,
  FotoMissao,
  Local,
  MedicaoBarulho,
  Nota,
  VisitaLocal,
} from '@/mocks/tipos';
import { visitasIniciais } from '@/mocks/visitas';
import {
  ATIVIDADE_VAZIA,
  guardarAtividadeLocal,
  guardarPreferencias,
  lerAtividadeLocal,
  lerPreferencias,
  PREFERENCIAS_INICIAIS,
  temAtividade,
  type AtividadeLocal,
  type EstadoPermissaoGuardado,
  type PreferenciasLocais,
} from '@/state/armazenamento-local';
import { useRelogio } from '@/state/relogio';

/** Demo only: stadiums already visited before any review. */
const ESTADIOS_VISITADOS_DEMO = ['luz', 'alvalade', 'dragao', 'municipal-braga'];

/** Demo only: sample ratings, so the "Avalia 5 tascos" mission starts in progress. */
const NOTAS_TASCOS_DEMO: Record<string, Nota> = {
  'tasca-terceiro-anel': 5,
  'bifanas-campanha': 4,
};

/** Used only before the user picks a club in the introduction. */
const CLUBE_POR_OMISSAO = 'benfica';

const TIPO_NA_CONTA: Record<TipoNotificacao, NotificationKind> = {
  'alteracao-horario': 'kickoff_change',
  meteorologia: 'weather',
  'movimento-grupo': 'group_movement',
  'novo-carimbo': 'new_stamp',
};

export type NovaAvaliacao = Omit<AvaliacaoVisita, 'id' | 'atualizadaEm'>;

/** The camera's file type, needed to upload the photo to the account. */
export type NovaFoto = Omit<FotoMissao, 'id'> & { mimeType: string | null };

type PreferenciasNotificacoes = Readonly<Record<TipoNotificacao, boolean>>;

/** `null` enquanto o utilizador não decidiu. Na demo nada é pedido ao sistema. */
export type EstadoPermissao = EstadoPermissaoGuardado;

export type Permissoes = { localizacao: EstadoPermissao; notificacoes: EstadoPermissao };

/** Where the activity on screen comes from. */
export type FonteDados = 'demo' | 'telemovel' | 'conta';

export type ResultadoMedicao = 'registada' | 'cedo-demais' | 'fora-do-jogo' | 'erro';

/** Your beer (cervejómetro) and food (petiscómetro) scores for a tasco. */
export type NotasCervejaPetisco = { cerveja: Nota | null; petisco: Nota | null };

export type ResultadoJuntar = { juntados: number; falhados: number; medicoesQueFicam: number };

type AppState = {
  fonte: FonteDados;
  modoDemo: boolean;
  alternarModoDemo: () => void;
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
  estadiosVisitados: readonly string[];
  fezCheckIn: (localId: string) => boolean;
  alternarCheckIn: (localId: string) => void;
  /** `null` while live presence is not available. */
  pessoasAqui: (local: Local) => number | null;
  visitasLocais: readonly VisitaLocal[];
  /** A visita verificada, se existir; senão a visita por verificar. */
  visitaDoLocal: (localId: string) => VisitaLocal | undefined;
  registarVisitaManual: (localId: string) => void;
  avaliacoes: readonly AvaliacaoVisita[];
  avaliacaoDoJogo: (jogoId: string) => AvaliacaoVisita | undefined;
  /** Cria ou atualiza a avaliação da visita (uma por jogo). */
  guardarAvaliacao: (avaliacao: NovaAvaliacao) => void;
  /** Pratos que recomendas. Com conta ficam guardados na conta; sem conta e no modo demo, só em memória. */
  pratosRecomendados: ReadonlySet<string>;
  /** Recommendations already included in each dish's count (from the server), so they are not counted twice. */
  recomendacoesJaContadas: ReadonlySet<string>;
  alternarRecomendacao: (pratoId: string) => void;
  /** Your beer and food scores, by tasco. Only after an overall score. */
  notasCervejaPetisco: Readonly<Partial<Record<string, NotasCervejaPetisco>>>;
  darNotaCervejaPetisco: (localId: string, notas: Partial<NotasCervejaPetisco>) => void;
  /** Your answer to "is this a good place for match day?" for suggested tascos. Needs an account (demo: memory). */
  votosTascos: Readonly<Partial<Record<string, boolean>>>;
  votarTasco: (localId: string, bom: boolean) => void;
  /** A tua nota a cada tasco. */
  notasTascos: Readonly<Partial<Record<string, Nota>>>;
  darNotaTasco: (localId: string, nota: Nota) => void;
  /** Fotos de prova das missões: formam o álbum de recordações (uma por missão). */
  fotosMissoes: readonly FotoMissao[];
  /** Guarda a foto de prova; substitui a anterior da mesma missão. */
  adicionarFoto: (foto: NovaFoto) => void;
  apagarFoto: (fotoId: string) => void;
  /** Só medições válidas do barulhómetro; o som nunca é guardado. */
  medicoesBarulho: readonly MedicaoBarulho[];
  /** With an account, the server can refuse (too soon, or the game is not on). */
  registarMedicao: (medicao: Omit<MedicaoBarulho, 'id'>) => Promise<ResultadoMedicao>;
  /** Desligados por omissão. */
  sonsLigados: boolean;
  alternarSons: () => void;
  notificacoes: PreferenciasNotificacoes;
  alternarNotificacao: (tipo: TipoNotificacao) => void;
  /** Signed in for the first time with activity kept on this phone: ask whether to bring it in. */
  atividadeParaJuntar: AtividadeLocal | null;
  juntarAtividadeAConta: () => Promise<ResultadoJuntar>;
  naoJuntarAtividade: () => void;
};

const AppStateContext = createContext<AppState | null>(null);

function atividadeDemo(): AtividadeLocal {
  return {
    avaliacoes: [...avaliacoesIniciais],
    visitas: [...visitasIniciais],
    notasTascos: { ...NOTAS_TASCOS_DEMO },
    notasCervejaPetisco: {},
    fotos: [...fotosIniciais],
    medicoes: [],
  };
}

function alternarEmConjunto(conjunto: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const proximo = new Set(conjunto);
  if (proximo.has(id)) {
    proximo.delete(id);
  } else {
    proximo.add(id);
  }
  return proximo;
}

function eNota(valor: number): valor is Nota {
  return valor === 1 || valor === 2 || valor === 3 || valor === 4 || valor === 5;
}

function avaliacaoDaConta(review: ReviewRecord): AvaliacaoVisita | null {
  const jogo = obterJogo(review.fixtureId);
  if (!jogo || !eNota(review.stadium) || !eNota(review.atmosphere) || !eNota(review.access)) return null;
  return {
    id: `avaliacao-${review.fixtureId}`,
    jogoId: review.fixtureId,
    estadioId: jogo.estadioId,
    estadio: review.stadium,
    ambiente: review.atmosphere,
    acessos: review.access,
    comentario: review.comment,
    dataVisita: jogo.inicio,
    atualizadaEm: review.updatedAt,
  };
}

function visitaDaConta(visit: PlaceVisitRecord): VisitaLocal {
  return {
    id: visit.id,
    localId: visit.placeId,
    data: visit.visitedAt,
    verificado: visit.source === 'check-in',
    origem: visit.source,
  };
}

function fotoDaConta(photo: MissionPhoto): FotoMissao {
  return {
    id: photo.storagePath,
    missaoId: photo.missionId,
    uri: photo.url,
    tiradaEm: photo.takenAt,
    jogoId: photo.fixtureId,
    estadioId: photo.venueId,
    verificada: photo.verified,
    exemplo: false,
  };
}

function porTipo(valor: (tipo: TipoNotificacao) => boolean): Record<TipoNotificacao, boolean> {
  return {
    'alteracao-horario': valor('alteracao-horario'),
    meteorologia: valor('meteorologia'),
    'movimento-grupo': valor('movimento-grupo'),
    'novo-carimbo': valor('novo-carimbo'),
  };
}

function avisarQueNaoGuardou(erro: unknown) {
  if (__DEV__) console.warn('Não foi possível guardar na conta:', erro);
  Alert.alert('Não deu para guardar', 'Verifica a ligação e tenta outra vez.');
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { desvioMs, usarHoraReal } = useRelogio();
  const queryClient = useQueryClient();
  const sessaoUserId = useUserId();
  const [carregado, setCarregado] = useState(false);
  const [preferencias, setPreferencias] = useState<PreferenciasLocais>(PREFERENCIAS_INICIAIS);
  const [atividadeLocal, setAtividadeLocal] = useState<AtividadeLocal>(ATIVIDADE_VAZIA);
  const [demo, setDemo] = useState<AtividadeLocal>(atividadeDemo);
  const [pratosRecomendados, setPratosRecomendados] = useState<ReadonlySet<string>>(new Set());
  /** With an account: recommendation taps made in this session, on top of what the account says. */
  const [recomendacoesTocadas, setRecomendacoesTocadas] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [votosDemo, setVotosDemo] = useState<Readonly<Partial<Record<string, boolean>>>>({});
  /** Photos taken with an account that are still uploading (or samples, which never upload). */
  const [fotosPendentes, setFotosPendentes] = useState<readonly FotoMissao[]>([]);

  useEffect(() => {
    let ativo = true;
    void Promise.all([lerPreferencias(), lerAtividadeLocal()]).then(([guardadas, atividade]) => {
      if (!ativo) return;
      // Before the first screen renders, so it never shows the wrong list of places.
      setDemoFixturesActive(guardadas.modoDemo);
      setDemoPlacesActive(guardadas.modoDemo);
      setPreferencias(guardadas);
      setAtividadeLocal(atividade);
      setCarregado(true);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (carregado) void guardarPreferencias(preferencias);
  }, [carregado, preferencias]);

  useEffect(() => {
    if (carregado) void guardarAtividadeLocal(atividadeLocal);
  }, [carregado, atividadeLocal]);

  const modoDemo = preferencias.modoDemo;
  // In demo mode the account is left alone: no reads, no writes.
  const userId = modoDemo ? null : sessaoUserId;
  const fonte: FonteDados = modoDemo ? 'demo' : userId ? 'conta' : 'telemovel';

  const reviews = useMyReviews(userId);
  const placeVisits = useMyPlaceVisits(userId);
  const ratings = useMyPlaceRatings(userId);
  const noise = useMyNoiseMeasurements(userId);
  const photos = useMyMissionPhotos(userId);
  const attendance = useMyAttendance(userId);
  const dishRecommendations = useMyDishRecommendations(userId);
  const placeSubScores = useMyPlaceSubScores(userId);
  const placeVotes = useMyPlaceVotes(userId);
  const notificationPreferences = useNotificationPreferences(userId);
  const refreshActivity = useRefreshMyActivity(userId);
  const refreshPhotos = useRefreshMissionPhotos(userId);
  const refreshNotifications = useRefreshNotificationPreferences(userId);

  const daConta: AtividadeLocal = {
    avaliacoes: (reviews.data ?? []).flatMap((review) => {
      const convertida = avaliacaoDaConta(review);
      return convertida ? [convertida] : [];
    }),
    visitas: (placeVisits.data ?? []).map(visitaDaConta),
    notasTascos: Object.fromEntries(
      Object.entries(ratings.data ?? {}).filter((entrada): entrada is [string, Nota] => eNota(entrada[1]))
    ),
    fotos: [
      ...fotosPendentes,
      ...(photos.data ?? [])
        .filter((photo) => !fotosPendentes.some((pendente) => pendente.missaoId === photo.missionId))
        .map(fotoDaConta),
    ],
    medicoes: (noise.data ?? []).flatMap((reading) => {
      const jogo = obterJogo(reading.fixtureId);
      return jogo
        ? [
            {
              id: reading.id,
              jogoId: reading.fixtureId,
              estadioId: jogo.estadioId,
              medidaEm: reading.measuredAt,
              nivel: reading.level,
            },
          ]
        : [];
    }),
    // With an account these come from their own query (see notasCervejaPetisco below).
    notasCervejaPetisco: {},
  };

  const atividade = fonte === 'demo' ? demo : fonte === 'conta' ? daConta : atividadeLocal;
  const agora = useNow();
  const checkInsHoje = checkInsDoDia(agora, atividade.visitas);

  /** Hora da app (a simulada, no modo demo), para os registos baterem certo com o relógio do dia de jogo. */
  function agoraDaApp() {
    return new Date(Date.now() + desvioMs).toISOString();
  }

  /** Changes the activity kept in memory (demo) or on the phone (no account). */
  function mudarAtividade(mudar: (atual: AtividadeLocal) => AtividadeLocal) {
    if (fonte === 'demo') setDemo(mudar);
    else setAtividadeLocal(mudar);
  }

  /** Writes to the account without blocking the app, then refetches (which also undoes a failed change). */
  function naConta(acao: (id: string) => Promise<unknown>, atualizar: () => Promise<unknown>) {
    const id = currentUserId();
    if (!id) return;
    void acao(id)
      .catch(avisarQueNaoGuardou)
      .finally(() => void atualizar());
  }

  function mudarPreferencias(mudar: (atual: PreferenciasLocais) => PreferenciasLocais) {
    setPreferencias(mudar);
  }

  function alternarCheckIn(localId: string) {
    const atual = checkInsHoje.find((visita) => visita.localId === localId);

    if (fonte === 'conta') {
      // A check-in that is still being saved has no id on the account yet.
      if (atual?.id.startsWith('pendente-')) return;
      const chave = myPlaceVisitsKey(userId);
      if (atual) {
        queryClient.setQueryData<PlaceVisitRecord[]>(chave, (lista) =>
          lista?.filter((visita) => visita.id !== atual.id)
        );
        naConta(() => deletePlaceVisit(atual.id), refreshActivity);
      } else {
        const temporaria: PlaceVisitRecord = {
          id: `pendente-${localId}-${Date.now()}`,
          placeId: localId,
          visitedAt: new Date().toISOString(),
          source: 'check-in',
        };
        queryClient.setQueryData<PlaceVisitRecord[]>(chave, (lista) => [temporaria, ...(lista ?? [])]);
        naConta((id) => recordPlaceVisit(id, localId, 'check-in'), refreshActivity);
      }
      return;
    }

    mudarAtividade((anterior) => ({
      ...anterior,
      visitas: atual
        ? anterior.visitas.filter((visita) => visita.id !== atual.id)
        : [
            {
              id: `check-in-${localId}-${Date.now()}`,
              localId,
              data: agoraDaApp(),
              verificado: true,
              origem: 'check-in',
            },
            ...anterior.visitas,
          ],
    }));
  }

  function registarVisitaManual(localId: string) {
    if (atividade.visitas.some((visita) => visita.localId === localId)) return;

    if (fonte === 'conta') {
      const temporaria: PlaceVisitRecord = {
        id: `pendente-manual-${localId}`,
        placeId: localId,
        visitedAt: new Date().toISOString(),
        source: 'manual',
      };
      queryClient.setQueryData<PlaceVisitRecord[]>(myPlaceVisitsKey(userId), (lista) => [
        temporaria,
        ...(lista ?? []),
      ]);
      naConta((id) => recordPlaceVisit(id, localId, 'manual'), refreshActivity);
      return;
    }

    mudarAtividade((anterior) => ({
      ...anterior,
      visitas: [
        { id: `manual-${localId}`, localId, data: agoraDaApp(), verificado: false, origem: 'manual' },
        ...anterior.visitas,
      ],
    }));
  }

  function guardarAvaliacao(nova: NovaAvaliacao) {
    const agoraIso = new Date().toISOString();

    if (fonte === 'conta') {
      const registo: ReviewRecord = {
        fixtureId: nova.jogoId,
        stadium: nova.estadio,
        atmosphere: nova.ambiente,
        access: nova.acessos,
        comment: nova.comentario,
        createdAt: agoraIso,
        updatedAt: agoraIso,
      };
      queryClient.setQueryData<ReviewRecord[]>(myReviewsKey(userId), (lista) => [
        registo,
        ...(lista ?? []).filter((review) => review.fixtureId !== nova.jogoId),
      ]);
      naConta((id) => recordReview(id, registo), refreshActivity);
      return;
    }

    const registo: AvaliacaoVisita = { ...nova, id: `avaliacao-${nova.jogoId}`, atualizadaEm: agoraIso };
    mudarAtividade((anterior) => ({
      ...anterior,
      avaliacoes: [registo, ...anterior.avaliacoes.filter((avaliacao) => avaliacao.id !== registo.id)],
    }));
  }

  function darNotaTasco(localId: string, nota: Nota) {
    if (fonte === 'conta') {
      queryClient.setQueryData<Record<string, number>>(myPlaceRatingsKey(userId), (atuais) => ({
        ...atuais,
        [localId]: nota,
      }));
      naConta((id) => savePlaceRating(id, localId, nota), refreshActivity);
      return;
    }
    mudarAtividade((anterior) => ({ ...anterior, notasTascos: { ...anterior.notasTascos, [localId]: nota } }));
  }

  function adicionarFoto({ mimeType, ...foto }: NovaFoto) {
    const registo: FotoMissao = { ...foto, id: `foto-${foto.missaoId}-${Date.now()}` };

    if (fonte === 'conta') {
      setFotosPendentes((atuais) => [registo, ...atuais.filter((atual) => atual.missaoId !== foto.missaoId)]);
      // Sample photos (devices without a camera) never go to the account.
      const uri = foto.uri;
      if (!uri || foto.exemplo) return;
      naConta(
        (id) =>
          saveMissionPhoto(id, {
            missionId: foto.missaoId,
            uri,
            mimeType: mimeType ?? 'image/jpeg',
            fixtureId: foto.jogoId,
            venueId: foto.estadioId,
          }),
        async () => {
          await refreshPhotos();
          setFotosPendentes((atuais) => atuais.filter((atual) => atual.id !== registo.id));
        }
      );
      return;
    }

    mudarAtividade((anterior) => ({
      ...anterior,
      fotos: [registo, ...anterior.fotos.filter((atual) => atual.missaoId !== foto.missaoId)],
    }));
  }

  function apagarFoto(fotoId: string) {
    const foto = atividade.fotos.find((atual) => atual.id === fotoId);
    if (!foto) return;

    if (fonte === 'conta') {
      setFotosPendentes((atuais) => atuais.filter((atual) => atual.id !== fotoId));
      queryClient.setQueryData<MissionPhoto[]>(myMissionPhotosKey(userId), (lista) =>
        lista?.filter((photo) => photo.missionId !== foto.missaoId)
      );
      naConta((id) => deleteMissionPhoto(id, foto.missaoId), refreshPhotos);
      return;
    }

    mudarAtividade((anterior) => ({ ...anterior, fotos: anterior.fotos.filter((atual) => atual.id !== fotoId) }));
  }

  async function registarMedicao(medicao: Omit<MedicaoBarulho, 'id'>): Promise<ResultadoMedicao> {
    if (fonte === 'conta') {
      try {
        await recordNoiseMeasurement(medicao.jogoId, medicao.nivel);
        await refreshActivity();
        return 'registada';
      } catch (erro: unknown) {
        if (erro instanceof NoiseMeasurementRefused) {
          return erro.reason === 'too-soon' ? 'cedo-demais' : 'fora-do-jogo';
        }
        if (__DEV__) console.warn('Não foi possível guardar a medição:', erro);
        return 'erro';
      }
    }

    const registo: MedicaoBarulho = { ...medicao, id: `medicao-${medicao.jogoId}-${Date.now()}` };
    mudarAtividade((anterior) => ({ ...anterior, medicoes: [registo, ...anterior.medicoes] }));
    return 'registada';
  }

  const preferenciasDaConta: NotificationPreferences = notificationPreferences.data ?? {};
  const notificacoes = porTipo((tipo) =>
    fonte === 'conta'
      ? (preferenciasDaConta[TIPO_NA_CONTA[tipo]] ?? preferenciasIniciais[tipo])
      : (preferencias.notificacoes[tipo] ?? preferenciasIniciais[tipo])
  );

  function alternarNotificacao(tipo: TipoNotificacao) {
    const ligar = !notificacoes[tipo];
    if (fonte === 'conta') {
      queryClient.setQueryData<NotificationPreferences>(notificationPreferencesKey(userId), (atuais) => ({
        ...atuais,
        [TIPO_NA_CONTA[tipo]]: ligar,
      }));
      naConta((id) => saveNotificationPreference(id, TIPO_NA_CONTA[tipo], ligar), refreshNotifications);
      return;
    }
    mudarPreferencias((atuais) => ({ ...atuais, notificacoes: { ...atuais.notificacoes, [tipo]: ligar } }));
  }

  function concluirOnboarding(escolhas: Permissoes) {
    const ligar = escolhas.notificacoes === 'aceite';
    mudarPreferencias((atuais) => ({
      ...atuais,
      permissoes: escolhas,
      notificacoes: porTipo(() => ligar),
      introducaoVista: true,
      onboardingConcluido: true,
    }));
  }

  function alternarModoDemo() {
    const ligar = !modoDemo;
    setDemoFixturesActive(ligar);
    setDemoPlacesActive(ligar);
    if (ligar) {
      setDemo(atividadeDemo());
    } else {
      usarHoraReal();
    }
    mudarPreferencias((atuais) => ({ ...atuais, modoDemo: ligar }));
  }

  function marcarContaPerguntada(id: string) {
    mudarPreferencias((atuais) =>
      atuais.contasPerguntadas.includes(id)
        ? atuais
        : { ...atuais, contasPerguntadas: [...atuais.contasPerguntadas, id] }
    );
  }

  const atividadeParaJuntar =
    carregado &&
    fonte === 'conta' &&
    userId !== null &&
    temAtividade(atividadeLocal) &&
    !preferencias.contasPerguntadas.includes(userId)
      ? atividadeLocal
      : null;

  async function juntarAtividadeAConta(): Promise<ResultadoJuntar> {
    const id = currentUserId();
    const local = atividadeLocal;
    if (!id) return { juntados: 0, falhados: 0, medicoesQueFicam: local.medicoes.length };
    marcarContaPerguntada(id);

    const tarefas: (() => Promise<unknown>)[] = [
      ...local.avaliacoes.map((avaliacao) => () =>
        recordReview(id, {
          fixtureId: avaliacao.jogoId,
          stadium: avaliacao.estadio,
          atmosphere: avaliacao.ambiente,
          access: avaliacao.acessos,
          comment: avaliacao.comentario,
        })
      ),
      ...local.visitas.map((visita) => () => recordPlaceVisit(id, visita.localId, visita.origem, visita.data)),
      ...Object.entries(local.notasTascos).map(([localId, nota]) => () => savePlaceRating(id, localId, nota)),
      // After the overall scores: beer and food scores only update an existing rating.
      ...Object.entries(local.notasCervejaPetisco).map(([localId, notas]) => () =>
        savePlaceSubScores(id, localId, { beerScore: notas.cerveja, foodScore: notas.petisco })
      ),
      ...local.fotos.flatMap((foto) => {
        const uri = foto.uri;
        return uri && !foto.exemplo
          ? [
              () =>
                saveMissionPhoto(id, {
                  missionId: foto.missaoId,
                  uri,
                  mimeType: 'image/jpeg',
                  fixtureId: foto.jogoId,
                  venueId: foto.estadioId,
                }),
            ]
          : [];
      }),
    ];

    let falhados = 0;
    for (const tarefa of tarefas) {
      try {
        await tarefa();
      } catch {
        falhados += 1;
      }
    }

    // Nothing is lost: if part of it failed, the phone keeps its copy.
    if (falhados === 0) setAtividadeLocal(ATIVIDADE_VAZIA);
    await Promise.all([refreshActivity(), refreshPhotos()]);
    return { juntados: tarefas.length - falhados, falhados, medicoesQueFicam: local.medicoes.length };
  }

  const recomendadosNaConta: ReadonlySet<string> = new Set(dishRecommendations.data ?? []);
  const recomendadosAgora: ReadonlySet<string> =
    fonte === 'conta'
      ? new Set(
          [...recomendadosNaConta, ...recomendacoesTocadas.keys()].filter(
            (pratoId) => recomendacoesTocadas.get(pratoId) ?? recomendadosNaConta.has(pratoId)
          )
        )
      : pratosRecomendados;

  function alternarRecomendacao(pratoId: string) {
    if (fonte !== 'conta') {
      setPratosRecomendados((atuais) => alternarEmConjunto(atuais, pratoId));
      return;
    }
    const id = currentUserId();
    if (!id) return;
    const recomendar = !recomendadosAgora.has(pratoId);
    setRecomendacoesTocadas((atuais) => new Map(atuais).set(pratoId, recomendar));
    void (recomendar ? recommendDish(id, pratoId) : unrecommendDish(id, pratoId))
      .catch((erro: unknown) => {
        avisarQueNaoGuardou(erro);
        setRecomendacoesTocadas((atuais) => {
          const proximas = new Map(atuais);
          proximas.delete(pratoId);
          return proximas;
        });
      })
      .finally(() => void queryClient.invalidateQueries({ queryKey: myDishRecommendationsKey(userId) }));
  }

  function notaOuNada(valor: number | null): Nota | null {
    return valor !== null && eNota(valor) ? valor : null;
  }

  const notasCervejaPetisco: Readonly<Partial<Record<string, NotasCervejaPetisco>>> =
    fonte === 'conta'
      ? Object.fromEntries(
          Object.entries(placeSubScores.data ?? {}).map(([localId, notas]) => [
            localId,
            { cerveja: notaOuNada(notas.beerScore), petisco: notaOuNada(notas.foodScore) },
          ])
        )
      : atividade.notasCervejaPetisco;

  function darNotaCervejaPetisco(localId: string, notas: Partial<NotasCervejaPetisco>) {
    const atuais = notasCervejaPetisco[localId] ?? { cerveja: null, petisco: null };
    const proximas: NotasCervejaPetisco = { ...atuais, ...notas };

    if (fonte === 'conta') {
      const paraConta: PlaceSubScores = { beerScore: proximas.cerveja, foodScore: proximas.petisco };
      queryClient.setQueryData<Record<string, PlaceSubScores>>(myPlaceSubScoresKey(userId), (lista) => ({
        ...lista,
        [localId]: paraConta,
      }));
      naConta((id) => savePlaceSubScores(id, localId, paraConta), refreshActivity);
      return;
    }
    mudarAtividade((anterior) => ({
      ...anterior,
      notasCervejaPetisco: { ...anterior.notasCervejaPetisco, [localId]: proximas },
    }));
  }

  const votosTascos: Readonly<Partial<Record<string, boolean>>> =
    fonte === 'conta' ? (placeVotes.data ?? {}) : fonte === 'demo' ? votosDemo : {};

  function votarTasco(localId: string, bom: boolean) {
    if (fonte === 'demo') {
      setVotosDemo((atuais) => ({ ...atuais, [localId]: bom }));
      return;
    }
    if (fonte !== 'conta') return;
    queryClient.setQueryData<Record<string, boolean>>(myPlaceVotesKey(userId), (atuais) => ({
      ...atuais,
      [localId]: bom,
    }));
    naConta((id) => votePlace(id, localId, bom), refreshActivity);
  }

  const visitadosNaConta =
    fonte === 'conta'
      ? Object.entries(attendance.data ?? {}).flatMap(([fixtureId, status]) => {
          const jogo = status === 'attended' ? obterJogo(fixtureId) : undefined;
          return jogo ? [jogo.estadioId] : [];
        })
      : [];

  const value: AppState = {
    fonte,
    modoDemo,
    alternarModoDemo,
    onboardingConcluido: preferencias.onboardingConcluido,
    introducaoVista: preferencias.introducaoVista,
    permissoes: preferencias.permissoes,
    concluirOnboarding,
    guardarPermissoes: (permissoes) => mudarPreferencias((atuais) => ({ ...atuais, permissoes })),
    saltarOnboarding: () => mudarPreferencias((atuais) => ({ ...atuais, onboardingConcluido: true })),
    reverIntroducao: () => mudarPreferencias((atuais) => ({ ...atuais, onboardingConcluido: false })),
    clubeFavoritoId: preferencias.clubeFavoritoId ?? CLUBE_POR_OMISSAO,
    escolherClube: (clubeId) => mudarPreferencias((atuais) => ({ ...atuais, clubeFavoritoId: clubeId })),
    clubeDaTerraId: preferencias.clubeDaTerraId,
    confirmarClubeDaTerra: (clubeId) =>
      mudarPreferencias((atuais) => ({ ...atuais, clubeDaTerraId: clubeId })),
    estadiosVisitados: [
      ...new Set([
        ...(fonte === 'demo' ? ESTADIOS_VISITADOS_DEMO : []),
        ...visitadosNaConta,
        ...atividade.avaliacoes.map((avaliacao) => avaliacao.estadioId),
      ]),
    ],
    fezCheckIn: (localId) => checkInsHoje.some((visita) => visita.localId === localId),
    alternarCheckIn,
    pessoasAqui: (local) =>
      local.pessoasAqui === null
        ? null
        : local.pessoasAqui + (checkInsHoje.some((visita) => visita.localId === local.id) ? 1 : 0),
    visitasLocais: atividade.visitas,
    visitaDoLocal: (localId) =>
      atividade.visitas.find((visita) => visita.localId === localId && visita.verificado) ??
      atividade.visitas.find((visita) => visita.localId === localId),
    registarVisitaManual,
    avaliacoes: atividade.avaliacoes,
    avaliacaoDoJogo: (jogoId) => atividade.avaliacoes.find((avaliacao) => avaliacao.jogoId === jogoId),
    guardarAvaliacao,
    pratosRecomendados: recomendadosAgora,
    recomendacoesJaContadas: fonte === 'conta' ? recomendadosNaConta : new Set<string>(),
    alternarRecomendacao,
    notasCervejaPetisco,
    darNotaCervejaPetisco,
    votosTascos,
    votarTasco,
    notasTascos: atividade.notasTascos,
    darNotaTasco,
    fotosMissoes: atividade.fotos,
    adicionarFoto,
    apagarFoto,
    medicoesBarulho: atividade.medicoes,
    registarMedicao,
    sonsLigados: preferencias.sonsLigados,
    alternarSons: () => mudarPreferencias((atuais) => ({ ...atuais, sonsLigados: !atuais.sonsLigados })),
    notificacoes,
    alternarNotificacao,
    atividadeParaJuntar,
    juntarAtividadeAConta,
    naoJuntarAtividade: () => {
      if (userId) marcarContaPerguntada(userId);
    },
  };

  // Wait for what is saved on the phone, so the introduction does not flash for someone who finished it.
  if (!carregado) return null;

  return <AppStateContext value={value}>{children}</AppStateContext>;
}

export function useAppState() {
  const context = use(AppStateContext);
  if (!context) {
    throw new Error('useAppState tem de ser usado dentro de <AppStateProvider>');
  }
  return context;
}
