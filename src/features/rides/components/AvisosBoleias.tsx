import { skipToken, useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { fetchMyRides } from '@/features/rides/api';
import { avisosDasBoleias } from '@/lib/regras-boleia';
import { useUserId } from '@/lib/session';

/** Identifiers of the ride reminders scheduled here, so they are replaced without touching the game reminders. */
const PREFIXO = 'boleia:';

async function reagendar(avisos: ReturnType<typeof avisosDasBoleias>) {
  const permissao = await Notifications.getPermissionsAsync();
  const agendados = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    agendados
      .filter((pedido) => pedido.identifier.startsWith(PREFIXO))
      .map((pedido) => Notifications.cancelScheduledNotificationAsync(pedido.identifier))
  );
  if (!permissao.granted) return;
  for (const aviso of avisos) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIXO}${aviso.id}`,
      content: {
        title: aviso.titulo,
        body: aviso.corpo,
        data: { type: 'boleia', rideId: aviso.id.split(':')[0], fixtureId: aviso.jogoId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: aviso.quando },
    });
  }
}

/**
 * Keeps the phone's ride reminders in step with the rides the signed-in fan drives or has a seat in: the day before,
 * 3 h before (with the no-show warning) and a nudge to confirm who turned up. Renders nothing.
 */
export function AvisosBoleias() {
  const userId = useUserId();
  const boleias = useQuery({
    queryKey: ['rides', 'mine', userId],
    queryFn: userId ? fetchMyRides : skipToken,
    staleTime: 5 * 60 * 1000,
    meta: { persist: false },
  });

  // Signed out (or another account about to come in): this account's reminders, with its meeting places, go away.
  useEffect(() => {
    if (userId !== null) return;
    void reagendar([]).catch((erro: unknown) => {
      if (__DEV__) console.warn('Não foi possível apagar os avisos das boleias:', erro);
    });
  }, [userId]);

  const chave = (boleias.data ?? [])
    .map((boleia) => `${boleia.id}:${boleia.departureAt}:${boleia.status}:${boleia.role}`)
    .join('|');

  useEffect(() => {
    if (!boleias.data) return;
    const avisos = avisosDasBoleias(
      boleias.data
        .filter((boleia) => boleia.status === 'open')
        .map((boleia) => ({
          id: boleia.id,
          jogoId: boleia.fixtureId,
          partida: new Date(boleia.departureAt),
          origem: boleia.originName,
          papel: boleia.role === 'driver' ? ('condutor' as const) : ('passageiro' as const),
        })),
      Date.now()
    );
    void reagendar(avisos).catch((erro: unknown) => {
      if (__DEV__) console.warn('Não foi possível agendar os avisos das boleias:', erro);
    });
    // `chave` changes exactly when the rides that matter for reminders change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return null;
}
