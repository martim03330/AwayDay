import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { nomeDoJogo } from '@/features/groups/components/CartaoDoPlano';
import { useMyOpenTripSessions } from '@/features/trips/hooks/useTrips';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { DURACAO_JOGO_MINUTOS } from '@/lib/jogos';
import { useUserId } from '@/lib/session';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { type FormatarDinheiro, useFormatarDinheiro } from '@/ui/valor';

/** "Deves 12,50 €", "Tens a receber 12,50 €", "Estás em dia". */
function saldo(centimos: number, dinheiro: FormatarDinheiro) {
  if (centimos === 0) return 'Estás em dia';
  return centimos > 0
    ? `Tens a receber ${dinheiro.formatar(centimos)}`
    : `Deves ${dinheiro.formatar(-centimos)}`;
}

/**
 * As sessões da viagem abertas, no topo da página dos Jogos: da véspera do jogo até ao fim dele e, depois, só enquanto
 * houver contas por acertar (a sessão continua aberta três dias, mas quem está em dia já não tem nada a fazer ali).
 * Um toque abre a sessão — quem vai, a hora do carro, quem deu a boleia e as despesas.
 */
export function SessoesAbertas() {
  const dinheiro = useFormatarDinheiro();
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const sessoes = useMyOpenTripSessions(userId !== null);
  const agora = useNow(60 * 1000);
  const visiveis = (sessoes.data ?? []).filter(
    (sessao) =>
      sessao.myBalanceCents !== 0 ||
      agora < Date.parse(sessao.kickoffAt) + DURACAO_JOGO_MINUTOS * 60 * 1000
  );

  if (!userId || visiveis.length === 0) return null;

  return (
    <>
      {visiveis.map((sessao) => (
        <Pressable
          key={sessao.sessionId}
          onPress={() =>
            router.push({ pathname: '/sessao/[sessaoId]', params: { sessaoId: sessao.sessionId } })
          }
          accessibilityRole="button"
          accessibilityLabel={dinheiro.leitor(
            `Viagem para ${nomeDoJogo(sessao.fixtureId)}, com ${plural(sessao.people, 'pessoa', 'pessoas')}.${
              sessao.ride && Date.parse(sessao.ride.departureAt) > agora
                ? ` ${sessao.ride.iDrive ? 'Sais tu' : `Sais com ${sessao.ride.driverName}`} ${formatarDiaEHora(new Date(sessao.ride.departureAt)).toLowerCase()}.`
                : ''
            } ${dinheiro.formatar(sessao.totalCents)} gastos. ${saldo(sessao.myBalanceCents, dinheiro)}. Toca para abrir.`
          )}
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
          {/* Only what may need doing: the balance, and only when there is one. */}
          {sessao.myBalanceCents !== 0 ? (
            <View style={styles.linha}>
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
                  {saldo(sessao.myBalanceCents, dinheiro)}
                </ThemedText>
              </View>
            </View>
          ) : null}
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
