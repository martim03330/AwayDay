import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { nomeDoJogo, quandoEOnde } from '@/features/groups/components/CartaoDoPlano';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { addTripPerson } from '@/features/trips/api';
import {
  useRefreshTrips,
  useTripPeople,
  useTripPeopleToAdd,
  useTripSessionCard,
} from '@/features/trips/hooks/useTrips';
import { mensagemDeRecusaDasContas } from '@/features/trips/recusas';
import { useTheme } from '@/hooks/use-theme';
import { parteDeCada } from '@/lib/acerto';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterJogo } from '@/mocks/jogos';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons, type IconName } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** "Deves 12,50 €", "Tens a receber 12,50 €", "Estás em dia". */
function comoEstaOSaldo(centimos: number) {
  if (centimos === 0) return 'Estás em dia';
  return centimos > 0
    ? `Tens a receber ${formatarCentimos(centimos)}`
    : `Deves ${formatarCentimos(-centimos)}`;
}

/** "15,00 €" ou "cerca de 15,00 €", quando a divisão não dá certa ao cêntimo. */
function parteDaBoleia(centimos: number, pessoas: number) {
  const { base, comMaisUmCentimo } = parteDeCada(centimos, pessoas);
  return comMaisUmCentimo === 0 ? formatarCentimos(base) : `cerca de ${formatarCentimos(base)}`;
}

/**
 * A sessão da viagem: o que a malta precisa de ter à mão no dia — quem vai, a que horas sai o carro, quem deu a
 * boleia (para ninguém se esquecer de lhe pagar) e as despesas. Nada de tascos nem mapas: isso vive no jogo.
 */
export default function SessaoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const refrescar = useRefreshTrips();
  const { sessaoId } = useLocalSearchParams<{ sessaoId?: string }>();

  const { card: sessao, isLoading } = useTripSessionCard(sessaoId ?? null);
  const pessoas = useTripPeople(sessaoId ?? null);
  const porAcrescentar = useTripPeopleToAdd(sessaoId ?? null);
  const cartoes = useProfileCards((pessoas.data ?? []).map((pessoa) => pessoa.profileId));
  const [aTratar, setATratar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!userId || !sessao) {
    return (
      <Screen>
        {isLoading ? (
          <ThemedText themeColor="textSecondary">A abrir a viagem…</ThemedText>
        ) : (
          <EmptyState
            icon={icons.naoEncontrado}
            title="Esta viagem não é tua"
            message="A sessão é de quem vai. Se foste tirado, pede a alguém da malta para te pôr outra vez."
            action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
          />
        )}
      </Screen>
    );
  }

  const jogo = obterJogo(sessao.fixtureId);
  const inicio = new Date(jogo?.inicio ?? sessao.kickoffAt);
  const boleia = sessao.ride;
  const fotoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId)?.avatarUrl;

  async function acrescentar(profileId: string) {
    if (!sessaoId) return;
    setErro(null);
    setATratar(profileId);
    try {
      await addTripPerson(sessaoId, profileId);
      await refrescar();
    } catch (problema) {
      setErro(mensagemDeRecusaDasContas(problema));
    } finally {
      setATratar(null);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: sessao.name }} />

      <View style={[styles.topo, { backgroundColor: theme.accent }]}>
        <ThemedText type="eyebrow" style={{ color: theme.highlight }}>
          A viagem está aberta
        </ThemedText>
        <ThemedText type="title" style={{ color: theme.accentText }}>
          {nomeDoJogo(sessao.fixtureId)}
        </ThemedText>
        <ThemedText style={{ color: theme.accentText }}>{quandoEOnde(sessao)}</ThemedText>
      </View>

      <SectionHeader title="As horas" />
      <Card style={styles.cartao}>
        {boleia ? (
          <Hora
            icon={icons.carro}
            hora={formatarDiaEHora(new Date(boleia.departureAt))}
            texto={
              boleia.iDrive
                ? `Sais tu com o carro${boleia.originName ? `, de ${boleia.originName}` : ''}.`
                : `O carro de ${boleia.driverName} sai${boleia.originName ? ` de ${boleia.originName}` : ''}.`
            }
          />
        ) : null}
        <Hora
          icon={icons.jogos}
          hora={jogo && !jogo.horaConfirmada ? 'Hora por definir' : formatarDiaEHora(inicio)}
          texto="Apito inicial."
        />
        <View style={[styles.aviso, { backgroundColor: theme.warningBackground }]}>
          <Icon name={icons.horario} size={16} color={theme.warningText} />
          <ThemedText type="small" style={[styles.flex, { color: theme.warningText }]}>
            {boleia
              ? 'Estejam no ponto de encontro 10 minutos antes: o carro não espera por ninguém.'
              : 'Combinem na conversa do grupo onde se encontram e a que horas.'}
          </ThemedText>
        </View>
      </Card>

      {boleia ? (
        <>
          <SectionHeader title="A boleia" />
          <Card style={styles.cartao}>
            <View style={styles.linha}>
              <Avatar nome={boleia.driverName} url={fotoDe(boleia.driverId)} size={44} />
              <View style={styles.flex}>
                <ThemedText style={styles.negrito}>
                  {boleia.iDrive ? 'Deste a boleia' : `Quem deu a boleia: ${boleia.driverName}`}
                </ThemedText>
                {boleia.cents !== null && boleia.people ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {`${formatarCentimos(boleia.cents)} de combustível e portagens · ${parteDaBoleia(boleia.cents, boleia.people)} cada`}
                  </ThemedText>
                ) : null}
              </View>
            </View>
            {!boleia.iDrive ? (
              <View style={[styles.aviso, { backgroundColor: theme.successBackground }]}>
                <Icon name={icons.preco} size={16} color={theme.accentInk} />
                <ThemedText type="small" style={[styles.flex, { color: theme.accentInk }]}>
                  {`Não te esqueças de pagar a tua parte a ${boleia.driverName}. Já está nas despesas.`}
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                A parte de cada um já está nas despesas: quando te pagarem, marca como recebido.
              </ThemedText>
            )}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Quem vai" trailing={String(sessao.people)} />
      <Card style={styles.cartao}>
        <View style={styles.gente}>
          {(pessoas.data ?? []).map((pessoa) => (
            <View key={pessoa.profileId} style={styles.pessoa}>
              <Avatar nome={pessoa.displayName} url={fotoDe(pessoa.profileId)} size={44} />
              <ThemedText type="small" numberOfLines={1} style={styles.nomePessoa}>
                {pessoa.isMe ? 'Tu' : pessoa.displayName.split(' ')[0]}
              </ThemedText>
            </View>
          ))}
        </View>
        {(porAcrescentar.data ?? []).length > 0 ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Veio mais alguém?
            </ThemedText>
            <View style={styles.acoes}>
              {(porAcrescentar.data ?? []).map((pessoa) => (
                <LinkTexto
                  key={pessoa.profileId}
                  label={
                    aTratar === pessoa.profileId ? 'A acrescentar…' : `+ ${pessoa.displayName}`
                  }
                  onPress={() => void acrescentar(pessoa.profileId)}
                />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <SectionHeader title="Despesas" />
      <Card style={styles.cartao}>
        <View style={styles.linha}>
          <View style={styles.flex}>
            <ThemedText type="subtitle">{formatarCentimos(sessao.totalCents)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {sessao.expenses === 0
                ? 'Ainda nada lançado'
                : plural(sessao.expenses, 'despesa lançada', 'despesas lançadas')}
            </ThemedText>
          </View>
          <View
            style={[
              styles.saldo,
              {
                backgroundColor:
                  sessao.myBalanceCents < 0
                    ? theme.warningBackground
                    : sessao.myBalanceCents > 0
                      ? theme.successBackground
                      : theme.backgroundSelected,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={{
                color:
                  sessao.myBalanceCents < 0
                    ? theme.warningText
                    : sessao.myBalanceCents > 0
                      ? theme.accentInk
                      : theme.textSecondary,
              }}>
              {comoEstaOSaldo(sessao.myBalanceCents)}
            </ThemedText>
          </View>
        </View>
        <Button
          label="Abrir as despesas"
          icon={icons.preco}
          onPress={() =>
            router.push({
              pathname: '/sessao/[sessaoId]/despesas',
              params: { sessaoId: sessao.sessionId },
            })
          }
        />
      </Card>

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      <View style={styles.acoes}>
        <LinkTexto
          neutro
          label="Ver o jogo"
          onPress={() =>
            router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: sessao.fixtureId } })
          }
        />
        {sessao.groupId ? (
          <LinkTexto
            neutro
            label="Conversa do grupo"
            onPress={() => {
              const grupoId = sessao.groupId;
              if (grupoId) router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });
            }}
          />
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
        Esta página fica aberta até três dias depois do jogo. As contas não se apagam.
      </ThemedText>
    </Screen>
  );
}

function Hora({ icon, hora, texto }: { icon: IconName; hora: string; texto: string }) {
  const theme = useTheme();
  return (
    <View style={styles.linha}>
      <View style={[styles.azulejo, { backgroundColor: theme.successBackground }]}>
        <Icon name={icon} size={18} color={theme.accentInk} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.negrito}>{hora}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {texto}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topo: {
    gap: Spacing.one,
    padding: Spacing.threeAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  cartao: {
    gap: Spacing.twoAndHalf,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  flex: {
    flex: 1,
  },
  negrito: {
    fontWeight: 700,
  },
  centro: {
    textAlign: 'center',
  },
  azulejo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.twoAndHalf,
    borderRadius: Radius.field,
  },
  gente: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  pessoa: {
    alignItems: 'center',
    gap: Spacing.one,
    width: 56,
  },
  nomePessoa: {
    textAlign: 'center',
  },
  saldo: {
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
