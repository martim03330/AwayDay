import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { FriendRefused, sendFriendRequest } from '@/features/friends/api';
import { useRefreshFriends, useTripCompanions } from '@/features/friends/hooks/useFriends';
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
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof FriendRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  if (erro.reason === 'never_met') return 'Só podes pedir amizade a quem foi contigo.';
  if (erro.reason === 'rate_limited') return 'Já mandaste muitos pedidos hoje. Continua amanhã.';
  return 'Não deu para fazer isso. Tenta outra vez.';
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
  const companhia = useTripCompanions(jogoId ?? null, userId !== null);
  const refrescarAmigos = useRefreshFriends();
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
  const companheiros = companhia.data ?? [];
  const gastoTotal = viagens.reduce((total, viagem) => total + viagem.totalCents, 0);

  async function pedirAmizade(profileId: string) {
    setErro(null);
    setATratar(true);
    try {
      await sendFriendRequest(profileId);
      void refrescarAmigos();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setATratar(false);
    }
  }

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
        companheiros.map((pessoa) => (
          <Card key={pessoa.profileId} style={styles.cartao}>
            <View style={styles.linha}>
              <ThemedText style={[styles.nome, styles.flex]} numberOfLines={1}>
                {pessoa.displayName}
              </ThemedText>
              {pessoa.state === 'amigos' ? (
                <Etiqueta icon={icons.perfil} label="Amigo" tone="positivo" />
              ) : null}
            </View>
            <ThemedText type="small" themeColor="textMuted">
              {pessoa.tripsTogether > 1
                ? plural(pessoa.tripsTogether, 'viagem juntos', 'viagens juntos')
                : 'primeira viagem juntos'}
            </ThemedText>
            {pessoa.state === 'pode_pedir' ? (
              <Button
                label="Adicionar amigo"
                variant="secondary"
                icon={icons.perfil}
                disabled={aTratar}
                onPress={() => void pedirAmizade(pessoa.profileId)}
              />
            ) : pessoa.state === 'pedido_enviado' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Pedido de amizade enviado. Falta essa pessoa aceitar.
              </ThemedText>
            ) : pessoa.state === 'pedido_recebido' ? (
              <LinkTexto
                label="Pediu-te amizade — responder"
                onPress={() => router.push('/perfil/amigos')}
              />
            ) : null}
          </Card>
        ))
      )}
      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

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
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
