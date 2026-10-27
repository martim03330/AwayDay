import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { RideSummary } from '@/features/rides/api';
import { useRideBoard, useRidePeople } from '@/features/rides/hooks/useRides';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaCurto, formatarDiaEHora, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/**
 * The fan's own ride to this game, if any: the car they drive, or the one they have (or asked for) a seat in. A
 * declined, expired or left request is no ride.
 */
export function useMinhaBoleia(fixtureId: string | null) {
  const userId = useUserId();
  const quadro = useRideBoard(fixtureId, userId !== null);
  const minhas = (quadro.data ?? []).filter(
    (boleia) =>
      boleia.status === 'open' &&
      (boleia.isMine || boleia.myStatus === 'accepted' || boleia.myStatus === 'requested')
  );
  // Driving beats a seat, and a seat beats a request still waiting.
  const ordem = (boleia: RideSummary) => (boleia.isMine ? 0 : boleia.myStatus === 'accepted' ? 1 : 2);
  return [...minhas].sort((a, b) => ordem(a) - ordem(b))[0] ?? null;
}

/**
 * «A tua boleia» on the game page, where «Combinar com a malta» would be: the title and one short pill (requests
 * waiting, seats, the time it leaves or «Por confirmar»). The rest is inside the ride, and in what VoiceOver reads.
 */
export function MinhaBoleia({ boleia, agora, onAbrir }: { boleia: RideSummary; agora: number; onAbrir: () => void }) {
  const theme = useTheme();
  const pessoas = useRidePeople(boleia.id, boleia.isMine);
  const pedidos = (pessoas.data ?? []).filter((pessoa) => pessoa.status === 'requested').length;
  const livres = Math.max(0, boleia.seatsOffered - boleia.seatsTaken);
  const saida = `sai ${formatarDiaEHora(new Date(boleia.departureAt), agora).toLowerCase()} de ${boleia.originName}`;

  const titulo = boleia.isMine
    ? 'Levas o carro'
    : boleia.myStatus === 'accepted'
      ? `Vais no carro de ${boleia.driverName}`
      : `Pediste lugar no carro de ${boleia.driverName}`;
  const estado = boleia.isMine
    ? [
        livres === 0 ? 'carro cheio' : `${plural(livres, 'lugar livre', 'lugares livres')} de ${boleia.seatsOffered}`,
        pedidos > 0 ? plural(pedidos, 'pedido por responder', 'pedidos por responder') : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : boleia.myStatus === 'accepted'
      ? `${plural(boleia.seatsTaken + 1, 'pessoa', 'pessoas')} no carro`
      : 'À espera que o condutor responda';
  const alerta = boleia.isMine ? pedidos > 0 : boleia.myStatus === 'requested';
  const partida = new Date(boleia.departureAt);
  const pilula = boleia.isMine
    ? pedidos > 0
      ? plural(pedidos, 'pedido', 'pedidos')
      : livres === 0
        ? 'Cheia'
        : `${livres} ${livres === 1 ? 'livre' : 'livres'}`
    : boleia.myStatus === 'accepted'
      ? `${formatarDiaCurto(partida, agora)} ${formatarHora(partida)}`
      : 'Por confirmar';

  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={`A tua boleia. ${titulo}, ${saida}. ${estado}.`}
      style={({ pressed }) => [styles.cartao, { backgroundColor: theme.accent }, pressed && styles.premido]}>
      <View style={[styles.icone, { backgroundColor: theme.highlight }]}>
        <Icon name={icons.carro} size={22} color={theme.highlightText} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={[styles.titulo, { color: theme.accentText }]} numberOfLines={2}>
          {titulo}
        </ThemedText>
        <View style={[styles.estado, { backgroundColor: alerta ? theme.highlight : 'rgba(255, 255, 255, 0.16)' }]}>
          <ThemedText type="smallBold" style={{ color: alerta ? theme.highlightText : theme.accentText }}>
            {pilula}
          </ThemedText>
        </View>
      </View>
      <View style={[styles.seta, { backgroundColor: theme.accentPressed }]}>
        <Icon name={icons.seguinte} size={16} color={theme.accentText} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  premido: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  icone: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  estado: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  seta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
