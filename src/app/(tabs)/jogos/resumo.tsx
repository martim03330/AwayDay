import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { FriendRefused, sendFriendRequest } from '@/features/friends/api';
import { useRefreshFriends, useTripCompanions } from '@/features/friends/hooks/useFriends';
import { useMyTripAccounts } from '@/features/trips/hooks/useTrips';
import { formatarData, formatarHora } from '@/lib/datas';
import { formatarNota, plural } from '@/lib/formatos';
import { notaMedia } from '@/lib/jogos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof FriendRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  if (erro.reason === 'never_met') return 'Só podes pedir amizade a quem foi contigo.';
  if (erro.reason === 'rate_limited') return 'Já mandaste muitos pedidos hoje. Continua amanhã.';
  return 'Não deu para fazer isso. Tenta outra vez.';
}

/** Your balance on one trip, in a few words. */
function saldo(centimos: number) {
  if (centimos === 0) return 'Estás em dia';
  return centimos > 0
    ? `Recebes ${formatarCentimos(centimos)}`
    : `Deves ${formatarCentimos(-centimos)}`;
}

/**
 * O resumo de uma ida ao estádio: que jogo foi, com quem foste, o que se gastou e o que achaste.
 *
 * É o que fica de uma viagem depois de o jogo sair da lista — e é daqui que se chega às contas, que continuam
 * abertas para consulta muito depois do apito.
 */
export default function ResumoScreen() {
  const router = useRouter();
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

  const viagens = contas.data ?? [];
  const companheiros = companhia.data ?? [];
  const gastoTotal = viagens.reduce((total, viagem) => total + viagem.totalCents, 0);
  const comDespesas = viagens.filter((viagem) => viagem.expenses > 0);

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
      <ThemedText type="title" accessibilityRole="header">
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
          <ThemedText themeColor="textSecondary">Sem companhia registada neste jogo.</ThemedText>
        </Card>
      ) : (
        // One card, one row per person: the action (add, answer) sits at the end of the row.
        <Card style={styles.grupo}>
          {companheiros.map((pessoa, indice) => (
            <LinhaGrupo
              key={pessoa.profileId}
              leading={<Avatar nome={pessoa.displayName} size={38} />}
              title={pessoa.displayName}
              subtitle={
                pessoa.state === 'pedido_enviado'
                  ? 'Pedido de amizade enviado'
                  : pessoa.tripsTogether > 1
                    ? plural(pessoa.tripsTogether, 'viagem juntos', 'viagens juntos')
                    : 'Primeira viagem juntos'
              }
              separador={indice < companheiros.length - 1}
              trailing={
                pessoa.state === 'amigos' ? (
                  <Etiqueta icon={icons.perfil} label="Amigo" tone="positivo" />
                ) : pessoa.state === 'pode_pedir' ? (
                  <LinkTexto
                    label="Adicionar"
                    disabled={aTratar}
                    onPress={() => void pedirAmizade(pessoa.profileId)}
                  />
                ) : pessoa.state === 'pedido_recebido' ? (
                  <LinkTexto label="Responder" onPress={() => router.push('/perfil/amigos')} />
                ) : null
              }
            />
          ))}
        </Card>
      )}
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}

      <SectionHeader
        title="O que se gastou"
        trailing={gastoTotal > 0 ? formatarCentimos(gastoTotal) : undefined}
      />
      {gastoTotal === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">Não há contas lançadas neste jogo.</ThemedText>
        </Card>
      ) : (
        <Card style={styles.grupo}>
          {comDespesas.map((viagem, indice) => (
            <LinhaGrupo
              key={viagem.sessionId}
              onPress={() =>
                router.push({
                  pathname: '/sessao/[sessaoId]/despesas',
                  params: { sessaoId: viagem.sessionId },
                })
              }
              accessibilityLabel={`${viagem.name}: ${formatarCentimos(viagem.totalCents)}, ${saldo(viagem.myBalanceCents)}. Toca para ver as contas.`}
              leading={<IconCircle name={icons.preco} />}
              title={viagem.name}
              subtitle={`${formatarCentimos(viagem.totalCents)} em ${plural(viagem.expenses, 'despesa', 'despesas')}`}
              separador={indice < comDespesas.length - 1}
              trailing={
                <Etiqueta
                  label={saldo(viagem.myBalanceCents)}
                  tone={
                    viagem.myBalanceCents === 0
                      ? 'neutro'
                      : viagem.myBalanceCents > 0
                        ? 'positivo'
                        : 'aviso'
                  }
                />
              }
            />
          ))}
        </Card>
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
          <ThemedText themeColor="textSecondary">Ainda não deste nota a este jogo.</ThemedText>
          <Button
            label="Avaliar o jogo"
            onPress={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
          />
        </Card>
      )}

      <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
        Este resumo é só teu: ninguém vê com quem foste nem o que gastaste.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
  },
  grupo: {
    // Rows bring their own vertical space; the card keeps its side padding.
    gap: 0,
    paddingVertical: Spacing.one,
  },
  centro: {
    textAlign: 'center',
  },
});
