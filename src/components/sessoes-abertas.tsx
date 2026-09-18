import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { nomeDoJogo } from '@/features/groups/components/CartaoDoPlano';
import { useMyOpenTripSessions } from '@/features/trips/hooks/useTrips';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** "Deves 12,50 €", "Tens a receber 12,50 €", "Estás em dia". */
function saldo(centimos: number) {
  if (centimos === 0) return 'Estás em dia';
  return centimos > 0
    ? `Tens a receber ${formatarCentimos(centimos)}`
    : `Deves ${formatarCentimos(-centimos)}`;
}

/**
 * As sessões da viagem abertas, no topo da página dos Jogos: da véspera do jogo até uns dias depois. Um toque abre a
 * sessão — quem vai, a hora do carro, quem deu a boleia e as despesas.
 */
export function SessoesAbertas() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const sessoes = useMyOpenTripSessions(userId !== null);

  if (!userId || (sessoes.data ?? []).length === 0) return null;

  return (
    <>
      {(sessoes.data ?? []).map((sessao) => (
        <Pressable
          key={sessao.sessionId}
          onPress={() =>
            router.push({ pathname: '/sessao/[sessaoId]', params: { sessaoId: sessao.sessionId } })
          }
          accessibilityRole="button"
          accessibilityLabel={`Viagem para ${nomeDoJogo(sessao.fixtureId)}, com ${plural(sessao.people, 'pessoa', 'pessoas')}. ${saldo(sessao.myBalanceCents)}. Toca para abrir.`}
          style={({ pressed }) => [
            styles.cartao,
            CardShadow,
            { backgroundColor: theme.accent },
            pressed && styles.premido,
          ]}>
          <View style={styles.linha}>
            <Icon name={icons.carro} size={16} color={theme.highlight} />
            <ThemedText type="eyebrow" style={[styles.flex, { color: theme.highlight }]}>
              {`A viagem · ${sessao.name}`}
            </ThemedText>
            <Icon name={icons.seguinte} size={18} color={theme.accentText} />
          </View>
          <ThemedText type="subtitle" style={{ color: theme.accentText }}>
            {nomeDoJogo(sessao.fixtureId)}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.accentText }}>
            {sessao.ride
              ? `${sessao.ride.iDrive ? 'Sais tu' : `Sai com ${sessao.ride.driverName}`} ${formatarDiaEHora(new Date(sessao.ride.departureAt)).toLowerCase()}`
              : plural(sessao.people, 'pessoa vai', 'pessoas vão')}
          </ThemedText>
          <View style={styles.linha}>
            <View style={[styles.pastilha, { backgroundColor: theme.accentPressed }]}>
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                {`${formatarCentimos(sessao.totalCents)} gastos`}
              </ThemedText>
            </View>
            <View
              style={[
                styles.pastilha,
                {
                  backgroundColor:
                    sessao.myBalanceCents < 0 ? theme.highlight : theme.accentPressed,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{
                  color: sessao.myBalanceCents < 0 ? theme.highlightText : theme.accentText,
                }}>
                {saldo(sessao.myBalanceCents)}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
    padding: Spacing.threeAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  premido: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  pastilha: {
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
});
