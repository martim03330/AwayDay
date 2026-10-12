/**
 * App state. Where the data comes from depends on the mode:
 * - demo mode: sample data and simulated time, in memory only; nothing goes to the account or stays on the phone;
 * - without an account: the user's activity is kept on this phone;
 * - with an account: the activity comes from the account and every change is written there.
 * Device preferences (introduction, permissions, sounds, demo mode) always stay on the phone.
 */

import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Alert, Linking } from 'react-native';

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
  answerPlaceToilet,
  type PlaceSubScores,
} from '@/features/activity/api';
import { useMyAttendance } from '@/features/activity/hooks/useAttendance';
import { reportErrorOnce } from '@/features/feedback/report';
import {
  myDishRecommendationsKey,
  myPlaceRatingsKey,
  myPlaceSubScoresKey,
  myPlaceVotesKey,
  myToiletAnswersKey,
  myPlaceVisitsKey,
  myReviewsKey,
  useMyDishRecommendations,
  useMyNoiseMeasurements,
  useMyPlaceSubScores,
  useMyPlaceVotes,
  useMyToiletAnswers,
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
import { checkInAtPlace, checkOutOfPlace } from '@/features/presence/api';
import { usePlacePulse, useRefreshPresence } from '@/features/presence/hooks/usePresence';
import { getCurrentPosition } from '@/features/presence/location';
import {
  CHECK_IN_MAX_ACCURACY_M,
  CHECK_IN_MAX_DISTANCE_M,
  CheckInRefused,
  type DevicePosition,
} from '@/features/presence/types';
import type { NotificationKind, NotificationPreferences } from '@/features/profile/types';
import { useNow } from '@/hooks/use-now';
import { distanciaEmLinhaRetaKm } from '@/lib/distancia';
import { formatarDistancia } from '@/lib/formatos';
import { checkInsAtivos } from '@/lib/presenca';
import { askForPushOnSignIn, enablePushOnThisDevice } from '@/lib/push';
import { currentUserId, useUserId } from '@/lib/session';
import { fotosIniciais } from '@/mocks/album';
import { avaliacoesIniciais } from '@/mocks/avaliacoes';
import { jogos, obterJogo } from '@/mocks/jogos';
import { obterLocal } from '@/mocks/locais';
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

export type ResultadoMedicao =
  'registada' | 'cedo-demais' | 'fora-do-jogo' | 'sem-presenca' | 'erro';

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
  /** Já viu a apresentação dos separadores (aparece uma vez, a seguir à introdução). */
  apresentacaoVista: boolean;
  marcarApresentacaoVista: () => void;
  /** Volta a mostrar a apresentação (Definições). */
  reverApresentacao: () => void;
  permissoes: Permissoes;
  concluirOnboarding: (permissoes: Permissoes) => void;
  /** Guarda as permissões sem acabar a introdução: ainda falta o passo da conta. */
  guardarPermissoes: (permissoes: Permissoes) => void;
  /** Só para o deep link de demo: entra nas tabs sem mexer nas escolhas. */
  saltarOnboarding: () => void;
  reverIntroducao: () => void;
  /** `null` enquanto a pessoa não escolher um clube: nunca há clube por omissão. */
  clubeFavoritoId: string | null;
  escolherClube: (clubeId: string) => void;
  /** Só muda quando o utilizador confirma; a sugestão nunca é aplicada sozinha. */
  clubeDaTerraId: string | null;
  confirmarClubeDaTerra: (clubeId: string) => void;
  estadiosVisitados: readonly string[];
  fezCheckIn: (localId: string) => boolean;
  /** O sítio onde estás agora, se fizeste check-in nalgum. É o que acerta as horas da ida para o estádio. */
  localDoCheckIn: string | null;
  /**
   * Checks in or undoes it; resolves `true` when it went through. Outside demo mode it reads the location once to
   * confirm you are at the tasco (with an account the server confirms it, and you count for the crowd).
   */
  alternarCheckIn: (localId: string) => Promise<boolean>;
  /** A paleta que o utilizador escolheu: 'sistema', 'claro' ou 'escuro'. */
  tema: 'sistema' | 'claro' | 'escuro';
  escolherTema: (tema: 'sistema' | 'claro' | 'escuro') => void;
  /** The tasco whose check-in is being confirmed right now, if any. */
  checkInEmCurso: string | null;
  /** `null` while nobody is counted here (live counts only show from 5 people). */
  pessoasAqui: (local: Local) => number | null;
  /** Clubs with fans at this tasco right now (outside demo mode, only clubs with at least 5 people). */
  clubesAqui: (local: Local) => readonly string[];
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
  /** Your answer to "does this tasco have a toilet for customers?". Needs an account (demo: memory). */
  wcTascos: Readonly<Partial<Record<string, boolean>>>;
  responderWcTasco: (localId: string, temWc: boolean) => void;
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
  if (!jogo || !eNota(review.stadium) || !eNota(review.atmosphere) || !eNota(review.access))
    return null;
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
  const [recomendacoesTocadas, setRecomendacoesTocadas] = useState<ReadonlyMap<string, boolean>>(
    new Map()
  );
  const [votosDemo, setVotosDemo] = useState<Readonly<Partial<Record<string, boolean>>>>({});
  const [wcDemo, setWcDemo] = useState<Readonly<Partial<Record<string, boolean>>>>({});
  /** Photos taken with an account that are still uploading (or samples, which never upload). */
  const [fotosPendentes, setFotosPendentes] = useState<readonly FotoMissao[]>([]);
  const [checkInEmCurso, setCheckInEmCurso] = useState<string | null>(null);

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
  const toiletAnswers = useMyToiletAnswers(userId);
  const notificationPreferences = useNotificationPreferences(userId);
  const refreshActivity = useRefreshMyActivity(userId);
  const refreshPhotos = useRefreshMissionPhotos(userId);
  const refreshNotifications = useRefreshNotificationPreferences(userId);
  // Live counts are public aggregates: also read without an account, never in demo mode.
  const pulse = usePlacePulse(!modoDemo);
  const refreshPresence = useRefreshPresence(userId);

  const daConta: AtividadeLocal = {
    avaliacoes: (reviews.data ?? []).flatMap((review) => {
      const convertida = avaliacaoDaConta(review);
      return convertida ? [convertida] : [];
    }),
    visitas: (placeVisits.data ?? []).map(visitaDaConta),
    notasTascos: Object.fromEntries(
      Object.entries(ratings.data ?? {}).filter((entrada): entrada is [string, Nota] =>
        eNota(entrada[1])
      )
    ),
    fotos: [
      ...fotosPendentes,
      ...(photos.data ?? [])
        .filter(
          (photo) => !fotosPendentes.some((pendente) => pendente.missaoId === photo.missionId)
        )
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
  // Check-ins still on: they end after 3 hours or when a game starts at the tasco's stadium.
  const checkInsAgora = checkInsAtivos(agora, atividade.visitas, obterLocal, jogos);
  const pulsoPorLocal = new Map((pulse.data ?? []).map((linha) => [linha.placeId, linha]));

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

  /** Reads the position once, explaining what to do when it cannot. */
  async function posicaoParaCheckIn(): Promise<DevicePosition | null> {
    const resultado = await getCurrentPosition();
    if (resultado.status === 'ok') return resultado.position;
    if (resultado.status === 'denied') {
      Alert.alert(
        'Precisamos da localização',
        'O check-in só conta quando estás mesmo no tasco. A localização serve só para confirmar isso e não fica guardada.',
        resultado.canAskAgain
          ? [{ text: 'Percebi' }]
          : [
              { text: 'Agora não', style: 'cancel' },
              { text: 'Abrir definições', onPress: () => void Linking.openSettings() },
            ]
      );
    } else {
      Alert.alert(
        'Não conseguimos saber onde estás',
        'Liga a localização do telemóvel e tenta outra vez.'
      );
    }
    return null;
  }

  function avisarCheckInRecusado(recusa: CheckInRefused) {
    if (recusa.reason === 'too-far') {
      Alert.alert(
        'Ainda não estás no tasco',
        recusa.distanceM === null
          ? `O check-in só conta a menos de ${CHECK_IN_MAX_DISTANCE_M} m do tasco.`
          : `Estás a cerca de ${formatarDistancia(recusa.distanceM)}. O check-in só conta a menos de ${CHECK_IN_MAX_DISTANCE_M} m do tasco.`
      );
    } else if (recusa.reason === 'low-accuracy') {
      Alert.alert(
        'A localização está pouco precisa',
        'Espera uns segundos, de preferência cá fora, e tenta outra vez.'
      );
    } else if (recusa.reason === 'rate-limited') {
      Alert.alert('Muitos check-ins seguidos', 'Espera um bocadinho e tenta outra vez.');
    } else {
      Alert.alert('Tasco não encontrado', 'Este tasco já não está na lista.');
    }
  }

  /** Demo, and undoing a check-in kept on the phone. */
  function alternarCheckInLocal(localId: string, atual: VisitaLocal | undefined) {
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

  /** With an account the server checks the distance, creates the verified visit and counts you for the crowd. */
  async function alternarCheckInNaConta(localId: string, atual: VisitaLocal | undefined) {
    const chave = myPlaceVisitsKey(userId);
    try {
      if (atual) {
        // After 3 hours presence has already ended: then only the visit is left to remove.
        const terminou = await checkOutOfPlace(localId);
        if (!terminou) await deletePlaceVisit(atual.id);
        queryClient.setQueryData<PlaceVisitRecord[]>(chave, (lista) =>
          lista?.filter((visita) => visita.id !== atual.id)
        );
        return true;
      }
      const posicao = await posicaoParaCheckIn();
      if (!posicao) return false;
      const registo = await checkInAtPlace(localId, posicao);
      queryClient.setQueryData<PlaceVisitRecord[]>(chave, (lista) => [
        { id: registo.visitId, placeId: localId, visitedAt: registo.visitedAt, source: 'check-in' },
        ...(lista ?? []).filter((visita) => visita.id !== registo.visitId),
      ]);
      return true;
    } catch (erro: unknown) {
      if (erro instanceof CheckInRefused) avisarCheckInRecusado(erro);
      else avisarQueNaoGuardou(erro);
      return false;
    } finally {
      void refreshActivity();
      void refreshPresence();
    }
  }

  /** Without an account the phone checks the distance itself: the visit counts for you, not for the crowd. */
  async function alternarCheckInNoTelemovel(localId: string, atual: VisitaLocal | undefined) {
    const local = obterLocal(localId);
    if (atual || !local) {
      if (atual) alternarCheckInLocal(localId, atual);
      return Boolean(atual);
    }
    const posicao = await posicaoParaCheckIn();
    if (!posicao) return false;
    if (posicao.accuracy === null || posicao.accuracy > CHECK_IN_MAX_ACCURACY_M) {
      avisarCheckInRecusado(new CheckInRefused('low-accuracy'));
      return false;
    }
    const metros = distanciaEmLinhaRetaKm(posicao, local.coordenadas) * 1000;
    if (metros > CHECK_IN_MAX_DISTANCE_M) {
      avisarCheckInRecusado(new CheckInRefused('too-far', Math.round(metros / 50) * 50));
      return false;
    }
    alternarCheckInLocal(localId, undefined);
    return true;
  }

  async function alternarCheckIn(localId: string): Promise<boolean> {
    if (checkInEmCurso) return false;
    const atual = checkInsAgora.find((visita) => visita.localId === localId);

    if (fonte === 'demo') {
      alternarCheckInLocal(localId, atual);
      return true;
    }

    setCheckInEmCurso(localId);
    try {
      return fonte === 'conta'
        ? await alternarCheckInNaConta(localId, atual)
        : await alternarCheckInNoTelemovel(localId, atual);
    } finally {
      setCheckInEmCurso(null);
    }
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
        {
          id: `manual-${localId}`,
          localId,
          data: agoraDaApp(),
          verificado: false,
          origem: 'manual',
        },
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

    const registo: AvaliacaoVisita = {
      ...nova,
      id: `avaliacao-${nova.jogoId}`,
      atualizadaEm: agoraIso,
    };
    mudarAtividade((anterior) => ({
      ...anterior,
      avaliacoes: [
        registo,
        ...anterior.avaliacoes.filter((avaliacao) => avaliacao.id !== registo.id),
      ],
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
    mudarAtividade((anterior) => ({
      ...anterior,
      notasTascos: { ...anterior.notasTascos, [localId]: nota },
    }));
  }

  function adicionarFoto({ mimeType, ...foto }: NovaFoto) {
    const registo: FotoMissao = { ...foto, id: `foto-${foto.missaoId}-${Date.now()}` };

    if (fonte === 'conta') {
      setFotosPendentes((atuais) => [
        registo,
        ...atuais.filter((atual) => atual.missaoId !== foto.missaoId),
      ]);
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

    mudarAtividade((anterior) => ({
      ...anterior,
      fotos: anterior.fotos.filter((atual) => atual.id !== fotoId),
    }));
  }

  async function registarMedicao(medicao: Omit<MedicaoBarulho, 'id'>): Promise<ResultadoMedicao> {
    if (fonte === 'conta') {
      try {
        await recordNoiseMeasurement(medicao.jogoId, medicao.nivel);
        await Promise.all([refreshActivity(), refreshPresence()]);
        return 'registada';
      } catch (erro: unknown) {
        if (erro instanceof NoiseMeasurementRefused) {
          if (erro.reason === 'too-soon') return 'cedo-demais';
          return erro.reason === 'needs-presence' ? 'sem-presenca' : 'fora-do-jogo';
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
      queryClient.setQueryData<NotificationPreferences>(
        notificationPreferencesKey(userId),
        (atuais) => ({
          ...atuais,
          [TIPO_NA_CONTA[tipo]]: ligar,
        })
      );
      naConta(
        (id) => saveNotificationPreference(id, TIPO_NA_CONTA[tipo], ligar),
        refreshNotifications
      );
      return;
    }
    mudarPreferencias((atuais) => ({
      ...atuais,
      notificacoes: { ...atuais.notificacoes, [tipo]: ligar },
    }));
  }

  function concluirOnboarding(escolhas: Permissoes) {
    const ligar = escolhas.notificacoes === 'aceite';
    if (ligar) {
      // «Ligar avisos» has to reach the phone: with an account, ask the OS now and register this phone; without
      // one, remember the choice and ask on the first sign-in (NotificacoesPush). In the background: the OS dialog
      // shows over the next screen and nothing waits for the network.
      if (sessaoUserId) {
        void enablePushOnThisDevice().catch((erro: unknown) =>
          reportErrorOnce('push-registo', 'Registo do telemóvel para notificações (introdução)', erro)
        );
      } else {
        void askForPushOnSignIn().catch(() => undefined);
      }
    }
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
      ...local.avaliacoes.map(
        (avaliacao) => () =>
          recordReview(id, {
            fixtureId: avaliacao.jogoId,
            stadium: avaliacao.estadio,
            atmosphere: avaliacao.ambiente,
            access: avaliacao.acessos,
            comment: avaliacao.comentario,
          })
      ),
      // Only the server verifies visits: the ones checked on the phone come in as "por verificar".
      ...local.visitas.map(
        (visita) => () => recordPlaceVisit(id, visita.localId, 'manual', visita.data)
      ),
      ...Object.entries(local.notasTascos).map(
        ([localId, nota]) =>
          () =>
            savePlaceRating(id, localId, nota)
      ),
      // After the overall scores: beer and food scores only update an existing rating.
      ...Object.entries(local.notasCervejaPetisco).map(
        ([localId, notas]) =>
          () =>
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
    return {
      juntados: tarefas.length - falhados,
      falhados,
      medicoesQueFicam: local.medicoes.length,
    };
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
      .finally(
        () => void queryClient.invalidateQueries({ queryKey: myDishRecommendationsKey(userId) })
      );
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
      const paraConta: PlaceSubScores = {
        beerScore: proximas.cerveja,
        foodScore: proximas.petisco,
      };
      queryClient.setQueryData<Record<string, PlaceSubScores>>(
        myPlaceSubScoresKey(userId),
        (lista) => ({
          ...lista,
          [localId]: paraConta,
        })
      );
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

  const wcTascos: Readonly<Partial<Record<string, boolean>>> =
    fonte === 'conta' ? (toiletAnswers.data ?? {}) : fonte === 'demo' ? wcDemo : {};

  function responderWcTasco(localId: string, temWc: boolean) {
    if (fonte === 'demo') {
      setWcDemo((atuais) => ({ ...atuais, [localId]: temWc }));
      return;
    }
    if (fonte !== 'conta') return;
    queryClient.setQueryData<Record<string, boolean>>(myToiletAnswersKey(userId), (atuais) => ({
      ...atuais,
      [localId]: temWc,
    }));
    naConta((id) => answerPlaceToilet(id, localId, temWc), refreshActivity);
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
    apresentacaoVista: preferencias.apresentacaoVista,
    marcarApresentacaoVista: () =>
      mudarPreferencias((atuais) => ({ ...atuais, apresentacaoVista: true })),
    reverApresentacao: () =>
      mudarPreferencias((atuais) => ({ ...atuais, apresentacaoVista: false })),
    permissoes: preferencias.permissoes,
    concluirOnboarding,
    guardarPermissoes: (permissoes) => mudarPreferencias((atuais) => ({ ...atuais, permissoes })),
    saltarOnboarding: () =>
      mudarPreferencias((atuais) => ({ ...atuais, onboardingConcluido: true })),
    reverIntroducao: () =>
      mudarPreferencias((atuais) => ({ ...atuais, onboardingConcluido: false })),
    clubeFavoritoId: preferencias.clubeFavoritoId,
    escolherClube: (clubeId) =>
      mudarPreferencias((atuais) => ({ ...atuais, clubeFavoritoId: clubeId })),
    clubeDaTerraId: preferencias.clubeDaTerraId,
    confirmarClubeDaTerra: (clubeId) =>
      mudarPreferencias((atuais) => ({ ...atuais, clubeDaTerraId: clubeId })),
    // Only stamped stadiums (the server marks a game as attended only with the stamp). A rating is not a visit;
    // in demo mode the sample ratings stand in for stamps.
    estadiosVisitados: [
      ...new Set([
        ...(fonte === 'demo' ? ESTADIOS_VISITADOS_DEMO : []),
        ...visitadosNaConta,
        ...(fonte === 'demo' ? atividade.avaliacoes.map((avaliacao) => avaliacao.estadioId) : []),
      ]),
    ],
    fezCheckIn: (localId) => checkInsAgora.some((visita) => visita.localId === localId),
    localDoCheckIn: checkInsAgora[0]?.localId ?? null,
    tema: preferencias.tema,
    escolherTema: (tema) => mudarPreferencias((atuais) => ({ ...atuais, tema })),
    alternarCheckIn,
    checkInEmCurso,
    pessoasAqui: (local) => {
      if (fonte !== 'demo') return pulsoPorLocal.get(local.id)?.people ?? null;
      return local.pessoasAqui === null
        ? null
        : local.pessoasAqui + (checkInsAgora.some((visita) => visita.localId === local.id) ? 1 : 0);
    },
    clubesAqui: (local) =>
      fonte === 'demo'
        ? local.clubesAqui
        : (pulsoPorLocal.get(local.id)?.clubs.map((clube) => clube.clubId) ?? []),
    visitasLocais: atividade.visitas,
    visitaDoLocal: (localId) =>
      atividade.visitas.find((visita) => visita.localId === localId && visita.verificado) ??
      atividade.visitas.find((visita) => visita.localId === localId),
    registarVisitaManual,
    avaliacoes: atividade.avaliacoes,
    avaliacaoDoJogo: (jogoId) =>
      atividade.avaliacoes.find((avaliacao) => avaliacao.jogoId === jogoId),
    guardarAvaliacao,
    pratosRecomendados: recomendadosAgora,
    recomendacoesJaContadas: fonte === 'conta' ? recomendadosNaConta : new Set<string>(),
    alternarRecomendacao,
    notasCervejaPetisco,
    darNotaCervejaPetisco,
    votosTascos,
    votarTasco,
    wcTascos,
    responderWcTasco,
    notasTascos: atividade.notasTascos,
    darNotaTasco,
    fotosMissoes: atividade.fotos,
    adicionarFoto,
    apagarFoto,
    medicoesBarulho: atividade.medicoes,
    registarMedicao,
    sonsLigados: preferencias.sonsLigados,
    alternarSons: () =>
      mudarPreferencias((atuais) => ({ ...atuais, sonsLigados: !atuais.sonsLigados })),
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
