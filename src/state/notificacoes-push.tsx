import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { registerThisDevice } from '@/lib/push';
import { useUserId } from '@/lib/session';
import { obterJogo } from '@/mocks/jogos';

/**
 * Liga as notificações push à conta. Não desenha nada.
 * - Com sessão e sugestões ligadas, regista este telemóvel (sem pedir permissão: isso só acontece
 *   quando a pessoa liga as sugestões em Notificações).
 * - Tocar numa dica sobre um jogo abre o jogo; as outras abrem as Novidades. O aviso da retrospetiva abre a retrospetiva.
 */
export function NotificacoesPush() {
  const router = useRouter();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const registadoPara = useRef<string | null>(null);
  const querSugestoes = perfil.data?.nudgesEnabled ?? false;

  useEffect(() => {
    if (!userId) {
      registadoPara.current = null;
      return;
    }
    if (!querSugestoes || registadoPara.current === userId) return;
    registadoPara.current = userId;
    registerThisDevice().catch((erro: unknown) => {
      if (__DEV__) console.warn('Não foi possível registar o telemóvel para notificações:', erro);
    });
  }, [userId, querSugestoes]);

  useEffect(() => {
    const subscricao = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const dados: unknown = resposta.notification.request.content.data;
      const tipo = typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'type') : null;
      const jogoId =
        typeof dados === 'object' && dados !== null ? Reflect.get(dados, 'fixtureId') : null;
      if (tipo === 'nudge') {
        // A tip about a game opens the game; the others open Novidades.
        if (typeof jogoId === 'string' && obterJogo(jogoId)) {
          router.push({ pathname: '/jogos/[jogoId]', params: { jogoId } });
        } else {
          router.push('/perfil/novidades');
        }
      }
      if (tipo === 'recap') router.push('/perfil/retrospetiva');
      if (tipo === 'meeting-point-draft') router.push('/perfil/pontos-de-encontro');
      if (tipo === 'o-meu-jogo' && typeof jogoId === 'string' && obterJogo(jogoId)) {
        router.push({ pathname: '/jogos/o-meu-jogo', params: { jogoId } });
      }
    });
    return () => subscricao.remove();
  }, [router]);

  return null;
}
