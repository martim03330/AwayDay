import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMyTripAccounts } from '@/features/trips/hooks/useTrips';
import { useTheme } from '@/hooks/use-theme';
import { formatarData, formatarHora } from '@/lib/datas';
import { formatarNota, plural } from '@/lib/formatos';
import { notaMedia } from '@/lib/jogos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** "a Ana, o Bruno e a Carla" fica pesado sem artigos, por isso vai só a lista de nomes. */
function lista(nomes: string[]) {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0];
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * O resumo de uma ida ao estádio: que jogo foi, com quem foste, o que se gastou e o que achaste.
 *
 * É o que fica de uma viagem depois de o jogo sair da lista — e é daqui que se chega às contas, que continuam
 * abertas para consulta muito depois do apito.
 */
export default function ResumoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const { avaliacaoDoJogo } = useAppState();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();

  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const contas = useMyTripAccounts(jogoId ?? null, userId !== null);

  if (!jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Volta aos teus jogos e tenta outra vez."
          action={{
            label: 'Os meus jogos',
            onPress: () => router.replace('/perfil/os-meus-jogos'),
          }}
        />
      </Screen>
    );
  }

  const casa = obterClube(jogo.casaId);
  const fora = obterClube(jogo.foraId);
  const estadio = obterEstadio(jogo.estadioId);
  const avaliacao = avaliacaoDoJogo(jogo.id);
  const inicio = new Date(jogo.inicio);

  // Só as viagens que aconteceram mesmo: um grupo sem contas nem boleia neste jogo não é uma viagem.
  const viagens = (contas.data ?? []).filter(
    (conta) => conta.kind === 'boleia' || conta.sessionId !== null
  );
  const companheiros = [...new Set(viagens.flatMap((viagem) => viagem.peopleNames))];
  const gastoTotal = viagens.reduce((total, viagem) => total + viagem.totalCents, 0);

  return (
    <Screen>
      <ThemedText type="title">
        {casa?.nomeCurto ?? ''} x {fora?.nomeCurto ?? ''}
      </ThemedText>
      <ThemedText themeColor="textSecondary">
        {[
          formatarData(inicio),
          formatarHora(inicio),
          estadio ? `${estadio.nome}, ${estadio.cidade}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>

      <SectionHeader title="Com quem foste" />
      {companheiros.length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            Deste jogo não ficou registo de companhia. Quando vais numa boleia ou divides contas,
            fica aqui quem foi contigo.
          </ThemedText>
        </Card>
      ) : (
        <Card style={styles.cartao}>
          <ThemedText>{lista(companheiros)}</ThemedText>
          <ThemedText type="small" themeColor="textMuted">
            {plural(companheiros.length, 'pessoa', 'pessoas')} nesta viagem
          </ThemedText>
        </Card>
      )}

      <SectionHeader title="O que se gastou" />
      {viagens.length === 0 || gastoTotal === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">Não há contas lançadas neste jogo.</ThemedText>
        </Card>
      ) : (
        viagens
          .filter((viagem) => viagem.sessionId !== null)
          .map((viagem) => (
            <Card key={`${viagem.kind}-${viagem.ownerId}`} style={styles.cartao}>
              <ThemedText style={styles.nome}>{viagem.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`${formatarCentimos(viagem.totalCents)} em ${plural(viagem.expenses, 'despesa', 'despesas')}`}
              </ThemedText>
              <View style={styles.etiquetas}>
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
              <Button
                label="Ver as contas"
                variant="secondary"
                icon={icons.preco}
                onPress={() =>
                  router.push({
                    pathname: '/jogos/contas',
                    params:
                      viagem.kind === 'boleia'
                        ? { jogoId: jogo.id, boleiaId: viagem.ownerId }
                        : { jogoId: jogo.id, grupoId: viagem.ownerId },
                  })
                }
              />
            </Card>
          ))
      )}

      <SectionHeader title="O que achaste" />
      {avaliacao ? (
        <Card style={styles.cartao}>
          <ThemedText type="subtitle">{formatarNota(notaMedia(avaliacao))} em 5</ThemedText>
          <LinhaDetalhes
            partes={[
              `estádio ${formatarNota(avaliacao.estadio)}`,
              `ambiente ${formatarNota(avaliacao.ambiente)}`,
              `acessos ${formatarNota(avaliacao.acessos)}`,
            ]}
          />
          {avaliacao.comentario ? (
            <ThemedText themeColor="textSecondary">«{avaliacao.comentario}»</ThemedText>
          ) : null}
          <Button
            label="Mudar a avaliação"
            variant="secondary"
            onPress={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
          />
        </Card>
      ) : (
        <Card style={styles.cartao}>
          <ThemedText themeColor="textSecondary">
            Ainda não disseste o que achaste deste jogo. A tua nota entra nas médias do estádio.
          </ThemedText>
          <Button
            label="Avaliar o jogo"
            onPress={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
          />
        </Card>
      )}

      <Card style={styles.cartao}>
        <ThemedText type="small" style={{ color: theme.textMuted }}>
          Este resumo é só teu: ninguém vê com quem foste nem o que gastaste.
        </ThemedText>
      </Card>
    </Screen>
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
