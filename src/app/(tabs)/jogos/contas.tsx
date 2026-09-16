import { skipToken, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchGroupMembers, fetchMyGroups } from '@/features/groups/api';
import {
  addTripExpense,
  CATEGORIAS,
  openTripSession,
  removeTripExpense,
  TripRefused,
  type CategoriaDespesa,
  type TripBalance,
} from '@/features/trips/api';
import {
  useRefreshTrips,
  useTripBalances,
  useTripExpenses,
  useTripSession,
} from '@/features/trips/hooks/useTrips';
import { useTheme } from '@/hooks/use-theme';
import { acertarContas, dividirCentimos, meuAcerto, parteDeCada } from '@/lib/acerto';
import { plural } from '@/lib/formatos';
import { formatarCentimos, lerPrecoEmCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons, type IconName } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** Como cada tipo de despesa se diz e se desenha. */
const CATEGORIA: Record<CategoriaDespesa, { nome: string; icon: IconName }> = {
  cerveja: { nome: 'Cervejas', icon: icons.brinde },
  petiscos: { nome: 'Petiscos', icon: icons.tasco },
  refeicao: { nome: 'Refeição', icon: icons.especialidade },
  bilhetes: { nome: 'Bilhetes', icon: icons.estadio },
  casa: { nome: 'Casa', icon: icons.casa },
  boleia: { nome: 'Boleia', icon: icons.carro },
  portagens: { nome: 'Portagens', icon: icons.rota },
  outro: { nome: 'Outro', icon: icons.preco },
};

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof TripRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_member':
      return 'Já não estás neste grupo.';
    case 'bad_expense':
      return 'Falta alguma coisa: escreve o que foi e quanto custou.';
    case 'participant_not_member':
    case 'payer_not_member':
      return 'Alguém que escolheste já não está no grupo. Atualiza e tenta outra vez.';
    case 'no_participants':
      return 'Escolhe pelo menos uma pessoa para entrar na despesa.';
    case 'not_yours':
      return 'Só quem lançou a despesa ou quem a pagou é que a pode apagar.';
    case 'rate_limited':
      return 'Já lançaste muitas despesas hoje. Continua amanhã.';
    default:
      return 'Não deu para fazer isso. Tenta outra vez.';
  }
}

/** "deves 12,50 €" / "tens a receber 12,50 €" / "estás em dia". */
function comoEstaOSaldo(centimos: number) {
  if (centimos === 0) return 'Estás em dia';
  return centimos > 0
    ? `Tens a receber ${formatarCentimos(centimos)}`
    : `Deves ${formatarCentimos(-centimos)}`;
}

/**
 * As transferências que fecham estas contas. Os saldos que o servidor manda somam sempre zero — cada despesa é
 * dividida por inteiro — mas se algum dia não somarem, mais vale a app dizer que não consegue fechar as contas do
 * que rebentar em cima de quem está a pagar a rodada.
 */
function fecharContas(saldos: TripBalance[]) {
  try {
    return acertarContas(
      saldos.map((pessoa) => ({
        profileId: pessoa.profileId,
        nome: pessoa.displayName,
        saldoCentimos: pessoa.balanceCents,
      }))
    );
  } catch {
    return null;
  }
}

/** "12,50 € cada" ou "12,50 €–12,51 € cada", quando a divisão não dá certa. */
function comoSeDivide(centimos: number, quantos: number) {
  const { base, comMaisUmCentimo } = parteDeCada(centimos, quantos);
  return comMaisUmCentimo === 0
    ? `${formatarCentimos(base)} cada`
    : `${formatarCentimos(base)}–${formatarCentimos(base + 1)} cada`;
}

function tomDoSaldo(centimos: number) {
  return centimos === 0 ? 'neutro' : centimos > 0 ? 'positivo' : 'aviso';
}

/**
 * As contas de uma viagem: o que o grupo gastou num jogo, quem pôs o quê, e quem paga a quem no fim.
 *
 * Cada despesa é dividida por igual entre as pessoas que entram nela — nem todos bebem, nem todos dormem na casa. A
 * divisão e os saldos são calculados no servidor; aqui só se mostra o que ele responde, e a lista de transferências,
 * que sai de `src/lib/acerto.ts`.
 */
export default function ContasScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const refrescar = useRefreshTrips();
  const { jogoId, grupoId } = useLocalSearchParams<{ jogoId?: string; grupoId?: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;

  const grupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });
  const membros = useQuery({
    queryKey: ['groups', 'members', grupoId ?? null],
    queryFn: grupoId ? () => fetchGroupMembers(grupoId) : skipToken,
    meta: { persist: false },
  });
  const sessao = useTripSession(grupoId ?? null, jogoId ?? null, userId !== null);
  const sessionId = sessao.data?.id ?? null;
  const despesas = useTripExpenses(sessionId);
  const saldos = useTripBalances(sessionId);

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<CategoriaDespesa>('petiscos');
  const [quemPagou, setQuemPagou] = useState<string | null>(null);
  // `null` até alguém mexer: até lá, entra o grupo todo.
  const [quemEntra, setQuemEntra] = useState<string[] | null>(null);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupo = (grupos.data ?? []).find((candidato) => candidato.id === grupoId);
  const gente = membros.data ?? [];
  const nomeDoJogo = jogo
    ? `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`
    : 'Jogo';

  if (!userId || !grupoId || !jogoId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.preco}
          title="Contas não encontradas"
          message="Abre as contas a partir do jogo ou do grupo."
          action={{ label: 'Os meus grupos', onPress: () => router.replace('/perfil/grupos') }}
        />
      </Screen>
    );
  }

  const listaDeSaldos: TripBalance[] = saldos.data ?? [];
  const meuSaldo = listaDeSaldos.find((pessoa) => pessoa.isMe)?.balanceCents ?? 0;
  const acerto = fecharContas(listaDeSaldos);
  const meu = meuAcerto(acerto ?? [], userId);

  const escolhidos = quemEntra ?? gente.map((pessoa) => pessoa.profileId);
  const centimos = lerPrecoEmCentimos(valor);
  const partes = centimos && escolhidos.length > 0 ? dividirCentimos(centimos, escolhidos) : null;
  const podeLancar =
    !aTratar &&
    sessionId !== null &&
    descricao.trim().length >= 2 &&
    centimos !== null &&
    centimos > 0 &&
    escolhidos.length > 0;

  async function tratar(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      void refrescar();
      return true;
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      return false;
    } finally {
      setATratar(false);
    }
  }

  const lancar = () =>
    void tratar(async () => {
      if (!sessionId || centimos === null) return;
      await addTripExpense({
        sessionId,
        description: descricao,
        category: tipo,
        cents: centimos,
        payerId: quemPagou ?? undefined,
        participants: quemEntra ?? undefined,
      });
    }).then((entrou) => {
      if (!entrou) return;
      setDescricao('');
      setValor('');
      setQuemPagou(null);
      setQuemEntra(null);
    });

  const apagar = (id: string, texto: string) =>
    Alert.alert('Apagar esta despesa?', `«${texto}» sai das contas e os saldos mudam.`, [
      { text: 'Deixa estar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => void tratar(() => removeTripExpense(id)),
      },
    ]);

  return (
    <Screen>
      <ThemedText type="title">Contas de {nomeDoJogo}</ThemedText>
      <ThemedText themeColor="textSecondary">
        {grupo ? grupo.name : 'Grupo'} · {plural(gente.length, 'pessoa', 'pessoas')}
      </ThemedText>

      {sessionId === null ? (
        <Card style={styles.cartao}>
          <ThemedText themeColor="textSecondary">
            Ainda não há contas deste jogo. Abre-as no dia da viagem e depois é só ir lançando o que
            for saindo: as cervejas, os petiscos, a casa, as portagens. No fim a app diz quem paga a
            quem.
          </ThemedText>
          <Button
            label="Abrir as contas da viagem"
            icon={icons.preco}
            disabled={aTratar || sessao.isLoading}
            onPress={() =>
              void tratar(async () => {
                await openTripSession(grupoId, jogoId);
              })
            }
          />
        </Card>
      ) : (
        <>
          <Card style={styles.cartao}>
            <ThemedText type="subtitle">
              {formatarCentimos(sessao.data?.totalCents ?? 0)} no total
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {plural(sessao.data?.expenses ?? 0, 'despesa lançada', 'despesas lançadas')}
            </ThemedText>
            <View style={styles.etiquetas}>
              <Etiqueta
                icon={meuSaldo < 0 ? icons.preco : icons.selecionado}
                label={comoEstaOSaldo(meuSaldo)}
                tone={tomDoSaldo(meuSaldo)}
              />
            </View>
          </Card>

          <SectionHeader title="Quem paga a quem" />
          {acerto === null ? (
            <Card>
              <ThemedText themeColor="textSecondary">
                Não estamos a conseguir fechar estas contas. Atualiza daqui a pouco — as despesas
                estão todas cá em baixo.
              </ThemedText>
            </Card>
          ) : acerto.length === 0 ? (
            <Card>
              <ThemedText themeColor="textSecondary">
                {(sessao.data?.expenses ?? 0) === 0
                  ? 'Ainda não há nada lançado. Assim que entrar a primeira despesa, isto enche-se.'
                  : 'Está tudo certo: ninguém deve nada a ninguém.'}
              </ThemedText>
            </Card>
          ) : (
            acerto.map((transferencia) => {
              const souEu =
                transferencia.deId === userId
                  ? 'pagar'
                  : transferencia.paraId === userId
                    ? 'receber'
                    : null;
              return (
                <Card key={`${transferencia.deId}-${transferencia.paraId}`} style={styles.cartao}>
                  <View style={styles.linha}>
                    <Icon
                      name={icons.seguinte}
                      size={18}
                      color={souEu ? theme.accent : theme.textMuted}
                    />
                    <ThemedText style={styles.flex}>
                      {souEu === 'pagar'
                        ? `Pagas ${formatarCentimos(transferencia.centimos)} a ${transferencia.paraNome}`
                        : souEu === 'receber'
                          ? `${transferencia.deNome} paga-te ${formatarCentimos(transferencia.centimos)}`
                          : `${transferencia.deNome} paga ${formatarCentimos(transferencia.centimos)} a ${transferencia.paraNome}`}
                    </ThemedText>
                  </View>
                </Card>
              );
            })
          )}
          {acerto !== null && acerto.length > 0 ? (
            <ThemedText type="small" themeColor="textMuted">
              {meu.aPagar.length + meu.aReceber.length === 0
                ? 'Tu estás em dia — isto é o que falta entre os outros.'
                : `${plural(acerto.length, 'transferência', 'transferências')} e fica tudo fechado.`}
            </ThemedText>
          ) : null}

          <SectionHeader title="Quem pôs o quê" />
          {listaDeSaldos.map((pessoa) => (
            <Card key={pessoa.profileId} style={styles.cartao}>
              <View style={styles.linha}>
                <ThemedText style={styles.flex} numberOfLines={1}>
                  {pessoa.isMe ? `${pessoa.displayName} (tu)` : pessoa.displayName}
                </ThemedText>
                <Etiqueta
                  label={
                    pessoa.balanceCents === 0
                      ? 'em dia'
                      : pessoa.balanceCents > 0
                        ? `a receber ${formatarCentimos(pessoa.balanceCents)}`
                        : `deve ${formatarCentimos(-pessoa.balanceCents)}`
                  }
                  tone={tomDoSaldo(pessoa.balanceCents)}
                />
              </View>
              <ThemedText type="small" themeColor="textMuted">
                {`pôs ${formatarCentimos(pessoa.paidCents)} · coube-lhe ${formatarCentimos(pessoa.owedCents)}`}
              </ThemedText>
            </Card>
          ))}

          <SectionHeader title="Despesas" trailing={String(despesas.data?.length ?? 0)} />
          {(despesas.data ?? []).length === 0 ? (
            <Card>
              <ThemedText themeColor="textSecondary">
                Nada lançado ainda. A primeira rodada costuma ser a seguir.
              </ThemedText>
            </Card>
          ) : (
            (despesas.data ?? []).map((despesa) => (
              <Card key={despesa.id} style={styles.cartao}>
                <View style={styles.linha}>
                  <Icon
                    name={CATEGORIA[despesa.category].icon}
                    size={20}
                    color={theme.textSecondary}
                  />
                  <ThemedText style={styles.flex} numberOfLines={1}>
                    {despesa.description}
                  </ThemedText>
                  <ThemedText type="smallBold">{formatarCentimos(despesa.cents)}</ThemedText>
                </View>
                <ThemedText type="small" themeColor="textMuted">
                  {`pagou ${despesa.payerId === userId ? 'ti' : despesa.payerName} · ${
                    despesa.participants === gente.length
                      ? 'o grupo todo'
                      : despesa.participantNames.join(', ')
                  } · ${comoSeDivide(despesa.cents, despesa.participants)}`}
                </ThemedText>
                {despesa.mine ? (
                  <LinkTexto
                    label="Apagar"
                    onPress={() => apagar(despesa.id, despesa.description)}
                  />
                ) : null}
              </Card>
            ))
          )}

          <SectionHeader title="Lançar uma despesa" />
          <Card style={styles.cartao}>
            <Campo
              label="O que foi"
              value={descricao}
              onChangeText={setDescricao}
              placeholder="Rodada no café da esquina"
              maxLength={80}
            />
            <Campo
              label="Quanto custou"
              value={valor}
              onChangeText={setValor}
              placeholder="12,50"
              keyboardType="decimal-pad"
              erro={valor.length > 0 && centimos === null ? 'Escreve um valor como 12,50.' : null}
            />

            <ThemedText type="smallBold">Do que é</ThemedText>
            <View style={styles.etiquetas}>
              {CATEGORIAS.map((nome) => (
                <Chip
                  key={nome}
                  label={CATEGORIA[nome].nome}
                  selected={tipo === nome}
                  emCartao
                  onPress={() => setTipo(nome)}
                />
              ))}
            </View>

            <ThemedText type="smallBold">Quem pagou</ThemedText>
            <View style={styles.etiquetas}>
              {gente.map((pessoa) => (
                <Chip
                  key={pessoa.profileId}
                  label={pessoa.isMine ? 'Eu' : pessoa.displayName}
                  selected={(quemPagou ?? userId) === pessoa.profileId}
                  emCartao
                  onPress={() => setQuemPagou(pessoa.profileId)}
                />
              ))}
            </View>

            <ThemedText type="smallBold">Quem entra nesta despesa</ThemedText>
            <View style={styles.etiquetas}>
              {gente.map((pessoa) => (
                <Chip
                  key={pessoa.profileId}
                  label={pessoa.isMine ? 'Eu' : pessoa.displayName}
                  selected={escolhidos.includes(pessoa.profileId)}
                  emCartao
                  accessibilityLabel={`${pessoa.displayName} entra nesta despesa`}
                  onPress={() =>
                    setQuemEntra(
                      escolhidos.includes(pessoa.profileId)
                        ? escolhidos.filter((id) => id !== pessoa.profileId)
                        : [...escolhidos, pessoa.profileId]
                    )
                  }
                />
              ))}
            </View>
            {escolhidos.length === 0 ? (
              <ThemedText type="small" themeColor="textMuted">
                Escolhe pelo menos uma pessoa. Sem ninguém, a despesa não é de ninguém.
              </ThemedText>
            ) : partes ? (
              <ThemedText type="small" themeColor="textSecondary">
                {Math.max(...partes) === Math.min(...partes)
                  ? `${formatarCentimos(partes[0])} para cada um dos ${escolhidos.length}.`
                  : `${formatarCentimos(Math.min(...partes))} cada, e ${plural(
                      partes.filter((parte) => parte > Math.min(...partes)).length,
                      'pessoa paga',
                      'pessoas pagam'
                    )} mais um cêntimo — não dá divisão certa.`}
              </ThemedText>
            ) : null}

            <Button label="Lançar despesa" disabled={!podeLancar} onPress={lancar} />
          </Card>
        </>
      )}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      <ThemedText type="small" themeColor="textMuted">
        As contas ficam aqui depois do jogo: a app não move dinheiro nenhum, só diz quem paga a
        quem.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.two,
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
