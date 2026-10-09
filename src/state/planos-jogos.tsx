/**
 * "O meu jogo": the games the fan is going to, the tasco picked for each and the reminders the phone schedules.
 * - With an account: the attendance rows on the account (status "going" and place_id).
 * - Without an account: kept on this phone. In demo mode: in memory only, and no reminders (the clock is simulated).
 * Reminders are local notifications (no server, work in Expo Go); each game's can be turned off on this phone.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { setGoing, setPlanPlace } from '@/features/activity/api';
import { myPlansKey, useMyPlans } from '@/features/activity/hooks/useMyPlans';
import { reportErrorOnce } from '@/features/feedback/report';
import { avisosDoJogo } from '@/lib/avisos-jogo';
import { registerThisDevice } from '@/lib/push';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { obterLocal } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';

const CHAVE_PLANOS = 'awayday-planos-jogos-v1';
const CHAVE_AVISOS_DESLIGADOS = 'awayday-avisos-jogos-desligados-v1';
/** Identifiers of the local notifications scheduled here, so they can be replaced without touching others. */
const PREFIXO_AVISO = 'jogo:';

type Planos = Readonly<Record<string, { localId: string | null }>>;

type PlanosJogos = {
  vou: (jogoId: string) => boolean;
  /** Games the fan is going to (any order). */
  jogosAQueVou: readonly string[];
  /** Marks or unmarks "Vou"; resolves with the new value (unchanged if it failed). */
  alternarVou: (jogoId: string) => Promise<boolean>;
  /**
   * Marca «vou» se ainda não estiver marcado. Quem oferece boleia, pede lugar ou entra numa casa já disse, por
   * atos, que vai — o bilhete do jogo abre-se sozinho em vez de ser mais um botão a carregar.
   */
  garantirVou: (jogoId: string) => Promise<void>;
  tascoDoPlano: (jogoId: string) => string | null;
  escolherTasco: (jogoId: string, localId: string | null) => void;
  avisosLigados: (jogoId: string) => boolean;
  alternarAvisos: (jogoId: string) => void;
};

const PlanosJogosContext = createContext<PlanosJogos | null>(null);

function lerPlanos(valor: unknown): Planos {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return {};
  return Object.fromEntries(
    Object.entries(valor).flatMap(([jogoId, plano]) => {
      const localId =
        typeof plano === 'object' && plano !== null ? Reflect.get(plano, 'localId') : null;
      return [[jogoId, { localId: typeof localId === 'string' ? localId : null }]];
    })
  );
}

async function lerJson(chave: string): Promise<unknown> {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    return bruto === null ? null : (JSON.parse(bruto) as unknown);
  } catch {
    return null;
  }
}

function guardarJson(chave: string, valor: unknown) {
  void AsyncStorage.setItem(chave, JSON.stringify(valor)).catch(() => undefined);
}

/** Replaces this app's game reminders with `avisos`. Does nothing without notification permission. */
async function reagendar(avisos: ReturnType<typeof avisosDoJogo>) {
  const permissao = await Notifications.getPermissionsAsync();
  const agendados = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    agendados
      .filter((pedido) => pedido.identifier.startsWith(PREFIXO_AVISO))
      .map((pedido) => Notifications.cancelScheduledNotificationAsync(pedido.identifier))
  );
  if (!permissao.granted) return;
  for (const aviso of avisos) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIXO_AVISO}${aviso.id}`,
      content: {
        title: aviso.titulo,
        body: aviso.corpo,
        data: { type: 'o-meu-jogo', jogoId: aviso.id.split(':')[0] },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: aviso.quando },
    });
  }
}

export function PlanosJogosProvider({ children }: { children: ReactNode }) {
  const { fonte } = useAppState();
  const queryClient = useQueryClient();
  const sessao = useUserId();
  const userId = fonte === 'conta' ? sessao : null;
  const planosDaConta = useMyPlans(userId);

  const [planosLocais, setPlanosLocais] = useState<Planos>({});
  const [planosDemo, setPlanosDemo] = useState<Planos>({});
  const [desligados, setDesligados] = useState<readonly string[]>([]);
  const [carregado, setCarregado] = useState(false);
  /** Flips when the OS permission is given here, so the reminders scheduled without it are scheduled again. */
  const [permissaoDada, setPermissaoDada] = useState(false);

  useEffect(() => {
    let ativo = true;
    void Promise.all([lerJson(CHAVE_PLANOS), lerJson(CHAVE_AVISOS_DESLIGADOS)]).then(
      ([planos, lista]) => {
        if (!ativo) return;
        setPlanosLocais(lerPlanos(planos));
        setDesligados(
          Array.isArray(lista) ? lista.filter((id): id is string => typeof id === 'string') : []
        );
        setCarregado(true);
      }
    );
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (carregado) guardarJson(CHAVE_PLANOS, planosLocais);
  }, [carregado, planosLocais]);

  useEffect(() => {
    if (carregado) guardarJson(CHAVE_AVISOS_DESLIGADOS, desligados);
  }, [carregado, desligados]);

  const planos: Planos =
    fonte === 'conta'
      ? Object.fromEntries(
          Object.entries(planosDaConta.data ?? {}).map(([jogoId, localId]) => [jogoId, { localId }])
        )
      : fonte === 'demo'
        ? planosDemo
        : planosLocais;
  const jogosAQueVou = Object.keys(planos);

  function mudarLocal(mudar: (atuais: Planos) => Planos) {
    if (fonte === 'demo') setPlanosDemo(mudar);
    else setPlanosLocais(mudar);
  }

  async function alternarVou(jogoId: string) {
    const ir = !(jogoId in planos);
    if (fonte === 'conta') {
      if (!userId) return !ir;
      try {
        await setGoing(userId, jogoId, ir);
      } catch {
        Alert.alert('Não deu para guardar', 'Tenta outra vez daqui a nada.');
        return !ir;
      } finally {
        void queryClient.invalidateQueries({ queryKey: ['attendance', userId] });
      }
    } else {
      mudarLocal((atuais) => {
        const proximos = { ...atuais };
        if (ir) proximos[jogoId] = { localId: null };
        else delete proximos[jogoId];
        return proximos;
      });
    }
    // The reminders need permission; asked the first time someone marks a game. Once given, the reminders are
    // scheduled again (the first attempt ran without permission) and, with an account, this phone is registered for
    // pushes right away instead of on the next cold start.
    if (ir && fonte !== 'demo') {
      void Notifications.getPermissionsAsync()
        .then(async (antes) => {
          if (antes.granted) return;
          const depois = await Notifications.requestPermissionsAsync();
          if (!depois.granted) return;
          setPermissaoDada(true);
          if (sessao) {
            await registerThisDevice().catch((erro: unknown) =>
              reportErrorOnce('push-registo', 'Registo do telemóvel para notificações (vou)', erro)
            );
          }
        })
        .catch(() => undefined);
    }
    return ir;
  }

  function escolherTasco(jogoId: string, localId: string | null) {
    if (fonte === 'conta') {
      if (!userId) return;
      queryClient.setQueryData<Record<string, string | null>>(myPlansKey(userId), (atuais) => ({
        ...atuais,
        [jogoId]: localId,
      }));
      void setPlanPlace(userId, jogoId, localId)
        .catch(() => Alert.alert('Não deu para guardar', 'Verifica a ligação e tenta outra vez.'))
        .finally(() => void queryClient.invalidateQueries({ queryKey: myPlansKey(userId) }));
      return;
    }
    mudarLocal((atuais) => (jogoId in atuais ? { ...atuais, [jogoId]: { localId } } : atuais));
  }

  function alternarAvisos(jogoId: string) {
    setDesligados((atuais) =>
      atuais.includes(jogoId) ? atuais.filter((id) => id !== jogoId) : [...atuais, jogoId]
    );
  }

  // What should be scheduled, as a key: the effect only reschedules when it changes.
  const agendamento = JSON.stringify(
    fonte === 'demo'
      ? []
      : jogosAQueVou
          .filter((jogoId) => !desligados.includes(jogoId))
          .map((jogoId) => {
            const jogo = obterJogo(jogoId);
            return [jogoId, jogo?.inicio, jogo?.horaConfirmada, planos[jogoId]?.localId ?? null];
          })
  );

  useEffect(() => {
    if (!carregado) return;
    const lista = JSON.parse(agendamento) as [
      string,
      string | undefined,
      boolean | undefined,
      string | null,
    ][];
    const agora = Date.now();
    const avisos = lista.flatMap(([jogoId, , , localId]) => {
      const jogo = obterJogo(jogoId);
      const casa = jogo ? obterClube(jogo.casaId) : undefined;
      const fora = jogo ? obterClube(jogo.foraId) : undefined;
      if (!jogo || !casa || !fora) return [];
      const local = localId ? (obterLocal(localId) ?? null) : null;
      return avisosDoJogo(jogo, { casa: casa.nomeCurto, fora: fora.nomeCurto }, local, agora);
    });
    void reagendar(avisos).catch((erro: unknown) => {
      if (__DEV__) console.warn('Não foi possível agendar os avisos do jogo:', erro);
    });
  }, [carregado, agendamento, permissaoDada]);

  const value: PlanosJogos = {
    vou: (jogoId) => jogoId in planos,
    jogosAQueVou,
    alternarVou,
    garantirVou: async (jogoId) => {
      if (jogoId in planos) return;
      await alternarVou(jogoId);
    },
    tascoDoPlano: (jogoId) => planos[jogoId]?.localId ?? null,
    escolherTasco,
    avisosLigados: (jogoId) => !desligados.includes(jogoId),
    alternarAvisos,
  };

  return <PlanosJogosContext value={value}>{children}</PlanosJogosContext>;
}

export function usePlanosJogos() {
  const context = use(PlanosJogosContext);
  if (!context) throw new Error('usePlanosJogos tem de ser usado dentro de <PlanosJogosProvider>');
  return context;
}
