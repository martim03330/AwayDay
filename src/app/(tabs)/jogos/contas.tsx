import { skipToken, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchMyGroups } from '@/features/groups/api';
import {
  addTripExpense,
  addTripPerson,
  addTripSettlement,
  CATEGORIAS,
  confirmTripSettlement,
  openRideTripSession,
  openTripSession,
  removeTripExpense,
  removeTripPerson,
  removeTripSession,
  removeTripSettlement,
  TripRefused,
  type CategoriaDespesa,
  type TripBalance,
} from '@/features/trips/api';
import {
  useMyTripAccounts,
  useRefreshTrips,
  useRideTripSession,
  useTripBalances,
  useTripExpenses,
  useTripPeople,
  useTripPeopleToAdd,
  useTripSession,
  useTripSettlements,
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
    case 'not_in_ride':
      return 'Já não estás nesta viagem.';
    case 'bad_expense':
      return 'Falta alguma coisa: escreve o que foi e quanto custou.';
    case 'participant_not_member':
    case 'payer_not_member':
      return 'Alguém que escolheste já não está na viagem. Atualiza e tenta outra vez.';
    case 'no_participants':
      return 'Escolhe pelo menos uma pessoa para entrar na despesa.';
    case 'not_yours':
      return 'Isso só pode ser feito por quem esteve nessa despesa ou nesse pagamento.';
    case 'not_in_trip':
      return 'Essa pessoa não está nestas contas.';
    case 'bad_settlement':
      return 'Um pagamento é sempre de uma pessoa para outra, com um valor.';
    case 'ride_expense':
      return 'A despesa da boleia não se apaga: ela acompanha quem vai no carro.';
    case 'cannot_add':
      return 'Só podes acrescentar amigos, malta dos teus grupos ou quem vai no carro.';
    case 'has_money':
      return 'Essa pessoa já tem despesas nestas contas. Apaga-as primeiro, se for engano.';
    case 'last_person':
      return 'Umas contas não ficam sem ninguém.';
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

/** "12,50 € cada" ou "12,50 €–12,51 € cada", quando a divisão não dá certa. */
function comoSeDivide(centimos: number, quantos: number) {
  const { base, comMaisUmCentimo } = parteDeCada(centimos, quantos);
  return comMaisUmCentimo === 0
    ? `${formatarCentimos(base)} cada`
    : `${formatarCentimos(base)}–${formatarCentimos(base + 1)} cada`;
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

function tomDoSaldo(centimos: number) {
  return centimos === 0 ? 'neutro' : centimos > 0 ? 'positivo' : 'aviso';
}

/**
 * As contas de uma viagem: o que se gastou num jogo, quem pôs o quê, e quem paga a quem no fim.
 *
 * As contas são de um **grupo** (`grupoId`) ou de uma **boleia** (`boleiaId`) — uma boleia não cria grupo nenhum: as
 * pessoas das contas são as do carro. Cada despesa é dividida por igual entre quem entra nela; a divisão e os saldos
 * são calculados no servidor, e as transferências saem de `src/lib/acerto.ts`.
 */
export default function ContasScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const refrescar = useRefreshTrips();
  const { jogoId, sessaoId, grupoId, boleiaId } = useLocalSearchParams<{
    jogoId?: string;
    /** O caminho normal: umas contas que já existem. */
    sessaoId?: string;
    /** Os dois caminhos antigos, que abrem (ou encontram) as contas dessa origem. */
    grupoId?: string;
    boleiaId?: string;
  }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;

  const grupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId && grupoId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });
  const sessaoDoGrupo = useTripSession(grupoId ?? null, jogoId ?? null, userId !== null);
  const sessaoDaBoleia = useRideTripSession(boleiaId ?? null, userId !== null);
  const sessao = boleiaId ? sessaoDaBoleia : sessaoDoGrupo;
  const sessionId = sessaoId ?? sessao.data?.id ?? null;
  const pessoas = useTripPeople(sessionId);
  const porAcrescentar = useTripPeopleToAdd(sessionId);
  const contasDoJogo = useMyTripAccounts(jogoId ?? null, userId !== null);
  const despesas = useTripExpenses(sessionId);
  const saldos = useTripBalances(sessionId);
  const pagamentos = useTripSettlements(sessionId);

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<CategoriaDespesa>('petiscos');
  const [quemPagou, setQuemPagou] = useState<string | null>(null);
  // `null` até alguém mexer: até lá, entra a viagem toda.
  const [quemEntra, setQuemEntra] = useState<string[] | null>(null);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupo = (grupos.data ?? []).find((candidato) => candidato.id === grupoId);
  const estasContas = (contasDoJogo.data ?? []).find((conta) => conta.sessionId === sessionId);
  const gente = pessoas.data ?? [];
  const nomeDoJogo = jogo
    ? `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`
    : 'Jogo';

  if (!userId || !jogoId || (!sessaoId && !grupoId && !boleiaId)) {
    return (
      <Screen>
        <EmptyState
          icon={icons.preco}
          title="Contas não encontradas"
          message="Abre as contas a partir do jogo, da boleia ou do grupo."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
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
        {[
          estasContas?.name ??
            (boleiaId ? 'Contas da viagem' : (grupo?.name ?? 'Contas da viagem')),
          gente.length > 0 ? plural(gente.length, 'pessoa', 'pessoas') : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </ThemedText>

      {sessionId === null ? (
        <Card style={styles.cartao}>
          <ThemedText themeColor="textSecondary">
            {boleiaId
              ? 'Ainda não há contas desta viagem. Abre-as e vai lançando o que for saindo — o café da estrada, as cervejas, os petiscos. No fim a app diz quem paga a quem.'
              : 'Ainda não há contas deste jogo. Abre-as no dia da viagem e depois é só ir lançando o que for saindo: as cervejas, os petiscos, a casa, as portagens. No fim a app diz quem paga a quem.'}
          </ThemedText>
          <Button
            label="Abrir as contas da viagem"
            icon={icons.preco}
            disabled={aTratar || sessao.isLoading}
            onPress={() =>
              void tratar(async () => {
                if (boleiaId) await openRideTripSession(boleiaId);
                else if (grupoId) await openTripSession(grupoId, jogoId);
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
                  {souEu && sessionId ? (
                    <Button
                      label={souEu === 'pagar' ? 'Já paguei' : 'Já recebi'}
                      variant="secondary"
                      icon={icons.selecionado}
                      disabled={aTratar}
                      onPress={() =>
                        void tratar(() =>
                          addTripSettlement(
                            sessionId,
                            transferencia.paraId,
                            transferencia.centimos,
                            transferencia.deId
                          ).then(() => undefined)
                        )
                      }
                    />
                  ) : null}
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

          {(pagamentos.data ?? []).length > 0 ? (
            <>
              <SectionHeader title="Já pago" trailing={String((pagamentos.data ?? []).length)} />
              {(pagamentos.data ?? []).map((pagamento) => (
                <Card key={pagamento.id} style={styles.cartao}>
                  <View style={styles.linha}>
                    <Icon name={icons.preco} size={20} color={theme.textSecondary} />
                    <ThemedText style={styles.flex}>
                      {`${pagamento.fromProfileId === userId ? 'Pagaste' : `${pagamento.fromName} pagou`} ${formatarCentimos(pagamento.cents)} a ${
                        pagamento.toProfileId === userId ? 'ti' : pagamento.toName
                      }`}
                    </ThemedText>
                  </View>
                  <View style={styles.etiquetas}>
                    <Etiqueta
                      icon={pagamento.confirmed ? icons.selecionado : icons.horario}
                      label={pagamento.confirmed ? 'Confirmado' : 'Por confirmar'}
                      tone={pagamento.confirmed ? 'positivo' : 'aviso'}
                    />
                  </View>
                  {!pagamento.confirmed && pagamento.iReceive ? (
                    <Button
                      label="Recebi, sim"
                      variant="secondary"
                      disabled={aTratar}
                      onPress={() => void tratar(() => confirmTripSettlement(pagamento.id))}
                    />
                  ) : null}
                  {pagamento.mine ? (
                    <LinkTexto
                      label={
                        pagamento.iReceive && !pagamento.confirmed ? 'Não recebi isto' : 'Apagar'
                      }
                      onPress={() =>
                        Alert.alert(
                          'Apagar este pagamento?',
                          'Os saldos voltam ao que estavam antes dele.',
                          [
                            { text: 'Deixa estar', style: 'cancel' },
                            {
                              text: 'Apagar',
                              style: 'destructive',
                              onPress: () => void tratar(() => removeTripSettlement(pagamento.id)),
                            },
                          ]
                        )
                      }
                    />
                  ) : null}
                </Card>
              ))}
            </>
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
                {[
                  `pôs ${formatarCentimos(pessoa.paidCents)}`,
                  `coube-lhe ${formatarCentimos(pessoa.owedCents)}`,
                  pessoa.settledCents > 0
                    ? `já entregou ${formatarCentimos(pessoa.settledCents)}`
                    : pessoa.settledCents < 0
                      ? `já recebeu ${formatarCentimos(-pessoa.settledCents)}`
                      : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
                {despesa.source === 'boleia' ? (
                  <ThemedText type="small" themeColor="textMuted">
                    Vem da boleia: combustível e portagens, como ficou quando foi publicada, e
                    dividida só por quem vai no carro. Quem entrou nestas contas sem ir na boleia
                    fica de fora desta despesa.
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textMuted">
                  {`pagou ${despesa.payerId === userId ? 'ti' : despesa.payerName} · ${
                    despesa.participants === gente.length
                      ? 'a viagem toda'
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

          <SectionHeader title="Quem entra nestas contas" trailing={String(gente.length)} />
          <Card style={styles.cartao}>
            <ThemedText themeColor="textSecondary">
              Estas contas são desta malta — venha ela do carro, do grupo ou de lado nenhum. Quem
              entrar aqui passa a poder lançar despesas e a entrar nas divisões que escolherem.
            </ThemedText>
            {gente.map((pessoa) => (
              <View key={pessoa.profileId} style={styles.linha}>
                <ThemedText style={styles.flex} numberOfLines={1}>
                  {pessoa.isMe ? `${pessoa.displayName} (tu)` : pessoa.displayName}
                </ThemedText>
                {gente.length > 1 && sessionId ? (
                  <LinkTexto
                    label="Tirar"
                    onPress={() => void tratar(() => removeTripPerson(sessionId, pessoa.profileId))}
                  />
                ) : null}
              </View>
            ))}
          </Card>

          {(porAcrescentar.data ?? []).length > 0 && sessionId ? (
            <Card style={styles.cartao}>
              <ThemedText type="smallBold">Acrescentar quem também foi</ThemedText>
              {(porAcrescentar.data ?? []).map((pessoa) => (
                <View key={pessoa.profileId} style={styles.linha}>
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={1}>{pessoa.displayName}</ThemedText>
                    <ThemedText type="small" themeColor="textMuted">
                      {pessoa.reason === 'amigo'
                        ? 'teu amigo'
                        : pessoa.reason === 'boleia'
                          ? 'vai no carro'
                          : 'de um grupo teu'}
                    </ThemedText>
                  </View>
                  <LinkTexto
                    label="Acrescentar"
                    onPress={() => void tratar(() => addTripPerson(sessionId, pessoa.profileId))}
                  />
                </View>
              ))}
            </Card>
          ) : null}

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
                  label={pessoa.isMe ? 'Eu' : pessoa.displayName}
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
                  label={pessoa.isMe ? 'Eu' : pessoa.displayName}
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

      {sessionId && (despesas.data ?? []).every((despesa) => despesa.source === 'boleia') ? (
        <Card style={styles.cartao}>
          <LinkTexto
            label="Apagar estas contas"
            onPress={() =>
              Alert.alert(
                'Apagar estas contas?',
                'Ainda não têm nada lançado, por isso não se perde dinheiro nenhum.',
                [
                  { text: 'Deixa estar', style: 'cancel' },
                  {
                    text: 'Apagar',
                    style: 'destructive',
                    onPress: () =>
                      void tratar(() => removeTripSession(sessionId)).then((feito) => {
                        if (feito) router.back();
                      }),
                  },
                ]
              )
            }
          />
        </Card>
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      <ThemedText type="small" themeColor="textMuted">
        A app não move dinheiro nenhum: diz quem paga a quem e guarda o que já foi pago. As contas
        ficam aqui muito depois do jogo.
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
