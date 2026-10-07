import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  addTripSettlement,
  confirmTripSettlement,
  removeTripExpense,
  removeTripSettlement,
  type TripExpense,
} from '@/features/trips/api';
import { CATEGORIA } from '@/features/trips/categorias';
import { fecharContas } from '@/features/trips/fecharContas';
import {
  useRefreshTrips,
  useTripBalances,
  useTripExpenses,
  useTripSessionCard,
  useTripSettlements,
} from '@/features/trips/hooks/useTrips';
import { casaLancadaAMao, notaDaOrigem } from '@/features/trips/origem';
import { mensagemDeRecusaDasContas } from '@/features/trips/recusas';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { SectionHeader } from '@/ui/section-header';
import { Segmentado } from '@/ui/segmentado';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

type Vista = 'lista' | 'acertar';

const VISTAS = [
  { valor: 'lista', label: 'Lista' },
  { valor: 'acertar', label: 'Acertar contas' },
] as const;

/**
 * The trip's expenses: the total on top, then two views — the **list** of what was added and **settle up** (who pays
 * whom). One fixed action at the bottom: add an expense.
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

  const pastilha = (
    chave: string,
    label: string,
    acao: () => Promise<void>,
    neutra = false,
    accessibilityLabel?: string
  ) => (
    <Pressable
      hitSlop={6}
      disabled={aTratar !== null}
      onPress={() => void tratar(chave, acao)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.pastilha,
        { backgroundColor: neutra ? theme.backgroundSelected : theme.successBackground },
        pressed && styles.apagado,
      ]}>
      <ThemedText
        type="smallBold"
        style={{ color: neutra ? theme.textSecondary : theme.accentInk }}>
        {aTratar === chave ? '…' : label}
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={[styles.tudo, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.conteudo}>
        <View style={styles.resumo}>
          <ThemedText type="subtitle" style={styles.valor}>
            {formatarCentimos(sessao.totalCents)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${plural(lista.length, 'despesa', 'despesas')} · ${plural(sessao.people, 'pessoa', 'pessoas')}`}
          </ThemedText>
        </View>

        <Segmentado opcoes={VISTAS} valor={vista} onChange={setVista} />

        {erro ? <MensagemErro>{erro}</MensagemErro> : null}

        {vista === 'lista' && casaLancadaAMao(lista) ? (
          <Aviso
            title="A casa está duas vezes"
            message="A casa reservada já entrou sozinha nas contas. Quem lançou a despesa de casa à mão pode apagá-la, tocando nela sem largar."
          />
        ) : null}

        {vista === 'lista' ? (
          lista.length === 0 ? (
            <View style={[styles.vazio, { borderColor: theme.borderStrong }]}>
              <Icon name={icons.brinde} size={28} color={theme.textMuted} />
              <ThemedText themeColor="textSecondary" style={styles.centro}>
                Ainda nada lançado.
              </ThemedText>
            </View>
          ) : (
            <Card style={styles.grupo}>
              {lista.map((despesa, indice) => (
                <Pressable
                  key={despesa.id}
                  onLongPress={despesa.mine ? () => apagarDespesa(despesa) : undefined}
                  accessibilityHint={despesa.mine ? 'Toca sem largar para apagar.' : undefined}
                  // The same delete as the long press, reachable from the screen reader's actions menu.
                  accessibilityActions={despesa.mine ? [{ name: 'apagar', label: 'Apagar despesa' }] : undefined}
                  onAccessibilityAction={(evento) => {
                    if (despesa.mine && evento.nativeEvent.actionName === 'apagar') apagarDespesa(despesa);
                  }}
                  style={aTratar === despesa.id && styles.apagado}>
                  <LinhaGrupo
                    separador={indice < lista.length - 1}
                    leading={<IconCircle name={CATEGORIA[despesa.category].icon} tone="neutral" />}
                    title={despesa.description}
                    subtitle={[
                      `${quem(despesa.payerId, despesa.payerName)} ${despesa.payerId === userId ? 'pagaste' : 'pagou'}`,
                      despesa.participants === sessao.people
                        ? 'toda a malta'
                        : plural(despesa.participants, 'pessoa', 'pessoas'),
                      notaDaOrigem(despesa.source),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={
                      <ThemedText type="smallBold" style={styles.valor}>
                        {formatarCentimos(despesa.cents)}
                      </ThemedText>
                    }
                  />
                </Pressable>
              ))}
            </Card>
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
                    : 'Ninguém deve nada a ninguém.'}
                </ThemedText>
              </View>
            ) : (
              <Card style={styles.grupo}>
                {acerto.map((transferencia, indice) => {
                  const pago = transferencia.deId === userId;
                  const recebo = transferencia.paraId === userId;
                  const chave = `${transferencia.deId}-${transferencia.paraId}`;
                  const valor = formatarCentimos(transferencia.centimos);
                  const de = transferencia.deNome.split(' ')[0];
                  const para = transferencia.paraNome.split(' ')[0];
                  return (
                    <LinhaGrupo
                      key={chave}
                      separador={indice < acerto.length - 1}
                      leading={
                        <Avatar
                          nome={pago ? transferencia.paraNome : transferencia.deNome}
                          size={36}
                        />
                      }
                      title={pago ? `Deves ${valor}` : recebo ? `${de} deve-te ${valor}` : `${de} deve ${valor}`}
                      subtitle={pago ? `a ${para}` : recebo ? undefined : `a ${para}`}
                      trailing={
                        pago || recebo
                          ? pastilha(
                              chave,
                              pago ? 'Já paguei' : 'Já recebi',
                              () =>
                                addTripSettlement(
                                  sessaoId,
                                  transferencia.paraId,
                                  transferencia.centimos,
                                  transferencia.deId
                                ).then(() => undefined)
                            )
                          : undefined
                      }
                    />
                  );
                })}
              </Card>
            )}

            {porConfirmar.length > 0 ? (
              <>
                <SectionHeader title="Por confirmar" />
                <Card style={styles.grupo}>
                  {porConfirmar.map((pagamento, indice) => (
                    <LinhaGrupo
                      key={pagamento.id}
                      separador={indice < porConfirmar.length - 1}
                      leading={<IconCircle name={icons.horario} tone="yellow" />}
                      title={
                        pagamento.iReceive
                          ? `${pagamento.fromName.split(' ')[0]} pagou-te ${formatarCentimos(pagamento.cents)}`
                          : `Pagaste ${formatarCentimos(pagamento.cents)} a ${pagamento.toName.split(' ')[0]}`
                      }
                      subtitle={pagamento.iReceive ? 'Confirma que recebeste' : 'Falta confirmar'}
                      trailing={
                        pagamento.iReceive
                          ? pastilha(pagamento.id, 'Recebi', () =>
                              confirmTripSettlement(pagamento.id)
                            )
                          : pagamento.mine
                            ? pastilha(
                                pagamento.id,
                                'Anular',
                                () => removeTripSettlement(pagamento.id),
                                true,
                                'Anular este pagamento'
                              )
                            : undefined
                      }
                    />
                  ))}
                </Card>
              </>
            ) : null}

            <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
              A app não move dinheiro: só diz quem paga a quem.
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
        <Button
          label="Juntar despesa"
          icon={icons.preco}
          onPress={() =>
            router.push({
              pathname: '/sessao/[sessaoId]/nova-despesa',
              params: { sessaoId },
            })
          }
        />
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
  resumo: {
    gap: Spacing.half,
  },
  grupo: {
    gap: 0,
    paddingVertical: Spacing.one,
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
});
