import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { CartaoDoPlano, nomeDoJogo } from '@/features/groups/components/CartaoDoPlano';
import { CasasDoPlano } from '@/features/groups/components/CasasDoPlano';
import {
  plansKey,
  useGroupPlans,
  useMyGroupInbox,
  usePlan,
  usePlanPeople,
} from '@/features/groups/hooks/useGroups';
import {
  PlanRefused,
  setPlanRide,
  setPlanStatus,
  sharePlan,
  type FixturePlan,
} from '@/features/groups/plans';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { setRideReturnRequests, setRideVisibility } from '@/features/rides/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof PlanRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_owner':
      return 'Só quem convidou é que pode fazer isso.';
    case 'plan_closed':
      return 'O plano já fechou.';
    case 'ride_not_found':
      return 'Essa boleia já não está disponível.';
    case 'rate_limited':
      return 'Já mandaste convites que cheguem por hoje.';
    default:
      return 'Não deu para fazer isso. Tenta outra vez.';
  }
}

function lugaresLivres(plano: FixturePlan) {
  return plano.ride ? Math.max(0, plano.ride.seatsOffered - plano.ride.seatsTaken) : 0;
}

/**
 * Um plano: o jogo, quem vai, e o que falta combinar — a boleia e, se for preciso, a dormida. Quem convidou pode
 * mandar o plano a outro grupo e fechá-lo; quem dá a boleia pode abri-la ao público e deixar a volta aberta.
 */
export default function PlanoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { grupoId, planoId } = useLocalSearchParams<{ grupoId?: string; planoId?: string }>();

  const { plan: plano, isLoading } = usePlan(planoId ?? null);
  const pessoas = usePlanPeople(planoId ?? null);
  const cartoes = useProfileCards((pessoas.data ?? []).map((pessoa) => pessoa.profileId));
  const inbox = useMyGroupInbox(userId !== null);
  const doGrupo = useGroupPlans(grupoId ?? null);

  const [aTratar, setATratar] = useState(false);
  const [mostrarGrupos, setMostrarGrupos] = useState(false);
  const [mandadoPara, setMandadoPara] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  if (!plano) {
    return (
      <Screen>
        {isLoading ? (
          <ThemedText themeColor="textSecondary">A abrir o plano…</ThemedText>
        ) : (
          <EmptyState
            icon={icons.naoEncontrado}
            title="Este plano já não existe"
            message="Quem convidou pode ter desistido dele."
            action={{ label: 'Voltar', onPress: () => router.back() }}
          />
        )}
      </Screen>
    );
  }

  const aberto = plano.status === 'aberto';
  const souQuemConvidou = plano.isMine;
  const souCondutor = plano.ride?.driverId === userId;
  const livres = lugaresLivres(plano);
  const vao = (pessoas.data ?? []).filter((pessoa) => pessoa.answer === 'vou');
  const aPensar = (pessoas.data ?? []).filter((pessoa) => pessoa.answer === 'talvez');
  const outrosGrupos = (inbox.data ?? []).filter((grupo) => grupo.id !== plano.groupId);
  const boleiasDoGrupo = (doGrupo.data ?? []).filter(
    (item) =>
      item.kind === 'boleia' &&
      item.fixtureId === plano.fixtureId &&
      item.id !== plano.ride?.id &&
      (souQuemConvidou || item.isMine)
  );

  async function tratar(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      await queryClient.invalidateQueries({ queryKey: plansKey() });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      void queryClient.invalidateQueries({ queryKey: ['rides'] });
      void queryClient.invalidateQueries({ queryKey: ['stays'] });
      return true;
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      return false;
    } finally {
      setATratar(false);
    }
  }

  const abrirBoleiaAoPublico = () => {
    const rideId = plano.ride?.id;
    if (rideId) void tratar(() => setRideVisibility(rideId, true));
  };

  const fechar = () => {
    const fecharJa = () => void tratar(() => setPlanStatus(plano.id, 'fechado'));

    if (!plano.ride) {
      Alert.alert(
        'Fechar sem boleia?',
        'O plano ainda não tem boleia. Podes fechá-lo na mesma — cada um vai como quiser.',
        [
          { text: 'Deixa estar', style: 'cancel' },
          { text: 'Fechar o plano', onPress: fecharJa },
        ]
      );
      return;
    }
    if (livres === 0) {
      fecharJa();
      return;
    }

    // Ainda sobram lugares: lembra o que dá para fazer, mas deixa fechar.
    const opcoes: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (souCondutor && !plano.ride.publica) {
      opcoes.push({ text: 'Abrir a boleia ao público', onPress: abrirBoleiaAoPublico });
    }
    if (outrosGrupos.length > 0) {
      opcoes.push({ text: 'Mandar a outro grupo', onPress: () => setMostrarGrupos(true) });
    }
    opcoes.push({ text: 'Fechar mesmo assim', onPress: fecharJa });
    opcoes.push({ text: 'Deixa estar', style: 'cancel' });
    Alert.alert(
      livres === 1 ? 'Ainda sobra 1 lugar no carro' : `Ainda sobram ${livres} lugares no carro`,
      'Podes chamar malta de fora — abrir a boleia ao público ou mandar o plano a outro grupo. Ou fechar assim mesmo.',
      opcoes
    );
  };

  const desistir = () =>
    Alert.alert('Desistir do plano?', 'O convite deixa de valer para toda a gente.', [
      { text: 'Deixa estar', style: 'cancel' },
      {
        text: 'Desistir',
        style: 'destructive',
        onPress: () =>
          void tratar(() => setPlanStatus(plano.id, 'cancelado')).then((feito) => {
            if (feito) router.back();
          }),
      },
    ]);

  const fotoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId)?.avatarUrl;

  return (
    <Screen>
      <CartaoDoPlano
        plano={plano}
        quemConvidou={souQuemConvidou ? 'eu' : plano.creatorName.split(' ')[0]}
        onAbrir={() =>
          router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: plano.fixtureId } })
        }
        onRespondido={() => void queryClient.invalidateQueries({ queryKey: plansKey() })}
      />

      {plano.status === 'fechado' ? (
        <Card style={styles.bloco}>
          <ThemedText type="smallBold" themeColor="accentInk">
            {plano.closedByFullCar ? 'O carro encheu: plano fechado' : 'Plano fechado'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Na véspera do jogo abre a sessão da viagem, na página dos Jogos: quem vai, quem deu a
            boleia e as despesas.
          </ThemedText>
          {souQuemConvidou ? (
            <LinkTexto
              label="Voltar a abrir o plano"
              onPress={() => void tratar(() => setPlanStatus(plano.id, 'aberto'))}
            />
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title="Quem vai" trailing={vao.length > 0 ? String(vao.length) : undefined} />
      <Card style={styles.bloco}>
        {vao.length === 0 && aPensar.length === 0 ? (
          <ThemedText themeColor="textSecondary">Ainda ninguém respondeu.</ThemedText>
        ) : null}
        {[...vao, ...aPensar].map((pessoa) => (
          <View key={pessoa.profileId} style={styles.pessoa}>
            <Avatar nome={pessoa.displayName} url={fotoDe(pessoa.profileId)} size={32} />
            <ThemedText style={styles.flex} numberOfLines={1}>
              {pessoa.isMe ? `${pessoa.displayName} (tu)` : pessoa.displayName}
            </ThemedText>
            <Etiqueta
              icon={pessoa.answer === 'vou' ? icons.selecionado : icons.horario}
              label={pessoa.answer === 'vou' ? 'Vai' : 'A pensar'}
              tone={pessoa.answer === 'vou' ? 'positivo' : 'neutro'}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title="Boleia" />
      <Card style={styles.bloco}>
        {plano.ride ? (
          <>
            <ThemedText style={styles.negrito}>
              {souCondutor ? 'Levas tu o carro' : `Boleia de ${plano.ride.driverName}`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                `sai ${formatarDiaEHora(new Date(plano.ride.departureAt)).toLowerCase()}`,
                `${plano.ride.seatsTaken} de ${plano.ride.seatsOffered} lugares ocupados`,
                `${formatarCentimos(plano.ride.shareNowCents)} cada`,
              ].join(' · ')}
            </ThemedText>
            <View style={styles.etiquetas}>
              <Etiqueta
                icon={plano.ride.publica ? icons.partilhar : icons.perfil}
                label={plano.ride.publica ? 'Aberta ao público' : 'Só da malta do plano'}
                tone={plano.ride.publica ? 'positivo' : 'info'}
              />
              {livres === 0 ? (
                <Etiqueta icon={icons.carro} label="Carro cheio" tone="positivo" />
              ) : null}
            </View>

            {souCondutor ? (
              <View style={styles.interruptores}>
                <Interruptor
                  titulo="Aberta ao público"
                  descricao="Quem não é do grupo também pode pedir lugar."
                  value={plano.ride.publica}
                  disabled={aTratar}
                  onValueChange={(ligar) => {
                    const rideId = plano.ride?.id;
                    if (rideId) void tratar(() => setRideVisibility(rideId, ligar));
                  }}
                />
                {plano.ride.roundTrip ? (
                  <Interruptor
                    titulo="Volta aberta a quem precisar"
                    descricao="Se alguém do jogo ficar sem transporte, pode pedir-te lugar no regresso."
                    value={plano.ride.acceptsReturn}
                    disabled={aTratar}
                    onValueChange={(ligar) => {
                      const rideId = plano.ride?.id;
                      if (rideId) void tratar(() => setRideReturnRequests(rideId, ligar));
                    }}
                  />
                ) : null}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textMuted">
                {plano.ride.acceptsReturn
                  ? 'A volta está aberta a quem precisar de boleia.'
                  : 'Só o condutor abre a boleia ao público ou deixa a volta aberta.'}
              </ThemedText>
            )}

            <LinkTexto
              label="Ver a boleia"
              onPress={() => {
                const rideId = plano.ride?.id;
                if (!rideId) return;
                router.push({
                  pathname: '/jogos/boleia',
                  params: { rideId, jogoId: plano.fixtureId },
                });
              }}
            />
            {souQuemConvidou || souCondutor ? (
              <LinkTexto
                neutro
                label="Tirar esta boleia do plano"
                onPress={() => void tratar(() => setPlanRide(plano.id, null))}
              />
            ) : null}
          </>
        ) : (
          <>
            <ThemedText themeColor="textSecondary">
              Ainda não há boleia. Quem levar o carro oferece-a para o grupo e ela entra aqui
              sozinha.
            </ThemedText>
            <Button
              label="Oferecer boleia"
              icon={icons.carro}
              onPress={() =>
                router.push({
                  pathname: '/jogos/oferecer-boleia',
                  params: { jogoId: plano.fixtureId, grupoId: grupoId ?? plano.groupId },
                })
              }
            />
          </>
        )}
        {boleiasDoGrupo.map((boleia) => (
          <LinkTexto
            key={boleia.id}
            label={`Usar a boleia de ${boleia.isMine ? 'ti' : boleia.ownerName}`}
            onPress={() => void tratar(() => setPlanRide(plano.id, boleia.id))}
          />
        ))}
      </Card>

      <CasasDoPlano plano={plano} grupoId={grupoId ?? plano.groupId} />

      {aberto && (souQuemConvidou || souCondutor) ? (
        <>
          <SectionHeader title="Chamar mais malta" />
          <Card style={styles.bloco}>
            {souCondutor && plano.ride && !plano.ride.publica ? (
              <Button
                label="Abrir a boleia ao público"
                variant="secondary"
                icon={icons.partilhar}
                disabled={aTratar}
                onPress={abrirBoleiaAoPublico}
              />
            ) : null}
            {souQuemConvidou && outrosGrupos.length > 0 ? (
              <>
                <Button
                  label="Mandar a outro grupo"
                  variant="secondary"
                  icon={icons.perfil}
                  disabled={aTratar}
                  onPress={() => setMostrarGrupos((atual) => !atual)}
                />
                {mostrarGrupos ? (
                  <View style={styles.etiquetas}>
                    {outrosGrupos.map((grupo) => (
                      <Chip
                        key={grupo.id}
                        label={grupo.name}
                        emCartao
                        selected={mandadoPara.includes(grupo.id)}
                        onPress={() => {
                          if (mandadoPara.includes(grupo.id)) return;
                          void tratar(() => sharePlan(plano.id, grupo.id)).then((feito) => {
                            if (feito) setMandadoPara((atuais) => [...atuais, grupo.id]);
                          });
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            <ThemedText type="small" themeColor="textMuted">
              {plano.sharedGroups > 0
                ? `Este plano já foi mandado a ${plural(plano.sharedGroups, 'outro grupo', 'outros grupos')}. Misturar grupos é boa maneira de fazer amigos.`
                : 'Misturar grupos é boa maneira de fazer amigos: quem recebe o plano vê a boleia e pode pedir lugar.'}
            </ThemedText>
          </Card>
        </>
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      {aberto && souQuemConvidou ? (
        <View style={styles.bloco}>
          <Button
            label="Fechar o plano"
            icon={icons.selecionado}
            disabled={aTratar}
            onPress={fechar}
          />
          <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
            O plano fecha sozinho quando o carro enche. Fechado o plano, a sessão da viagem abre na
            véspera do jogo.
          </ThemedText>
          <LinkTexto perigo label="Desistir do plano" onPress={desistir} />
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textMuted">
        {`Plano de ${nomeDoJogo(plano.fixtureId)}, criado por ${souQuemConvidou ? 'ti' : plano.creatorName} no grupo ${plano.groupName}.`}
      </ThemedText>
    </Screen>
  );
}

function Interruptor({
  titulo,
  descricao,
  value,
  disabled,
  onValueChange,
}: {
  titulo: string;
  descricao: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (ligar: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.interruptor}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">{titulo}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {descricao}
        </ThemedText>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent, false: theme.border }}
        ios_backgroundColor={theme.border}
        accessibilityLabel={titulo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.two,
  },
  negrito: {
    fontWeight: 700,
  },
  centro: {
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  pessoa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  interruptores: {
    gap: Spacing.twoAndHalf,
  },
  interruptor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
});
