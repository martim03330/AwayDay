import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { registerThisDevice } from '@/lib/push';
import { useUserId } from '@/lib/session';

/**
 * Liga as notificações push à conta. Não desenha nada.
 * - Com sessão e sugestões ligadas, regista este telemóvel (sem pedir permissão: isso só acontece
 *   quando a pessoa liga as sugestões em Notificações).
 * - Tocar numa sugestão abre as Novidades.
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
      if (typeof dados === 'object' && dados !== null && Reflect.get(dados, 'type') === 'nudge') {
        router.push('/perfil/novidades');
      }
    });
    return () => subscricao.remove();
  }, [router]);

  return null;
}
