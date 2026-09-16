import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  openRideTripSession,
  openTripSession,
  startTripSession,
  type TripStartOption,
} from '@/features/trips/api';
import {
  useMyTripAccounts,
  useRefreshTrips,
  useTripStartOptions,
} from '@/features/trips/hooks/useTrips';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import type { Jogo } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/** "Bruno, Carla e mais 2" — sem nomes a mais, que o cartão é pequeno. */
function quemLaEsta(nomes: string[]) {
  if (nomes.length === 0) return '';
  if (nomes.length <= 3) return nomes.join(', ');
  return `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
}

/**
 * As contas do dia, no ecrã do jogo.
 *
 * As contas são **da malta que foi à viagem**: abrem-se a partir da boleia (traz quem vai no carro) ou de um grupo
 * (traz a malta do grupo), ou do zero — e depois acrescenta-se ou tira-se gente lá dentro. Não são «as contas do
 * grupo» nem «as contas da boleia»: são umas contas, com as pessoas que lá estão.
 */
export function ContasDaViagem({ jogo }: { jogo: Jogo }) {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const contas = useMyTripAccounts(jogo.id, userId !== null);
  const opcoes = useTripStartOptions(jogo.id, userId !== null);
  const refrescar = useRefreshTrips();
  const [aAbrir, setAAbrir] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!userId) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          As contas da viagem dividem-se com quem foi contigo: entra na tua conta para as ver.
        </ThemedText>
      </Card>
    );
  }

  const lista = contas.data ?? [];

  if (contas.isLoading) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">A ver as contas…</ThemedText>
      </Card>
    );
  }

  async function abrir(criar: () => Promise<string>) {
    setErro(null);
    setAAbrir(true);
    try {
      const sessao = await criar();
      void refrescar();
      router.push({ pathname: '/jogos/contas', params: { jogoId: jogo.id, sessaoId: sessao } });
    } catch {
      setErro('Não deu para abrir as contas. Tenta outra vez.');
    } finally {
      setAAbrir(false);
    }
  }

  const comecarPor = (opcao: TripStartOption) =>
    abrir(() =>
      opcao.kind === 'boleia' ? openRideTripSession(opcao.id) : openTripSession(opcao.id, jogo.id)
    );

  return (
    <>
      {lista.map((conta) => (
        <Card
          key={conta.sessionId}
          style={styles.cartao}
          onPress={() =>
            router.push({
              pathname: '/jogos/contas',
              params: { jogoId: jogo.id, sessaoId: conta.sessionId },
            })
          }
          accessibilityLabel={`${conta.name}, ${plural(conta.people, 'pessoa', 'pessoas')}. Toca para abrir.`}>
          <ThemedText style={styles.nome} numberOfLines={1}>
            {conta.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {quemLaEsta(conta.peopleNames)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {conta.expenses === 0
              ? 'Ainda sem nada lançado. Vai pondo o que fores pagando.'
              : `${formatarCentimos(conta.totalCents)} em ${plural(conta.expenses, 'despesa', 'despesas')}`}
          </ThemedText>
          {conta.expenses > 0 ? (
            <View style={styles.etiquetas}>
              <Etiqueta
                icon={conta.myBalanceCents < 0 ? icons.preco : icons.selecionado}
                label={
                  conta.myBalanceCents === 0
                    ? 'Estás em dia'
                    : conta.myBalanceCents > 0
                      ? `Tens a receber ${formatarCentimos(conta.myBalanceCents)}`
                      : `Deves ${formatarCentimos(-conta.myBalanceCents)}`
                }
                tone={
                  conta.myBalanceCents === 0
                    ? 'neutro'
                    : conta.myBalanceCents > 0
                      ? 'positivo'
                      : 'aviso'
                }
              />
            </View>
          ) : null}
        </Card>
      ))}

      {lista.length === 0 ? (
        <Card style={styles.cartao}>
          <ThemedText themeColor="textSecondary">
            As contas desta viagem são da malta que foi: as cervejas, os petiscos, a casa, as
            portagens. Cada despesa fica dividida por quem escolheres nela, e no fim a app diz quem
            paga a quem.
          </ThemedText>
          {(opcoes.data ?? []).map((opcao) => (
            <Button
              key={`${opcao.kind}-${opcao.id}`}
              label={`Abrir com ${opcao.title.toLowerCase()} · ${plural(opcao.people, 'pessoa', 'pessoas')}`}
              icon={opcao.kind === 'boleia' ? icons.carro : icons.perfil}
              variant={opcao.kind === 'boleia' ? 'primary' : 'secondary'}
              disabled={aAbrir}
              onPress={() => void comecarPor(opcao)}
            />
          ))}
          <LinkTexto
            label="Abrir só comigo e acrescentar gente depois"
            onPress={() => void abrir(() => startTripSession(jogo.id))}
          />
        </Card>
      ) : (opcoes.data ?? []).length > 0 ? (
        <Card style={styles.cartao}>
          <ThemedText type="small" themeColor="textMuted">
            Foste com outra malta e queres contas à parte? Dá para abrir mais umas.
          </ThemedText>
          {(opcoes.data ?? []).map((opcao) => (
            <LinkTexto
              key={`${opcao.kind}-${opcao.id}`}
              label={`Abrir contas com ${opcao.title.toLowerCase()}`}
              onPress={() => void comecarPor(opcao)}
            />
          ))}
        </Card>
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  nome: {
    fontWeight: '600',
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
