import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { avisosDeJogosPerto, distanciaKm } from '@/lib/avisos-perto';
import { obterClube } from '@/mocks/clubes';
import { estadios } from '@/mocks/estadios';
import { jogos } from '@/mocks/jogos';
import { usePlanosJogos } from '@/state/planos-jogos';
import { useAppState } from '@/state/app-state';

/** Identificador destes avisos, para os substituir sem tocar nos do plano nem nos das boleias. */
const PREFIXO = 'perto:';
/** Só vale a pena agendar o que está para as próximas semanas. */
const HORIZONTE_DIAS = 30;

async function reagendar(avisos: ReturnType<typeof avisosDeJogosPerto>) {
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
        data: { type: 'o-meu-jogo', jogoId: aviso.jogoId },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: aviso.quando },
    });
  }
}

/**
 * «Hoje há jogo ao pé de ti»: um aviso de manhã, no próprio dia, para quem não marcou nada.
 *
 * Não usa a localização do telemóvel — usa o estádio do clube da terra, que a pessoa escolheu. Jogos já marcados
 * ficam de fora: esses têm os avisos do plano. Não desenha nada.
 */
export function AvisosJogosPerto() {
  const { clubeDaTerraId, clubeFavoritoId } = useAppState();
  const { jogosAQueVou } = usePlanosJogos();

  // O estádio de casa: o do clube da terra, ou o do clube do coração enquanto não houver clube da terra.
  const casa =
    estadios.find((estadio) => estadio.clubeId === (clubeDaTerraId ?? clubeFavoritoId)) ?? null;
  const marcados = jogosAQueVou.join('|');

  useEffect(() => {
    if (!casa) return;
    const agora = Date.now();
    const limite = agora + HORIZONTE_DIAS * 24 * 60 * 60 * 1000;
    const perto = jogos.flatMap((jogo) => {
      const inicio = Date.parse(jogo.inicio);
      if (inicio < agora || inicio > limite || jogosAQueVou.includes(jogo.id)) return [];
      const estadio = estadios.find((candidato) => candidato.id === jogo.estadioId);
      if (!estadio) return [];
      const casaCurta = obterClube(jogo.casaId)?.nomeCurto ?? '';
      const foraCurta = obterClube(jogo.foraId)?.nomeCurto ?? '';
      return [
        {
          id: jogo.id,
          inicio: jogo.inicio,
          nome: `${casaCurta} x ${foraCurta}`,
          estadio: estadio.nome,
          distanciaKm: distanciaKm(casa.coordenadas, estadio.coordenadas),
        },
      ];
    });

    void reagendar(avisosDeJogosPerto(perto, agora)).catch((erro: unknown) => {
      if (__DEV__) console.warn('Não foi possível agendar os avisos dos jogos perto:', erro);
    });
    // Muda quando muda a terra da pessoa ou os jogos que já marcou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casa?.id, marcados]);

  return null;
}
