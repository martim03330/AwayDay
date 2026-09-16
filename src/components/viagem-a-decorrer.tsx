import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMyLiveTrips } from '@/features/trips/hooks/useTrips';
import { formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

function nomeDoJogo(fixtureId: string) {
  const jogo = obterJogo(fixtureId);
  if (!jogo) return 'o jogo';
  return `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`;
}

/** "tu, o Bruno e a Carla" — sem repetir o teu nome, que já sabes quem és. */
function quemVai(nomes: string[], iDrive: boolean, condutor: string) {
  const outros = nomes.filter((nome) => nome !== condutor);
  const lista = iDrive ? ['tu', ...outros] : [`${condutor} ao volante`, ...outros];
  if (lista.length <= 2) return lista.join(' e ');
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

/**
 * A viagem que está a acontecer agora, no topo da lista de jogos: quem vai, e as contas a correr.
 *
 * Existe para a malta **ir lançando o que paga durante o dia** — a rodada, o café da estrada, os petiscos — em vez
 * de tentar lembrar-se de tudo à noite, quando já ninguém sabe quem pagou o quê.
 */
export function ViagemADecorrer() {
  const router = useRouter();
  const userId = useUserId();
  const viagens = useMyLiveTrips(userId !== null);

  if (!userId || (viagens.data ?? []).length === 0) return null;

  return (
    <>
      {(viagens.data ?? []).map((viagem) => (
        <Card
          key={viagem.rideId}
          style={styles.cartao}
          onPress={() =>
            router.push({
              pathname: '/jogos/contas',
              params: viagem.sessionId
                ? { jogoId: viagem.fixtureId, sessaoId: viagem.sessionId }
                : { jogoId: viagem.fixtureId, boleiaId: viagem.rideId },
            })
          }
          accessibilityLabel={`Viagem a decorrer para ${nomeDoJogo(viagem.fixtureId)}. Toca para abrir as contas.`}>
          <View style={styles.linha}>
            <Etiqueta icon={icons.carro} label="Viagem a decorrer" tone="destaque" />
          </View>
          <ThemedText style={styles.nome}>{nomeDoJogo(viagem.fixtureId)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${quemVai(viagem.peopleNames, viagem.iDrive, viagem.driverName)} · saída às ${formatarHora(
              new Date(viagem.departureAt)
            )}`}
          </ThemedText>
          {viagem.sessionId === null ? (
            <ThemedText type="small" themeColor="textSecondary">
              Abre as contas e vai lançando o que fores pagando — no fim a app diz quem paga a quem.
            </ThemedText>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {`${formatarCentimos(viagem.totalCents)} em ${plural(viagem.expenses, 'despesa', 'despesas')}`}
              </ThemedText>
              <View style={styles.linha}>
                <Etiqueta
                  icon={viagem.myBalanceCents < 0 ? icons.preco : icons.selecionado}
                  label={
                    viagem.myBalanceCents === 0
                      ? 'Estás em dia'
                      : viagem.myBalanceCents > 0
                        ? `Tens a receber ${formatarCentimos(viagem.myBalanceCents)}`
                        : `Deves ${formatarCentimos(-viagem.myBalanceCents)}`
                  }
                  tone={
                    viagem.myBalanceCents === 0
                      ? 'neutro'
                      : viagem.myBalanceCents > 0
                        ? 'positivo'
                        : 'aviso'
                  }
                />
              </View>
            </>
          )}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  nome: {
    fontWeight: '600',
  },
});
