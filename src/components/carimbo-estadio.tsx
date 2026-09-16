import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { getCurrentPosition } from '@/features/presence/location';
import { useMyProfile, useUpdateRankingVisibility } from '@/features/profile/hooks/useMyProfile';
import { fetchMyStamps, stampStadium, StampRefused } from '@/features/stamps/api';
import { useNow } from '@/hooks/use-now';
import { podeCarimbar } from '@/lib/carimbos';
import { formatarDistancia } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import type { Jogo, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** O dia de hoje em Portugal, para saber se o carimbo deste estádio já é de hoje. */
function hojeEmLisboa() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon' }).format(new Date());
}

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof StampRefused))
    return 'Não deu para carimbar. Tenta outra vez daqui a nada.';
  switch (erro.reason) {
    case 'too_far':
      return 'Estás longe de mais do estádio. O carimbo é para quem lá está.';
    case 'outside_window':
      return 'Fora de horas: o carimbo abre quatro horas antes do apito e fecha cinco depois.';
    case 'bad_location':
      return 'Não conseguimos saber onde estás. Liga a localização e tenta outra vez.';
    case 'rate_limited':
      return 'Já tentaste muitas vezes hoje. Amanhã é outro dia.';
    default:
      return 'Não deu para carimbar. Tenta outra vez daqui a nada.';
  }
}

/**
 * O carimbo do estádio, em dia de jogo e no local.
 *
 * É a única coisa da app que prova que se lá esteve: a app lê a posição uma vez e o servidor confirma a distância.
 * A posição não fica guardada — fica o estádio, o jogo e o dia. Os carimbos antigos, marcados à mão, continuam a
 * contar no passaporte, mas só estes contam para o ranking público.
 */
export function CarimboEstadio({ jogo, estadio }: { jogo: Jogo; estadio: Venue }) {
  const userId = useUserId();
  const agora = useNow(60 * 1000);
  const queryClient = useQueryClient();
  const perfil = useMyProfile(userId);
  const mudarRanking = useUpdateRankingVisibility(userId);
  const [aCarimbar, setACarimbar] = useState(false);

  const carimbos = useQuery({
    queryKey: ['stamps', userId],
    queryFn: userId ? fetchMyStamps : skipToken,
    meta: { persist: false },
  });

  if (!userId || !podeCarimbar(jogo.inicio, agora)) return null;

  const hoje = hojeEmLisboa();
  const meu = (carimbos.data ?? []).find((carimbo) => carimbo.venueId === estadio.id);
  const carimbadoHoje = meu?.lastVisit === hoje;

  function convidarParaORanking() {
    if (perfil.data?.showInRankings !== false) return;
    Alert.alert(
      'Queres aparecer no ranking?',
      'O ranking de estádios é público: quem entrar vê o teu nome e quantos estádios já carimbaste. Podes sair quando quiseres, nas definições.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Quero aparecer', onPress: () => mudarRanking.mutate(true) },
      ]
    );
  }

  async function carimbar() {
    setACarimbar(true);
    try {
      const posicao = await getCurrentPosition();
      if (posicao.status !== 'ok') {
        Alert.alert(
          'Falta a localização',
          posicao.status === 'denied'
            ? 'O carimbo só vale se a app confirmar que estás no estádio. Dá acesso à localização e tenta outra vez.'
            : 'Não conseguimos saber onde estás. Tenta outra vez ao ar livre.'
        );
        return;
      }
      const distancia = await stampStadium(jogo.id, {
        latitude: posicao.position.latitude,
        longitude: posicao.position.longitude,
      });
      void queryClient.invalidateQueries({ queryKey: ['stamps'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      Alert.alert(
        'Carimbado!',
        `${estadio.nome} entra no teu passaporte como visitado — estavas a ${formatarDistancia(distancia)} do estádio.`
      );
      convidarParaORanking();
    } catch (problema) {
      Alert.alert('Não deu para carimbar', mensagemDeRecusa(problema));
    } finally {
      setACarimbar(false);
    }
  }

  return (
    <Card style={styles.card}>
      {carimbadoHoje ? (
        <>
          <View style={styles.etiquetas}>
            <Etiqueta icon={icons.checkInFeito} label="Estádio carimbado" tone="positivo" />
            {meu && meu.visits > 1 ? (
              <Etiqueta icon={icons.estrela} label={`${meu.visits}.ª vez aqui`} tone="destaque" />
            ) : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Ficou no teu passaporte, confirmado no local. É este tipo de carimbo que conta para o
            ranking.
          </ThemedText>
        </>
      ) : (
        <>
          <ThemedText style={styles.destaque}>Estás no estádio?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Carimba o {estadio.nome} no teu passaporte. A app confirma que estás lá pela localização
            — não guardamos onde estás, só que cá estiveste.
          </ThemedText>
          <Button
            label={aCarimbar ? 'A confirmar…' : 'Carimbar o estádio'}
            icon={icons.checkIn}
            disabled={aCarimbar}
            onPress={() => void carimbar()}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  destaque: {
    fontWeight: 800,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
