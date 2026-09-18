import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { nomeDoJogo } from '@/features/groups/components/CartaoDoPlano';
import {
  addTripSettlement,
  confirmTripSettlement,
  removeTripExpense,
  removeTripSettlement,
  type TripBalance,
  type TripExpense,
} from '@/features/trips/api';
import { CATEGORIA } from '@/features/trips/categorias';
import {
  useRefreshTrips,
  useTripBalances,
  useTripExpenses,
  useTripSessionCard,
  useTripSettlements,
} from '@/features/trips/hooks/useTrips';
import { mensagemDeRecusaDasContas } from '@/features/trips/recusas';
import { useTheme } from '@/hooks/use-theme';
import { acertarContas, type Transferencia } from '@/lib/acerto';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons } from '@/ui/icon';
import { Segmentado } from '@/ui/segmentado';
import { ThemedText } from '@/ui/themed-text';

type Vista = 'lista' | 'acertar';

const VISTAS = [
  { valor: 'lista', label: 'Lista' },
  { valor: 'acertar', label: 'Acertar contas' },
] as const;

/**
 * As transferências que fecham as contas. Os saldos do servidor somam sempre zero; se algum dia não somarem, a app
 * diz que não consegue fechar em vez de rebentar.
 */
function fecharContas(saldos: TripBalance[]): Transferencia[] | null {
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

/** A frase de cabeçalho, conforme o que já se gastou. Com humor, que o dinheiro já dói que chegue. */
function tituloComGraca(totalCentimos: number, despesas: number) {
  if (despesas === 0) return 'Ainda ninguém abriu a carteira';
  if (totalCentimos < 5000) return 'Por enquanto, só trocos';
  if (totalCentimos < 20000) return 'A carteira já sentiu';
  return 'A carteira já chora';
}

/**
 * As despesas da viagem, numa página só: em cima, quanto se gastou; depois duas vistas — a **lista** do que foi
 * lançado e **acertar contas** (quem paga a quem). Em baixo, fixo, o botão que interessa em cada vista.
 */
export default function DespesasScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const refrescar = useRefreshTrips();
  const { sessaoId } = useLocalSearchParams<{ sessaoId?: string }>();

  const { card: sessao, isLoading } = useTripSessionCard(sessaoId ?? null);
  const despesas = useTripExpenses(sessaoId ?? null);
  const saldos = useTripBalances(sessaoId ?? null);
  const pagamentos = useTripSettlements(sessaoId ?? null);

  const [vista, setVista] = useState<Vista>('lista');
  const [aTratar, setATratar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!userId || !sessaoId || !sessao) {
    return (
      <View style={[styles.tudo, { backgroundColor: theme.background }]}>
        {isLoading ? null : (
          <EmptyState
            icon={icons.preco}
            title="Despesas não encontradas"
            message="As despesas vivem na sessão da viagem, que abre na véspera do jogo."
            action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
          />
        )}
      </View>
    );
  }

  const lista = despesas.data ?? [];
  const acerto = fecharContas(saldos.data ?? []);
  const porConfirmar = (pagamentos.data ?? []).filter((pagamento) => !pagamento.confirmed);
  const tudoAcertado = acerto !== null && acerto.length === 0 && lista.length > 0;

  async function tratar(chave: string, acao: () => Promise<void>) {
    setErro(null);
    setATratar(chave);
    try {
      await acao();
      await refrescar();
    } catch (problema) {
      setErro(mensagemDeRecusaDasContas(problema));
    } finally {
      setATratar(null);
    }
  }

  const apagarDespesa = (despesa: TripExpense) =>
    Alert.alert(
      'Apagar esta despesa?',
      `«${despesa.description}» sai das contas e os saldos mudam.`,
      [
        { text: 'Deixa estar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () => void tratar(despesa.id, () => removeTripExpense(despesa.id)),
        },
      ]
    );

  const quem = (id: string, nome: string) => (id === userId ? 'Tu' : nome.split(' ')[0]);

  return (
    <View style={[styles.tudo, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.conteudo}>
        <View style={[styles.topo, { backgroundColor: theme.accent }]}>
          <ThemedText type="eyebrow" style={{ color: theme.highlight }}>
            {`Despesas · ${nomeDoJogo(sessao.fixtureId)}`}
          </ThemedText>
          <ThemedText type="title" style={{ color: theme.accentText }}>
            {tituloComGraca(sessao.totalCents, lista.length)}
          </ThemedText>
          <ThemedText style={{ color: theme.accentText }}>
            {`${formatarCentimos(sessao.totalCents)} em ${plural(lista.length, 'despesa', 'despesas')} · ${plural(sessao.people, 'pessoa', 'pessoas')}`}
          </ThemedText>
        </View>

        <Segmentado opcoes={VISTAS} valor={vista} onChange={setVista} />

        {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

        {vista === 'lista' ? (
          lista.length === 0 ? (
            <View style={[styles.vazio, { borderColor: theme.borderStrong }]}>
              <Icon name={icons.brinde} size={28} color={theme.textMuted} />
              <ThemedText themeColor="textSecondary" style={styles.centro}>
                Nada lançado. A primeira rodada costuma vir já a seguir.
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.lista, { backgroundColor: theme.backgroundElement }]}>
              {lista.map((despesa, indice) => (
                <Pressable
                  key={despesa.id}
                  onLongPress={despesa.mine ? () => apagarDespesa(despesa) : undefined}
                  accessibilityHint={despesa.mine ? 'Toca sem largar para apagar.' : undefined}
                  style={[
                    styles.linhaDespesa,
                    indice > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.border,
                    },
                    aTratar === despesa.id && styles.apagado,
                  ]}>
                  <View style={[styles.azulejo, { backgroundColor: theme.backgroundSelected }]}>
                    <Icon
                      name={CATEGORIA[despesa.category].icon}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {despesa.description}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {`${quem(despesa.payerId, despesa.payerName)} ${despesa.payerId === userId ? 'pagaste' : 'pagou'} · ${
                        despesa.participants === sessao.people
                          ? 'toda a malta'
                          : plural(despesa.participants, 'pessoa', 'pessoas')
                      }`}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={styles.valor}>
                    {formatarCentimos(despesa.cents)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )
        ) : acerto === null ? (
          <ThemedText themeColor="textSecondary">
            Não estamos a conseguir fechar estas contas. Atualiza daqui a pouco.
          </ThemedText>
        ) : (
          <>
            {acerto.length === 0 ? (
              <View style={[styles.vazio, { borderColor: theme.borderStrong }]}>
                <Icon name={icons.selecionado} size={28} color={theme.accentInk} />
                <ThemedText themeColor="textSecondary" style={styles.centro}>
                  {lista.length === 0
                    ? 'Sem despesas, não há contas para acertar.'
                    : 'Ninguém deve nada a ninguém. Isto é que é amizade.'}
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.lista, { backgroundColor: theme.backgroundElement }]}>
                {acerto.map((transferencia, indice) => {
                  const pago = transferencia.deId === userId;
                  const recebo = transferencia.paraId === userId;
                  const chave = `${transferencia.deId}-${transferencia.paraId}`;
                  return (
                    <View
                      key={chave}
                      style={[
                        styles.linhaDespesa,
                        indice > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: theme.border,
                        },
                      ]}>
                      <View style={styles.flex}>
                        <ThemedText type="small" numberOfLines={2}>
                          {pago
                            ? 'Deves '
                            : `${transferencia.deNome.split(' ')[0]} ${recebo ? 'deve-te' : 'deve'} `}
                          <ThemedText type="smallBold">
                            {formatarCentimos(transferencia.centimos)}
                          </ThemedText>
                          {recebo ? '' : ` a ${transferencia.paraNome.split(' ')[0]}`}
                        </ThemedText>
                      </View>
                      {pago || recebo ? (
                        <Pressable
                          disabled={aTratar !== null}
                          onPress={() =>
                            void tratar(chave, () =>
                              addTripSettlement(
                                sessaoId,
                                transferencia.paraId,
                                transferencia.centimos,
                                transferencia.deId
                              ).then(() => undefined)
                            )
                          }
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.pastilha,
                            { backgroundColor: theme.successBackground },
                            pressed && styles.apagado,
                          ]}>
                          <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                            {aTratar === chave ? '…' : pago ? 'Já paguei' : 'Já recebi'}
                          </ThemedText>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {porConfirmar.length > 0 ? (
              <View style={[styles.lista, { backgroundColor: theme.backgroundElement }]}>
                {porConfirmar.map((pagamento, indice) => (
                  <View
                    key={pagamento.id}
                    style={[
                      styles.linhaDespesa,
                      indice > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: theme.border,
                      },
                    ]}>
                    <Icon name={icons.horario} size={18} color={theme.warningText} />
                    <ThemedText type="small" style={styles.flex}>
                      {pagamento.iReceive
                        ? `${pagamento.fromName.split(' ')[0]} diz que te pagou ${formatarCentimos(pagamento.cents)}`
                        : `Pagaste ${formatarCentimos(pagamento.cents)} a ${pagamento.toName.split(' ')[0]} · falta confirmar`}
                    </ThemedText>
                    {pagamento.iReceive ? (
                      <Pressable
                        disabled={aTratar !== null}
                        onPress={() =>
                          void tratar(pagamento.id, () => confirmTripSettlement(pagamento.id))
                        }
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.pastilha,
                          { backgroundColor: theme.successBackground },
                          pressed && styles.apagado,
                        ]}>
                        <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                          Recebi
                        </ThemedText>
                      </Pressable>
                    ) : pagamento.mine ? (
                      <Pressable
                        disabled={aTratar !== null}
                        onPress={() =>
                          void tratar(pagamento.id, () => removeTripSettlement(pagamento.id))
                        }
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.pastilha,
                          { backgroundColor: theme.backgroundSelected },
                          pressed && styles.apagado,
                        ]}>
                        <ThemedText type="smallBold" themeColor="textSecondary">
                          Anular
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
              A app não move dinheiro: diz quem paga a quem e guarda o que já foi pago.
            </ThemedText>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.rodape,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, Spacing.three),
          },
        ]}>
        {vista === 'lista' ? (
          <Button
            label="Adicionar despesa"
            icon={icons.preco}
            onPress={() =>
              router.push({
                pathname: '/sessao/[sessaoId]/nova-despesa',
                params: { sessaoId },
              })
            }
          />
        ) : (
          <View
            accessibilityRole="text"
            style={[
              styles.estado,
              { backgroundColor: tudoAcertado ? theme.accent : theme.warningBackground },
            ]}>
            <Icon
              name={tudoAcertado ? icons.selecionado : icons.horario}
              size={20}
              color={tudoAcertado ? theme.accentText : theme.warningText}
            />
            <ThemedText
              type="smallBold"
              style={{ color: tudoAcertado ? theme.accentText : theme.warningText }}>
              {tudoAcertado
                ? 'Contas acertadas'
                : acerto && acerto.length > 0
                  ? `Contas por acertar · ${plural(acerto.length, 'transferência', 'transferências')}`
                  : 'Contas por acertar'}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tudo: {
    flex: 1,
  },
  conteudo: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  topo: {
    gap: Spacing.one,
    padding: Spacing.threeAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  lista: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  linhaDespesa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoAndHalf,
    minHeight: 56,
  },
  azulejo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  valor: {
    fontVariant: ['tabular-nums'],
  },
  apagado: {
    opacity: 0.5,
  },
  centro: {
    textAlign: 'center',
  },
  vazio: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.card,
  },
  pastilha: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  rodape: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.twoAndHalf,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 52,
    borderRadius: Radius.button,
  },
});
