import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { nomeDoJogo } from '@/features/groups/components/CartaoDoPlano';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { addTripPerson, removeTripPerson } from '@/features/trips/api';
import { fecharContas, juntarNomes } from '@/features/trips/fecharContas';
import {
  useRefreshTrips,
  useTripBalances,
  useTripPeople,
  useTripPeopleToAdd,
  useTripSessionCard,
} from '@/features/trips/hooks/useTrips';
import { mensagemDeRecusaDasContas } from '@/features/trips/recusas';
import { useTheme } from '@/hooks/use-theme';
import { parteDeCada } from '@/lib/acerto';
import { formatarDiaEHora } from '@/lib/datas';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

/** "15,00 €" ou "cerca de 15,00 €", quando a divisão não dá certa ao cêntimo. */
function parteDaBoleia(centimos: number, pessoas: number) {
  const { base, comMaisUmCentimo } = parteDeCada(centimos, pessoas);
  return comMaisUmCentimo === 0 ? formatarCentimos(base) : `cerca de ${formatarCentimos(base)}`;
}

/**
 * The trip session. What matters most comes first: how much you owe or are owed (and to whom), with one action to
 * add an expense; then the day (car and kick-off) and who is going.
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
  const saldos = useTripBalances(sessaoId ?? null);
  const cartoes = useProfileCards((pessoas.data ?? []).map((pessoa) => pessoa.profileId));
  const [aTratar, setATratar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // No grupo não há cuidados como nas boleias públicas: quem estava na lista e não veio, sai com um toque.
  const [aTirar, setATirar] = useState(false);
  const [aAcrescentar, setAAcrescentar] = useState(false);

  if (!userId || !sessao) {
    return (
      <Screen>
        {isLoading ? (
          <ThemedText themeColor="textSecondary">A abrir a viagem…</ThemedText>
        ) : (
          <EmptyState
            icon={icons.naoEncontrado}
            title="Esta viagem não é tua"
            message="Se foste tirado, pede a alguém da malta para te pôr outra vez."
            action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
          />
        )}
      </Screen>
    );
  }

  const jogo = obterJogo(sessao.fixtureId);
  const inicio = new Date(jogo?.inicio ?? sessao.kickoffAt);
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const boleia = sessao.ride;
  const gente = pessoas.data ?? [];
  const paraAcrescentar = porAcrescentar.data ?? [];
  const fotoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId)?.avatarUrl;

  // Who I pay or who pays me, from the server's balances (the amount itself is the server's).
  const transferencias = fecharContas(saldos.data ?? []) ?? [];
  const saldo = sessao.myBalanceCents;
  const comQuem =
    saldo < 0
      ? juntarNomes(transferencias.filter((t) => t.deId === userId).map((t) => t.paraNome))
      : saldo > 0
        ? juntarNomes(transferencias.filter((t) => t.paraId === userId).map((t) => t.deNome))
        : '';

  const abrirDespesas = () =>
    router.push({
      pathname: '/sessao/[sessaoId]/despesas',
      params: { sessaoId: sessao.sessionId },
    });

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

  const tirar = (profileId: string, nome: string) =>
    Alert.alert(
      `${nome} não veio?`,
      'Sai da viagem e das contas. Se já tiver despesas lançadas, apaguem-nas primeiro.',
      [
        { text: 'Deixa estar', style: 'cancel' },
        {
          text: 'Tirar',
          style: 'destructive',
          onPress: () => {
            if (!sessaoId) return;
            setErro(null);
            setATratar(profileId);
            removeTripPerson(sessaoId, profileId)
              .then(() => refrescar())
              .catch((problema: unknown) => setErro(mensagemDeRecusaDasContas(problema)))
              .finally(() => setATratar(null));
          },
        },
      ]
    );

  const chevron = <Icon name={icons.seguinte} size={18} color={theme.textMuted} />;

  const subtituloDaBoleia = boleia
    ? [
        boleia.iDrive ? 'Levas tu o carro' : `Carro de ${boleia.driverName}`,
        boleia.originName ? `de ${boleia.originName}` : null,
        boleia.cents !== null && boleia.people
          ? `${parteDaBoleia(boleia.cents, boleia.people)} cada`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Screen>
      <Stack.Screen options={{ title: sessao.name }} />

      <View
        accessible
        accessibilityLabel={
          saldo === 0
            ? sessao.expenses === 0
              ? 'Ainda sem despesas'
              : 'Estás em dia'
            : `${saldo < 0 ? 'Deves' : 'Tens a receber'} ${formatarCentimos(Math.abs(saldo))}${
                comQuem ? (saldo < 0 ? ` a ${comQuem}` : ` de ${comQuem}`) : ''
              }`
        }
        style={[styles.topo, { backgroundColor: theme.accent }]}>
        <ThemedText type="eyebrow" style={{ color: theme.accentText }}>
          {nomeDoJogo(sessao.fixtureId)}
        </ThemedText>
        {saldo === 0 ? (
          <ThemedText type="subtitle" style={{ color: theme.accentText }}>
            {sessao.expenses === 0 ? 'Ainda sem despesas' : 'Estás em dia'}
          </ThemedText>
        ) : (
          <>
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>
              {saldo < 0 ? 'Deves' : 'Tens a receber'}
            </ThemedText>
            <ThemedText type="title" style={[styles.valor, { color: theme.accentText }]}>
              {formatarCentimos(Math.abs(saldo))}
            </ThemedText>
            {comQuem ? (
              <ThemedText style={{ color: theme.accentText }}>
                {saldo < 0 ? `a ${comQuem}` : `de ${comQuem}`}
              </ThemedText>
            ) : null}
          </>
        )}
      </View>

      <Button
        label="Juntar despesa"
        icon={icons.preco}
        onPress={() =>
          router.push({
            pathname: '/sessao/[sessaoId]/nova-despesa',
            params: { sessaoId: sessao.sessionId },
          })
        }
      />
      <LinkTexto
        neutro
        label={
          sessao.expenses === 0
            ? 'Ver as despesas'
            : `Ver as despesas · ${formatarCentimos(sessao.totalCents)}`
        }
        onPress={abrirDespesas}
      />

      <SectionHeader title="O dia" />
      <Card style={styles.grupo}>
        {boleia ? (
          <LinhaGrupo
            separador
            onPress={() =>
              router.push({
                pathname: '/jogos/boleia',
                params: { rideId: boleia.id, jogoId: sessao.fixtureId },
              })
            }
            accessibilityLabel={`Partida ${formatarDiaEHora(new Date(boleia.departureAt))}. ${subtituloDaBoleia}. Toca para ver a boleia.`}
            leading={<IconCircle name={icons.carro} />}
            title={formatarDiaEHora(new Date(boleia.departureAt))}
            subtitle={subtituloDaBoleia}
            trailing={chevron}
          />
        ) : null}
        <LinhaGrupo
          separador={sessao.groupId !== null}
          onPress={() =>
            router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: sessao.fixtureId } })
          }
          accessibilityLabel="Ver o jogo"
          leading={<IconCircle name={icons.jogos} />}
          title={jogo && !jogo.horaConfirmada ? 'Hora por definir' : formatarDiaEHora(inicio)}
          subtitle={estadio ? `Apito inicial · ${estadio.nome}` : 'Apito inicial'}
          trailing={chevron}
        />
        {sessao.groupId ? (
          <LinhaGrupo
            onPress={() => {
              const grupoId = sessao.groupId;
              if (grupoId) router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });
            }}
            accessibilityLabel="Abrir a conversa do grupo"
            leading={<IconCircle name={icons.conversa} tone="neutral" />}
            title="Conversa do grupo"
            subtitle="Combinem onde e a que horas se encontram"
            trailing={chevron}
          />
        ) : null}
      </Card>

      {gente.length > 0 ? (
        <>
          <SectionHeader title="Quem vai" trailing={String(sessao.people)} />
          <Card style={styles.grupo}>
            {gente.map((pessoa, indice) => (
              <LinhaGrupo
                key={pessoa.profileId}
                separador={indice < gente.length - 1}
                leading={
                  <Avatar nome={pessoa.displayName} url={fotoDe(pessoa.profileId)} size={36} />
                }
                title={pessoa.isMe ? `${pessoa.displayName} (tu)` : pessoa.displayName}
                subtitle={boleia?.driverId === pessoa.profileId ? 'Leva o carro' : undefined}
                trailing={
                  aTirar && !pessoa.isMe ? (
                    <Pressable
                      hitSlop={6}
                      onPress={() => tirar(pessoa.profileId, pessoa.displayName)}
                      disabled={aTratar !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`${pessoa.displayName} não veio`}
                      style={({ pressed }) => [
                        styles.naoVeio,
                        { backgroundColor: theme.dangerBackground },
                        pressed && styles.premido,
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.dangerText }}>
                        {aTratar === pessoa.profileId ? 'A tirar…' : 'Não veio'}
                      </ThemedText>
                    </Pressable>
                  ) : undefined
                }
              />
            ))}
          </Card>

          {aAcrescentar && paraAcrescentar.length > 0 ? (
            <View style={styles.chips}>
              {paraAcrescentar.map((pessoa) => (
                <Chip
                  key={pessoa.profileId}
                  label={aTratar === pessoa.profileId ? 'A acrescentar…' : pessoa.displayName}
                  selected={false}
                  accessibilityLabel={`Acrescentar ${pessoa.displayName}`}
                  onPress={() => {
                    if (aTratar === null) void acrescentar(pessoa.profileId);
                  }}
                />
              ))}
            </View>
          ) : null}

          {paraAcrescentar.length > 0 || gente.length > 1 ? (
            <View style={styles.acoes}>
              {paraAcrescentar.length > 0 ? (
                <LinkTexto
                  neutro={!aAcrescentar}
                  label={aAcrescentar ? 'Já está' : 'Veio mais alguém?'}
                  onPress={() => setAAcrescentar((atual) => !atual)}
                />
              ) : null}
              {gente.length > 1 ? (
                <LinkTexto
                  neutro={!aTirar}
                  label={aTirar ? 'Já está' : 'Alguém não veio?'}
                  onPress={() => setATirar((atual) => !atual)}
                />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}

      <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
        Aberta até três dias depois do jogo. As contas ficam guardadas.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topo: {
    gap: Spacing.one,
    padding: Spacing.threeAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  valor: {
    fontVariant: ['tabular-nums'],
  },
  grupo: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  naoVeio: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  premido: {
    opacity: 0.7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  centro: {
    textAlign: 'center',
  },
});
