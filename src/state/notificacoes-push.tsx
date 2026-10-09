import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { reportErrorOnce } from '@/features/feedback/report';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { enablePushOnThisDevice, registerThisDevice, takePushAskOnSignIn } from '@/lib/push';
import { useUserId } from '@/lib/session';
import { obterJogo } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';

type Router = ReturnType<typeof useRouter>;

function campo(dados: unknown, nome: string): unknown {
  return typeof dados === 'object' && dados !== null ? Reflect.get(dados, nome) : null;
}

/** A tapped notification's identity, so the same tap is never handled twice (listener and cold start). */
function chaveDaResposta(resposta: Notifications.NotificationResponse) {
  return `${resposta.notification.request.identifier}:${resposta.actionIdentifier}`;
}

/** Opens the screen a tapped notification is about. Unknown types do nothing. */
export function abrirNotificacao(router: Router, resposta: Notifications.NotificationResponse) {
  const dados: unknown = resposta.notification.request.content.data;
  const tipo = campo(dados, 'type');
  const fixtureId = campo(dados, 'fixtureId');
  // Local reminders ("o meu jogo") carry `jogoId`; server pushes carry `fixtureId`.
  const jogoIdLocal = campo(dados, 'jogoId');
  const jogoId = typeof fixtureId === 'string' ? fixtureId : jogoIdLocal;
  const rideId = campo(dados, 'rideId');
  const grupoId = campo(dados, 'groupId');
  const sessaoId = campo(dados, 'sessionId');

  if (tipo === 'nudge') {
    // A tip about a game opens the game; the others open the games list, where the coach's tip lives.
    if (typeof jogoId === 'string' && obterJogo(jogoId)) {
      router.push({ pathname: '/jogos/[jogoId]', params: { jogoId } });
    } else {
      router.push('/jogos');
    }
  }
  if (tipo === 'weather' && typeof jogoId === 'string' && obterJogo(jogoId)) {
    router.push({ pathname: '/jogos/[jogoId]', params: { jogoId } });
  }
  if (tipo === 'recap') router.push('/perfil/retrospetiva');
  if (tipo === 'meeting-point-draft') router.push('/perfil/pontos-de-encontro');
  if (tipo === 'boleia' && typeof rideId === 'string' && typeof jogoId === 'string') {
    router.push({ pathname: '/jogos/boleia', params: { rideId, jogoId } });
  }
  if (tipo === 'conversa' && typeof rideId === 'string' && typeof jogoId === 'string') {
    router.push({ pathname: '/carro/[rideId]', params: { rideId, jogoId } });
  }
  if (tipo === 'grupo' && typeof grupoId === 'string') {
    router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });
  }
  if (tipo === 'convite-grupo') router.push('/malta');
  if (tipo === 'contas' && typeof sessaoId === 'string') {
    router.push({ pathname: '/sessao/[sessaoId]/despesas', params: { sessaoId } });
  }
  if (tipo === 'o-meu-jogo' && typeof jogoId === 'string' && obterJogo(jogoId)) {
    router.push({ pathname: '/jogos/[jogoId]', params: { jogoId } });
  }
}

/**
 * Liga as notificações push à conta. Não desenha nada.
 * - Com sessão, regista este telemóvel (sem pedir permissão: isso só acontece quando a pessoa liga os avisos na
 *   introdução, liga as sugestões, marca «vou» ou oferece e pede boleias). Quem ligou os avisos na introdução sem
 *   conta vê o pedido de permissão aqui, na primeira vez que entra.
 * - Tocar numa dica sobre um jogo abre o jogo; as outras abrem a lista de jogos, onde está a dica do treinador. O
 *   aviso da retrospetiva abre a retrospetiva.
 * - Uma mensagem de um grupo abre a conversa do grupo; um convite para um grupo abre a Malta.
 * - Uma despesa ou um pagamento abre as despesas da viagem.
 * - Com a app fechada, o toque que a abriu é tratado assim que a navegação estiver pronta.
 */
export function NotificacoesPush() {
  const router = useRouter();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const { onboardingConcluido } = useAppState();
  const navegacao = useRootNavigationState();
  const registadoPara = useRef<string | null>(null);
  const tratadas = useRef(new Set<string>());
  const perfilCarregado = perfil.data !== undefined;
  const navegacaoPronta = navegacao?.key !== undefined && onboardingConcluido;

  useEffect(() => {
    if (!userId) {
      registadoPara.current = null;
      return;
    }
    if (!perfilCarregado || registadoPara.current === userId) return;
    registadoPara.current = userId;
    const registar = async () => {
      const pedir = await takePushAskOnSignIn().catch(() => false);
      if (pedir) await enablePushOnThisDevice();
      else await registerThisDevice();
    };
    registar().catch((erro: unknown) => {
      void reportErrorOnce('push-registo', 'Registo do telemóvel para notificações', erro);
    });
  }, [userId, perfilCarregado]);

  useEffect(() => {
    const subscricao = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const chave = chaveDaResposta(resposta);
      if (tratadas.current.has(chave)) return;
      tratadas.current.add(chave);
      abrirNotificacao(router, resposta);
    });
    return () => subscricao.remove();
  }, [router]);

  // Cold start: the tap that launched the app happened before the listener existed.
  useEffect(() => {
    if (!navegacaoPronta) return;
    const resposta = Notifications.getLastNotificationResponse();
    if (!resposta) return;
    Notifications.clearLastNotificationResponse();
    const chave = chaveDaResposta(resposta);
    if (tratadas.current.has(chave)) return;
    tratadas.current.add(chave);
    abrirNotificacao(router, resposta);
  }, [navegacaoPronta, router]);

  return null;
}
