import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMyTripAccounts } from '@/features/trips/hooks/useTrips';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import type { Jogo } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/**
 * As contas do dia, no ecrã do jogo: onde há contas deste jogo que me digam respeito — na boleia em que vou ou num
 * grupo meu — e como está o meu saldo em cada umas. Uma boleia não cria grupo nenhum: as pessoas das contas são as
 * do carro.
 */
export function ContasDaViagem({ jogo }: { jogo: Jogo }) {
  const router = useRouter();
  const userId = useUserId();
  const contas = useMyTripAccounts(jogo.id, userId !== null);

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

  if (lista.length === 0) {
    return (
      <Card style={styles.cartao}>
        <ThemedText themeColor="textSecondary">
          As contas de um dia de jogo dividem-se com quem foi contigo: numa boleia, ou num grupo. As
          cervejas, os petiscos, a casa, as portagens — cada despesa fica dividida por quem entrou
          nela, e no fim a app diz quem paga a quem.
        </ThemedText>
        <LinkTexto
          label="Criar ou entrar num grupo"
          onPress={() => router.push('/perfil/grupos')}
        />
      </Card>
    );
  }

  return (
    <>
      {lista.map((conta) => (
        <Card
          key={`${conta.kind}-${conta.ownerId}`}
          style={styles.cartao}
          onPress={() =>
            router.push({
              pathname: '/jogos/contas',
              params:
                conta.kind === 'boleia'
                  ? { jogoId: jogo.id, boleiaId: conta.ownerId }
                  : { jogoId: jogo.id, grupoId: conta.ownerId },
            })
          }
          accessibilityLabel={`Contas de ${conta.title}. Toca para abrir.`}>
          <ThemedText style={styles.nome} numberOfLines={1}>
            {conta.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {conta.sessionId === null
              ? 'Ainda sem contas para este jogo. Abre-as e vai lançando o que for saindo.'
              : `${formatarCentimos(conta.totalCents)} em ${plural(conta.expenses, 'despesa', 'despesas')}`}
          </ThemedText>
          {conta.sessionId !== null ? (
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
