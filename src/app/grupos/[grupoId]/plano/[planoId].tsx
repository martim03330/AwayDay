import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { LayoutAnimation, StyleSheet, View } from 'react-native';

import { useAbrirPerfil } from '@/hooks/use-abrir-perfil';
import { Spacing } from '@/constants/theme';
import { CartaoDoPlano } from '@/features/groups/components/CartaoDoPlano';
import { CartaoDaBoleia } from '@/features/groups/components/CartaoDaBoleia';
import { CasasDoPlano } from '@/features/groups/components/CasasDoPlano';
import { avisoDoPlanoFechado, faseDoPlano } from '@/features/groups/fase-do-plano';
import { GruposDoPlano, type GrupoDoPlano } from '@/features/groups/components/GruposDoPlano';
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
} from '@/features/groups/plans';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { leaveRide, setRideReturnRequests, setRideVisibility } from '@/features/rides/api';
import { useRealNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ConfirmacaoInline } from '@/ui/confirmacao-inline';
import { EmptyState } from '@/ui/empty-state';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
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
    case 'fixture_over':
      return 'O jogo já começou: o plano já não muda.';
    case 'already_offering':
      return 'Já ofereces boleia para este jogo: vais no teu carro.';
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
 * convidar a malta de outro grupo e fechá-lo; quem dá a boleia pode abri-la ao público e deixar a volta aberta.
 */
export default function PlanoScreen() {
  const abrirPerfil = useAbrirPerfil();
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
  const [aConfirmarDesistir, setAConfirmarDesistir] = useState(false);
  const [avisoDeFecho, setAvisoDeFecho] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const agoraReal = useRealNow(60 * 1000);

  if (!plano) {
    return (
      <Screen>
        {isLoading ? (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={2} />
          </>
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

  // From kick-off the plan is a record of who went: nothing changes any more (the server refuses it too).
  const fase = faseDoPlano(plano, agoraReal);
  const congelado = fase !== 'antes';
  const aberto = plano.status === 'aberto' && !congelado;
  const souQuemConvidou = plano.isMine;
  const souCondutor = plano.ride?.driverId === userId;
  const livres = lugaresLivres(plano);
  const vao = (pessoas.data ?? []).filter((pessoa) => pessoa.answer === 'vou');
  const naoVao = (pessoas.data ?? []).filter((pessoa) => pessoa.answer === 'nao');
  // Who has not answered yet is still thinking about it; after kick-off only who went matters.
  const aPensar = congelado ? [] : (pessoas.data ?? []).filter((pessoa) => pessoa.answer === 'pensar');
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
  /** Sends the plan to another group; if that group already has an invite for this game, says so instead. */
  const mandarA = (grupo: { id: string; name: string }) =>
    void tratar(async () => {
      try {
        await sharePlan(plano!.id, grupo.id);
      } catch (problema) {
        if (problema instanceof PlanRefused && problema.reason === 'plan_exists') {
          avisarConviteRepetido(router, grupo, problema.planId);
          return;
        }
        throw problema;
      }
    });


  const abrirBoleiaAoPublico = () => {
    const rideId = plano.ride?.id;
    if (rideId) void tratar(() => setRideVisibility(rideId, true));
  };

  const fecharJa = () =>
    void tratar(() => setPlanStatus(plano.id, 'fechado')).then((feito) => {
      if (feito) setAvisoDeFecho(null);
    });

  /** Closing with nothing missing is immediate; without a car, or with seats to spare, it says so first, here. */
  const fechar = () => {
    if (!plano.ride) {
      setAvisoDeFecho('O plano ainda não tem boleia. Podes fechá-lo na mesma: cada um vai como quiser.');
      return;
    }
    if (livres === 0) {
      fecharJa();
      return;
    }
    const sobram = livres === 1 ? 'Ainda sobra 1 lugar no carro.' : `Ainda sobram ${livres} lugares no carro.`;
    setAvisoDeFecho(
      `${sobram} Podes ${souCondutor && !plano.ride.publica ? 'abrir a boleia ao público ou ' : ''}convidar malta de outro grupo, em «Chamar mais malta». Ou fechar assim mesmo.`
    );
  };

  const desistir = () =>
    void tratar(() => setPlanStatus(plano.id, 'cancelado')).then((feito) => {
      if (feito) router.back();
    });

  const fotoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId)?.avatarUrl;

  const pessoasQueResponderam = [...vao, ...(congelado ? [] : naoVao), ...aPensar];
  const podeAbrirAoPublico = aberto && souCondutor && plano.ride !== null && !plano.ride.publica;
  const podeGerirGrupos = aberto && souQuemConvidou;
  // Who invited sees every other group of theirs (sent or not); everyone else only the groups it was sent to.
  const gruposVisiveis: GrupoDoPlano[] = podeGerirGrupos
    ? [
        ...outrosGrupos.map((grupo) => ({ id: grupo.id, name: grupo.name, aberto: mandadoPara.includes(grupo.id) })),
        ...partilhados
          .filter((grupo) => !outrosGrupos.some((meu) => meu.id === grupo.groupId))
          .map((grupo) => ({ id: grupo.groupId, name: grupo.groupName, aberto: true })),
      ]
    : partilhados.map((grupo) => ({ id: grupo.groupId, name: grupo.groupName, aberto: true }));

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

      {fase !== 'antes' ? (
        <Card style={styles.recordacao}>
          <IconCircle name={fase === 'a-decorrer' ? icons.horario : icons.album} tone="neutral" />
          <ThemedText themeColor="textSecondary" style={styles.flex}>
            {avisoDoPlanoFechado(fase)}
          </ThemedText>
        </Card>
      ) : null}

      {pessoasQueResponderam.length > 0 ? (
        <>
          <SectionHeader
            title={congelado ? 'Quem foi' : 'A malta'}
            trailing={vao.length > 0 ? `${vao.length} ${vao.length === 1 ? 'vai' : 'vão'}` : undefined}
          />
          <Card style={styles.lista}>
            {pessoasQueResponderam.map((pessoa, indice) => (
              <LinhaGrupo
                key={pessoa.profileId}
                onPress={() => abrirPerfil(pessoa.profileId)}
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
                      : pessoa.answer === 'nao'
                        ? 'Não vai'
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
      {congelado ? (
        <Card style={styles.lista}>
          <LinhaGrupo
            leading={<IconCircle name={icons.carro} tone={plano.ride ? 'green' : 'neutral'} />}
            title={plano.ride ? `Carro de ${plano.ride.driverName}` : 'Sem boleia no plano'}
            subtitle={
              plano.ride
                ? plural(plano.ride.seatsTaken, 'pessoa foi no carro', 'pessoas foram no carro')
                : 'Cada um foi como quis.'
            }
            onPress={
              plano.ride
                ? () =>
                    router.push({
                      pathname: '/jogos/boleia',
                      params: { rideId: plano.ride?.id ?? '', jogoId: plano.fixtureId },
                    })
                : undefined
            }
            trailing={
              plano.ride ? <Icon name={icons.seguinte} size={18} color={theme.textMuted} /> : undefined
            }
          />
        </Card>
      ) : plano.ride ? (
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

      {congelado ? (
        plano.stay ? (
          <>
            <SectionHeader title="Dormida" />
            <Card style={styles.lista}>
              <LinhaGrupo
                leading={<IconCircle name={icons.casa} />}
                title={`Casa de ${plano.stay.ownerName}`}
                subtitle={plural(plano.stay.taken, 'pessoa com cama', 'pessoas com cama')}
              />
            </Card>
          </>
        ) : null
      ) : (
        <CasasDoPlano plano={plano} grupoId={grupoId ?? plano.groupId} />
      )}

      {podeAbrirAoPublico || gruposVisiveis.length > 0 ? (
        <>
          <SectionHeader title={podeGerirGrupos ? 'Chamar mais malta' : 'Grupos convidados'} />
          <Card style={styles.lista}>
            {podeAbrirAoPublico ? (
              <LinhaGrupo
                separador={gruposVisiveis.length > 0}
                leading={<IconCircle name={icons.partilhar} />}
                title="Abrir a boleia ao público"
                subtitle="Qualquer adepto pode pedir lugar."
                onPress={aTratar ? undefined : abrirBoleiaAoPublico}
                trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
              />
            ) : null}
            {gruposVisiveis.length > 0 ? (
              <GruposDoPlano
                grupos={gruposVisiveis}
                podeGerir={podeGerirGrupos}
                aTratar={aTratar}
                onMandar={(grupoId) => {
                  const grupo = outrosGrupos.find((candidato) => candidato.id === grupoId);
                  if (grupo) mandarA(grupo);
                }}
                onRetirar={(grupoId) => tratar(() => unsharePlan(plano.id, grupoId))}
              />
            ) : null}
          </Card>
        </>
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      {aberto && souQuemConvidou ? (
        <View style={styles.bloco}>
          {avisoDeFecho ? (
            <ConfirmacaoInline
              aTratar={aTratar}
              mensagem={avisoDeFecho}
              cancelar="Deixa estar"
              confirmar="Fechar mesmo assim"
              onCancelar={() => {
                LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
                setAvisoDeFecho(null);
              }}
              onConfirmar={fecharJa}
            />
          ) : (
            <Button
              label="Fechar o plano"
              icon={icons.selecionado}
              disabled={aTratar}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
                fechar();
              }}
            />
          )}
          <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
            Também fecha sozinho quando o carro enche.
          </ThemedText>
          {aConfirmarDesistir ? (
            <ConfirmacaoInline
              perigo
              aTratar={aTratar}
              mensagem="Toda a gente sai do plano e o convite desaparece do grupo."
              cancelar="Manter"
              confirmar="Desistir"
              onCancelar={() => {
                LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
                setAConfirmarDesistir(false);
              }}
              onConfirmar={desistir}
            />
          ) : (
            <LinkTexto
              perigo
              label="Desistir do plano"
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
                setAConfirmarDesistir(true);
              }}
            />
          )}
        </View>
      ) : null}

      {plano.status === 'fechado' && !congelado ? (
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
  recordacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  flex: {
    flex: 1,
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
