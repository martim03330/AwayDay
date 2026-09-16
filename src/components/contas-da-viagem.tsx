import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMyTripSessions } from '@/features/trips/hooks/useTrips';
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
 * As contas do dia, no ecrã do jogo: em que grupos meus há contas abertas para este jogo e como está o meu saldo em
 * cada um. As contas são sempre de um grupo — é o grupo que sabe quem foi à viagem.
 */
export function ContasDaViagem({ jogo }: { jogo: Jogo }) {
  const router = useRouter();
  const userId = useUserId();
  const sessoes = useMyTripSessions(jogo.id, userId !== null);

  if (!userId) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          As contas da viagem são do grupo: entra na tua conta para as ver.
        </ThemedText>
      </Card>
    );
  }

  const grupos = sessoes.data ?? [];

  if (sessoes.isLoading) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">A ver as contas…</ThemedText>
      </Card>
    );
  }

  if (grupos.length === 0) {
    return (
      <Card style={styles.cartao}>
        <ThemedText themeColor="textSecondary">
          As contas de um dia de jogo dividem-se dentro de um grupo: as cervejas, os petiscos, a
          casa, as portagens. Cada despesa fica dividida por quem entrou nela, e no fim a app diz
          quem paga a quem.
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
      {grupos.map((grupo) => (
        <Card
          key={grupo.groupId}
          style={styles.cartao}
          onPress={() =>
            router.push({
              pathname: '/jogos/contas',
              params: { jogoId: jogo.id, grupoId: grupo.groupId },
            })
          }
          accessibilityLabel={`Contas de ${grupo.groupName}. Toca para abrir.`}>
          <ThemedText style={styles.nome} numberOfLines={1}>
            {grupo.groupName}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {grupo.sessionId === null
              ? 'Ainda sem contas para este jogo. Abre-as e vai lançando o que for saindo.'
              : `${formatarCentimos(grupo.totalCents)} em ${plural(grupo.expenses, 'despesa', 'despesas')}`}
          </ThemedText>
          {grupo.sessionId !== null ? (
            <View style={styles.etiquetas}>
              <Etiqueta
                icon={grupo.myBalanceCents < 0 ? icons.preco : icons.selecionado}
                label={
                  grupo.myBalanceCents === 0
                    ? 'Estás em dia'
                    : grupo.myBalanceCents > 0
                      ? `Tens a receber ${formatarCentimos(grupo.myBalanceCents)}`
                      : `Deves ${formatarCentimos(-grupo.myBalanceCents)}`
                }
                tone={
                  grupo.myBalanceCents === 0
                    ? 'neutro'
                    : grupo.myBalanceCents > 0
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
