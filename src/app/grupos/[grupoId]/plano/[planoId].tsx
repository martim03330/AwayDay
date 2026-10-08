import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { CartaoDoPlano } from '@/features/groups/components/CartaoDoPlano';
import { CartaoDaBoleia } from '@/features/groups/components/CartaoDaBoleia';
import { CasasDoPlano } from '@/features/groups/components/CasasDoPlano';
import { avisarConviteRepetido } from '@/features/groups/convite-repetido';
import {
  plansKey,
  useGroupPlans,
  useMyGroupInbox,
  usePlan,
  usePlanConflicts,
  usePlanPeople,
  usePlanSharedGroups,
} from '@/features/groups/hooks/useGroups';
import {
  joinPlanRide,
  PlanRefused,
  setPlanRide,
  setPlanStatus,
  sharePlan,
  unsharePlan,
  type FixturePlan,
  type SharedGroup,
} from '@/features/groups/plans';
import { partilhadoCom } from '@/features/groups/partilha';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { leaveRide, setRideReturnRequests, setRideVisibility } from '@/features/rides/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
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
    case 'ride_full':
      return 'O carro encheu entretanto.';
    case 'ride_closed':
      return 'O carro já saiu.';
    case 'not_shared':
      return 'Esse grupo já não tinha o plano.';
    case 'driver_not_in_plan':
      return 'Só dá para usar o carro de alguém do plano. Pede ao condutor que entre no grupo, ou pede lugar na boleia.';
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
  const partilhas = usePlanSharedGroups(planoId ?? null);
  const conflitos = usePlanConflicts(planoId ? [planoId] : []);
  const vaisComOutroGrupo = planoId ? conflitos.data?.[planoId] : undefined;
  const cartoes = useProfileCards([
    ...(pessoas.data ?? []).map((pessoa) => pessoa.profileId),
    ...(plano?.ride ? [plano.ride.driverId] : []),
  ]);
  const inbox = useMyGroupInbox(userId !== null);
  const doGrupo = useGroupPlans(grupoId ?? null);

  const [aTratar, setATratar] = useState(false);
  const [mostrarGrupos, setMostrarGrupos] = useState(false);
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
  const partilhados = partilhas.data ?? [];
  const mandadoPara = partilhados.map((grupo) => grupo.groupId);
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
  /** Take the plan back from a group: confirm first, it leaves their chat. */
  function deixarDeAbrir(grupo: SharedGroup) {
    Alert.alert(
      `Deixar de abrir a «${grupo.groupName}»?`,
      'O plano sai da conversa deles e quem de lá disse que ia deixa de contar. Os lugares já aceites na boleia e na casa ficam como estão. Os dois grupos são avisados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Deixar de abrir',
          style: 'destructive',
          onPress: () => void tratar(() => unsharePlan(plano!.id, grupo.groupId)),
        },
      ]
    );
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

  const pessoasQueResponderam = [...vao, ...aPensar];
  const podeAbrirAoPublico = aberto && souCondutor && plano.ride !== null && !plano.ride.publica;
  const podeMandar = aberto && souQuemConvidou && outrosGrupos.length > 0;

  return (
    <Screen>
      <CartaoDoPlano
        plano={plano}
        vaisComOutroGrupo={vaisComOutroGrupo}
        grupoAtualId={grupoId ?? null}
        quemConvidou={souQuemConvidou ? 'eu' : plano.creatorName.split(' ')[0]}
        dicaAoTocar="Toca para ver o jogo."
        onAbrir={() =>
          router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: plano.fixtureId } })
        }
        onRespondido={() => void queryClient.invalidateQueries({ queryKey: plansKey() })}
      />

      {pessoasQueResponderam.length > 0 ? (
        <>
          <SectionHeader
            title="Quem vai"
            trailing={vao.length > 0 ? String(vao.length) : undefined}
          />
          <Card style={styles.lista}>
            {pessoasQueResponderam.map((pessoa, indice) => (
              <LinhaGrupo
                key={pessoa.profileId}
                separador={indice < pessoasQueResponderam.length - 1}
                leading={
                  <Avatar nome={pessoa.displayName} url={fotoDe(pessoa.profileId)} size={36} />
                }
                title={pessoa.isMe ? `${pessoa.displayName} (tu)` : pessoa.displayName}
                subtitle={
                  pessoa.otherGroup
                    ? `Vai com ${pessoa.otherGroup}`
                    : pessoa.answer === 'vou'
                      ? 'Vai'
                      : 'A pensar'
                }
                trailing={
                  pessoa.answer === 'vou' && !pessoa.otherGroup ? (
                    <Icon name={icons.selecionado} size={20} color={theme.accentInk} />
                  ) : undefined
                }
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Boleia" />
      {plano.ride ? (
        <CartaoDaBoleia
          boleia={plano.ride}
          fotoDoCondutor={fotoDe(plano.ride.driverId)}
          souCondutor={souCondutor}
          podeTirar={souQuemConvidou || souCondutor}
          vaisComOutroGrupo={vaisComOutroGrupo}
          aTratar={aTratar}
          onEntrar={() => void tratar(() => joinPlanRide(plano.id))}
          onSair={() => {
            const rideId = plano.ride?.id;
            if (rideId) void tratar(() => leaveRide(rideId));
          }}
          onPublica={(ligar) => {
            const rideId = plano.ride?.id;
            if (rideId) void tratar(() => setRideVisibility(rideId, ligar));
          }}
          onVolta={(ligar) => {
            const rideId = plano.ride?.id;
            if (rideId) void tratar(() => setRideReturnRequests(rideId, ligar));
          }}
          onVer={() => {
            const rideId = plano.ride?.id;
            if (rideId) {
              router.push({
                pathname: '/jogos/boleia',
                params: { rideId, jogoId: plano.fixtureId },
              });
            }
          }}
          onTirar={() => void tratar(() => setPlanRide(plano.id, null))}
        />
      ) : boleiasDoGrupo.length > 0 ? (
        // A ride of the group for this game already exists (e.g. it was taken out of the plan): offer it back first.
        // Offering a new one would fail anyway, since a driver has one open ride per game.
        <Card style={styles.lista}>
          {boleiasDoGrupo.map((boleia, indice) => (
            <LinhaGrupo
              key={boleia.id}
              separador={indice < boleiasDoGrupo.length - 1}
              leading={<IconCircle name={icons.carro} />}
              title={boleia.isMine ? 'A tua boleia' : `Boleia de ${boleia.ownerName}`}
              subtitle={[
                boleia.departureAt ? `Sai ${formatarDiaEHora(new Date(boleia.departureAt)).toLowerCase()}` : null,
                plural(Math.max(0, boleia.seatsTotal - boleia.taken), 'lugar livre', 'lugares livres'),
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <LinkTexto
                  label="Pôr no plano"
                  disabled={aTratar}
                  onPress={() => void tratar(() => setPlanRide(plano.id, boleia.id))}
                />
              }
            />
          ))}
        </Card>
      ) : (
        <Card style={styles.bloco}>
          <ThemedText themeColor="textSecondary">
            Ainda não há boleia. Quem levar o carro oferece-a aqui.
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
        </Card>
      )}

      <CasasDoPlano plano={plano} grupoId={grupoId ?? plano.groupId} />

      {podeAbrirAoPublico || podeMandar ? (
        <>
          <SectionHeader title="Chamar mais malta" />
          <Card style={styles.lista}>
            {podeAbrirAoPublico ? (
              <LinhaGrupo
                separador={podeMandar}
                leading={<IconCircle name={icons.partilhar} />}
                title="Abrir a boleia ao público"
                subtitle="Qualquer adepto pode pedir lugar."
                onPress={aTratar ? undefined : abrirBoleiaAoPublico}
                trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
              />
            ) : null}
            {podeMandar ? (
              <>
                <LinhaGrupo
                  leading={<IconCircle name={icons.perfil} />}
                  title="Mandar a outro grupo"
                  subtitle="Quem recebe vê a boleia e pode pedir lugar."
                  onPress={() => setMostrarGrupos((atual) => !atual)}
                  accessibilityLabel={`Mandar a outro grupo. ${mostrarGrupos ? 'Toca para esconder os grupos.' : 'Toca para escolher o grupo.'}`}
                  trailing={
                    <Icon
                      name={mostrarGrupos ? icons.fechar : icons.seguinte}
                      size={18}
                      color={theme.textMuted}
                    />
                  }
                />
                {mostrarGrupos ? (
                  <View style={[styles.etiquetas, styles.grupos]}>
                    {outrosGrupos.map((grupo) => (
                      <Chip
                        key={grupo.id}
                        label={grupo.name}
                        emCartao
                        selected={mandadoPara.includes(grupo.id)}
                        onPress={() => {
                          if (mandadoPara.includes(grupo.id)) return;
                          void tratar(async () => {
                            try {
                              await sharePlan(plano.id, grupo.id);
                            } catch (problema) {
                              // That group already has an invite for this game: say so, don't post another.
                              if (problema instanceof PlanRefused && problema.reason === 'plan_exists') {
                                avisarConviteRepetido(router, grupo, problema.planId);
                                return;
                              }
                              throw problema;
                            }
                          });
                        }}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      {partilhados.length > 0 ? (
        <>
          <SectionHeader title={partilhadoCom(partilhados.map((grupo) => grupo.groupName)) ?? ''} />
          <Card style={styles.lista}>
            {partilhados.map((grupo, indice) => (
              <LinhaGrupo
                key={grupo.groupId}
                separador={indice < partilhados.length - 1}
                leading={<IconCircle name={icons.perfil} />}
                title={grupo.groupName}
                subtitle="Veem a boleia e a casa e podem pedir lugar."
                trailing={
                  souQuemConvidou ? (
                    <LinkTexto
                      perigo
                      label="Deixar de abrir"
                      disabled={aTratar}
                      onPress={() => deixarDeAbrir(grupo)}
                    />
                  ) : undefined
                }
              />
            ))}
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
            Também fecha sozinho quando o carro enche.
          </ThemedText>
          <LinkTexto perigo label="Desistir do plano" onPress={desistir} />
        </View>
      ) : null}

      {plano.status === 'fechado' ? (
        <View style={styles.bloco}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
            A sessão da viagem abre na véspera do jogo, nos Jogos.
          </ThemedText>
          {souQuemConvidou ? (
            <LinkTexto
              neutro
              label="Voltar a abrir o plano"
              onPress={() => void tratar(() => setPlanStatus(plano.id, 'aberto'))}
            />
          ) : null}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
        {`Criado por ${souQuemConvidou ? 'ti' : plano.creatorName} em «${plano.groupName}».`}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.twoAndHalf,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  centro: {
    textAlign: 'center',
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  grupos: {
    paddingBottom: Spacing.twoAndHalf,
  },
});
