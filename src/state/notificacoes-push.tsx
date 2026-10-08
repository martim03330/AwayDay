import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { registerThisDevice } from '@/lib/push';
import { useUserId } from '@/lib/session';
import { obterJogo } from '@/mocks/jogos';

/**
 * Liga as notificações push à conta. Não desenha nada.
 * - Com sessão, regista este telemóvel (sem pedir permissão: isso só acontece quando a pessoa liga as
 *   sugestões ou oferece e pede boleias). As sugestões continuam a ir só a quem as ligou (servidor);
 *   os avisos das boleias precisam do telemóvel registado para toda a gente.
 * - Tocar numa dica sobre um jogo abre o jogo; as outras abrem a lista de jogos, onde está a dica do treinador. O aviso da retrospetiva abre a retrospetiva.
 * - Uma mensagem de um grupo abre a conversa do grupo; um convite para um grupo abre a Malta.
 * - Uma despesa ou um pagamento abre as despesas da viagem.
 */
export function NotificacoesPush() {
  const router = useRouter();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const registadoPara = useRef<string | null>(null);
  const perfilCarregado = perfil.data !== undefined;

  useEffect(() => {
    if (!userId) {
      registadoPara.current = null;
      return;
    }
    if (!perfilCarregado || registadoPara.current === userId) return;
    registadoPara.current = userId;
    registerThisDevice().catch((erro: unknown) => {
      if (__DEV__) console.warn('Não foi possível registar o telemóvel para notificações:', erro);
    });
  }, [userId, perfilCarregado]);

  useEffect(() => {
    const subscricao = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const dados: unknown = resposta.notification.request.content.data;
      const tipo = typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'type') : null;
      const jogoId =
        typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'fixtureId') : null;
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
      const rideId =
        typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'rideId') : null;
      if (tipo === 'boleia' && typeof rideId === 'string' && typeof jogoId === 'string') {
        router.push({ pathname: '/jogos/boleia', params: { rideId, jogoId } });
      }
      const grupoId =
        typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'groupId') : null;
      if (tipo === 'conversa' && typeof rideId === 'string' && typeof jogoId === 'string') {
        router.push({ pathname: '/carro/[rideId]', params: { rideId, jogoId } });
      }
      if (tipo === 'grupo' && typeof grupoId === 'string') {
        router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });
      }
      if (tipo === 'convite-grupo') router.push('/malta');
      const sessaoId =
        typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'sessionId') : null;
      if (tipo === 'contas' && typeof sessaoId === 'string') {
        router.push({ pathname: '/sessao/[sessaoId]/despesas', params: { sessaoId } });
      }
      if (tipo === 'o-meu-jogo' && typeof jogoId === 'string' && obterJogo(jogoId)) {
        router.push({ pathname: '/jogos/[jogoId]', params: { jogoId } });
      }
    });
    return () => subscricao.remove();
  }, [router]);

  return null;
}
