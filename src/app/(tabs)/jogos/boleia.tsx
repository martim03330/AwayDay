import { skipToken, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { Alert, Share, StyleSheet, Switch, View } from 'react-native';

import { CompromissoBoleia } from '@/components/compromisso-boleia';
import { GrupoDaBoleia } from '@/components/grupo-da-boleia';
import { ImprevistoBoleia, MOTIVOS } from '@/components/imprevisto-boleia';
import { Spacing } from '@/constants/theme';
import { inviteFriendToRide } from '@/features/friends/api';
import { useMyFriends } from '@/features/friends/hooks/useFriends';
import { BotaoMais, useModeracao } from '@/features/moderation/components/Moderacao';
import { useMyRideChats } from '@/features/rides/hooks/useRideChat';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import type { ProfileCard } from '@/features/profile/types';
import {
  answerRequest,
  answerReturnRequest,
  setRideReturnRequests,
  cancelRide,
  fetchMyAttendance,
  fetchReputation,
  fetchRideIncidents,
  leaveRide,
  reportAttendance,
  reportIncident,
  requestSeat,
  RideRefused,
  voteIncident,
  type IncidentReason,
  type RidePerson,
  type RideSummary,
} from '@/features/rides/api';
import {
  useRefreshRides,
  useRideBoard,
  useRidePeople,
  useReturnPeople,
} from '@/features/rides/hooks/useRides';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarData, formatarDia, formatarDiaEHora, formatarHora } from '@/lib/datas';
import { abrirDirecoes } from '@/lib/direcoes';
import { formatarDistancia, plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { faseDaBoleia, podeReportarImprevisto, prazosDaBoleia } from '@/lib/regras-boleia';
import { podeResponderVolta } from '@/lib/regras-volta';
import { ativarNotificacoesDeBoleias } from '@/lib/push';
import { useUserId } from '@/lib/session';
import { usePlanosJogos } from '@/state/planos-jogos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { Aviso } from '@/ui/aviso';
import { Avatar } from '@/ui/avatar';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const OPCOES: Record<RideSummary['routeOption'], string> = {
  rapida: 'Mais rápido',
  equilibrio: 'Equilíbrio',
  sem_portagens: 'Sem portagens',
};

const DETOUR_FACTOR = 1.3;
const METROS_POR_MINUTO = 80;

function duracao(segundos: number) {
  const minutos = Math.round(segundos / 60);
  const horas = Math.floor(minutos / 60);
  return horas > 0 ? `${horas} h ${String(minutos % 60).padStart(2, '0')}` : `${minutos} min`;
}

function reputacao(completed: number, faults: number) {
  if (completed === 0 && faults === 0) return 'Primeira boleia';
  return `${plural(completed, 'boleia', 'boleias')} · ${plural(faults, 'falta', 'faltas')}`;
}

function mensagemRecusa(erro: unknown) {
  if (!(erro instanceof RideRefused)) return 'Verifica a ligação e tenta outra vez.';
  switch (erro.reason) {
    case 'ride_full':
      return 'A boleia já está cheia.';
    case 'ride_closed':
      return 'Os pedidos para esta boleia já fecharam.';
    case 'rate_limited':
      return 'Fizeste muitos pedidos hoje. Tenta amanhã.';
    case 'own_ride':
      return 'Esta boleia é tua.';
    case 'suspended':
      return 'Estás suspenso das boleias por faltas. Vê no teu perfil até quando.';
    case 'outside_window':
      return 'Já passou o prazo para isto.';
    case 'not_participant':
      return 'Só quem vai nesta boleia pode fazer isto.';
    default:
      return 'Não deu para concluir. Tenta outra vez.';
  }
}

function LinhaValor({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <View style={styles.linhaValor}>
      <ThemedText
        themeColor={destaque ? undefined : 'textSecondary'}
        style={[styles.flex, destaque && styles.destaque]}>
        {rotulo}
      </ThemedText>
      <ThemedText style={[styles.valor, destaque && styles.destaque]}>{valor}</ThemedText>
    </View>
  );
}

/**
 * A person in the car: photo, name and their record. Only the driver and late leavers get a label. Someone else also
 * gets a discreet «⋯» (report, block).
 */
function Pessoa({
  pessoa,
  cartao,
  separador,
  onMais,
}: {
  pessoa: RidePerson;
  cartao?: ProfileCard;
  separador?: boolean;
  onMais?: () => void;
}) {
  const etiqueta =
    pessoa.status === 'driver' ? (
      <Etiqueta icon={icons.carro} label="Condutor" tone="neutro" />
    ) : pessoa.status === 'left_late' ? (
      <Etiqueta label="Saiu tarde" tone="aviso" />
    ) : null;
  return (
    <LinhaGrupo
      leading={<Avatar nome={pessoa.name} url={cartao?.avatarUrl} />}
      title={pessoa.name}
      subtitle={reputacao(pessoa.completed, pessoa.faults)}
      trailing={
        etiqueta || onMais ? (
          <View style={styles.trailing}>
            {etiqueta}
            {onMais ? <BotaoMais nome={pessoa.name} onPress={onMais} /> : null}
          </View>
        ) : undefined
      }
      separador={separador}
    />
  );
}

/** One of the three big facts at the top of the ride: when, how much, how many seats. */
function Facto({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <View style={styles.facto} accessible accessibilityLabel={`${rotulo}: ${valor}${nota ? `, ${nota}` : ''}`}>
      <ThemedText type="eyebrow" themeColor="textSecondary" numberOfLines={1}>
        {rotulo}
      </ThemedText>
      <ThemedText type="score" style={styles.factoValor} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </ThemedText>
      {nota ? (
        <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
          {nota}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Chevron at the end of a row; turned down when the row is open. */
function Seta({ aberta = false }: { aberta?: boolean }) {
  const theme = useTheme();
  return (
    <View style={aberta ? styles.setaAberta : undefined}>
      <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
    </View>
  );
}

/**
 * One ride: route, cost, where the car is left, the people and their reputation, the deadlines, and — around and after
 * departure — unforeseen events with votes and confirming who turned up.
 */
export default function BoleiaScreen() {
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow(60 * 1000);
  const userId = useUserId();
  const { rideId, jogoId } = useLocalSearchParams<{ rideId: string; jogoId: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const quadro = useRideBoard(jogoId ?? null, userId !== null);
  const boleia = quadro.data?.find((candidata) => candidata.id === rideId);
  const participante = boleia
    ? boleia.isMine || boleia.myStatus === 'accepted' || boleia.myStatus === 'left_late'
    : false;
  const pessoas = useRidePeople(rideId ?? null, participante);
  const amigos = useMyFriends(userId !== null);
  const cartoes = useProfileCards((pessoas.data ?? []).map((pessoa) => pessoa.profileId));
  const conversas = useMyRideChats(userId !== null);
  const [convidados, setConvidados] = useState<string[]>([]);
  // Fans left at the stadium asking for a seat home: only the driver answers, and only while the window is open.
  const pedidosDaVolta = useReturnPeople(
    rideId ?? null,
    boleia?.isMine === true && jogo !== undefined && podeResponderVolta(jogo.inicio, agora)
  );
  const imprevistos = useQuery({
    queryKey: ['rides', 'incidents', rideId],
    queryFn: rideId && participante ? () => fetchRideIncidents(rideId) : skipToken,
    meta: { persist: false },
  });
  const presencas = useQuery({
    queryKey: ['rides', 'attendance', rideId],
    queryFn: rideId && participante ? () => fetchMyAttendance(rideId) : skipToken,
    meta: { persist: false },
  });
  const minhaReputacao = useQuery({
    queryKey: ['rides', 'reputation', userId],
    queryFn: userId ? () => fetchReputation(userId) : skipToken,
    meta: { persist: false },
  });
  const { garantirVou } = usePlanosJogos();
  const atualizar = useRefreshRides();
  const [aTratar, setATratar] = useState(false);
  const [compromisso, setCompromisso] = useState(false);
  const [formImprevisto, setFormImprevisto] = useState(false);
  // Secondary detail stays folded until asked for.
  const [verCusto, setVerCusto] = useState(false);
  const [verConvidar, setVerConvidar] = useState(false);
  const moderacao = useModeracao();

  async function executar(acao: () => Promise<void>) {
    setATratar(true);
    try {
      await acao();
      await atualizar();
      return true;
    } catch (erro) {
      Alert.alert('Não foi possível', mensagemRecusa(erro));
      return false;
    } finally {
      setATratar(false);
    }
  }

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="As boleias ligam pessoas reais: entra para ver os lugares e pedir o teu."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  if (quadro.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (!boleia || !jogo) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Boleia não encontrada"
          message="Pode ter sido cancelada. Volta ao teu jogo e vê as outras."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const partida = new Date(boleia.departureAt);
  const prazos = prazosDaBoleia(partida);
  const fase = faseDaBoleia(partida, agora);
  const livres = boleia.seatsOffered - boleia.seatsTaken;
  const conversa = (conversas.data ?? []).find((fio) => fio.rideId === boleia.id);
  const lista = pessoas.data ?? [];
  const pedidos = lista.filter((pessoa) => pessoa.status === 'requested');
  // Amigos que ainda não vão no carro nem pediram lugar: são estes que vale a pena convidar.
  const porConvidar = (amigos.data ?? []).filter(
    (amigo) => !lista.some((pessoa) => pessoa.profileId === amigo.profileId)
  );
  const noCarro = lista.filter((pessoa) => pessoa.status !== 'requested');
  const volta = pedidosDaVolta.data ?? [];
  const pedidosVolta = volta.filter((pessoa) => pessoa.status === 'pending');
  const naVolta = volta.filter((pessoa) => pessoa.status === 'accepted');
  const outros = noCarro.filter((pessoa) => pessoa.profileId !== userId);
  const cancelada = boleia.status === 'cancelled';
  const suspensoAte = minhaReputacao.data?.bannedUntil ?? null;
  const meuImprevisto = (imprevistos.data ?? []).find((item) => item.profileId === userId);
  const minutosDoParque =
    boleia.parking?.distanceM != null
      ? Math.round((boleia.parking.distanceM * DETOUR_FACTOR) / METROS_POR_MINUTO)
      : null;

  /** Shares the ride with a link that opens it in the app, so the group organises itself here. */
  async function partilhar() {
    if (!boleia || !jogo) return;
    const link = Linking.createURL('/jogos/boleia', {
      queryParams: { rideId: boleia.id, jogoId: jogo.id },
    });
    const casa = obterClube(jogo.casaId)?.nomeCurto ?? '';
    const fora = obterClube(jogo.foraId)?.nomeCurto ?? '';
    const lugares = boleia.seatsOffered - boleia.seatsTaken;
    const mensagem = [
      `Boleia para ${casa} x ${fora}`,
      `Sai de ${boleia.originName}, ${formatarDiaEHora(partida, agora).toLowerCase()}`,
      lugares > 0
        ? `${plural(lugares, 'lugar livre', 'lugares livres')} · ${formatarCentimos(boleia.shareFullCents)} a ${formatarCentimos(boleia.shareNowCents)} por pessoa`
        : 'Boleia cheia',
      `Pede lugar no AwayDay: ${link}`,
    ].join('\n');
    try {
      await Share.share({ message: mensagem });
    } catch {
      Alert.alert('Não foi possível partilhar', 'Tenta outra vez.');
    }
  }

  function sair() {
    if (!boleia) return;
    if (fase === 'aberta' || boleia.myStatus === 'requested') {
      void executar(() => leaveRide(boleia.id));
      return;
    }
    Alert.alert(
      'Sair fora do prazo?',
      'Os pedidos já fecharam: sair agora conta como falta, a não ser que a malta aceite um imprevisto.',
      [
        { text: 'Ficar', style: 'cancel' },
        { text: 'Tive um imprevisto', onPress: () => setFormImprevisto(true) },
        {
          text: 'Sair na mesma',
          style: 'destructive',
          onPress: () => void executar(() => leaveRide(boleia.id)),
        },
      ]
    );
  }

  function cancelar() {
    if (!boleia) return;
    const tarde = fase !== 'aberta' && boleia.seatsTaken > 0;
    Alert.alert(
      'Cancelar a boleia?',
      tarde
        ? 'Os pedidos já fecharam e há quem conte contigo: cancelar agora conta como falta, a não ser que a malta aceite um imprevisto.'
        : 'Quem já tinha lugar deixa de ter. Ainda estás dentro do prazo, por isso não conta como falta.',
      [
        { text: 'Não', style: 'cancel' },
        ...(tarde ? [{ text: 'Tive um imprevisto', onPress: () => setFormImprevisto(true) }] : []),
        {
          text: 'Cancelar',
          style: 'destructive' as const,
          onPress: () => void executar(() => cancelRide(boleia.id)),
        },
      ]
    );
  }

  const cartaoDe = (profileId: string) =>
    (cartoes.data ?? []).find((cartao) => cartao.profileId === profileId);
  // Someone else in or asking for the car: report or block, behind a discreet «⋯».
  const maisSobre = (pessoa: RidePerson) =>
    pessoa.profileId === userId
      ? undefined
      : () =>
          moderacao.abrirPessoa({
            pessoa: { profileId: pessoa.profileId, nome: pessoa.name },
            temFoto: Boolean(cartaoDe(pessoa.profileId)?.avatarUrl),
          });

  // Before departure, with the ride still on: the time when seats are asked for, given up or cancelled.
  const ativa = !cancelada && fase !== 'a-confirmar' && fase !== 'terminada';
  const souPassageiro =
    !boleia.isMine && (boleia.myStatus === 'requested' || boleia.myStatus === 'accepted');
  const partilharEmDestaque = boleia.isMine && fase === 'aberta' && !cancelada && livres > 0;
  const podeConvidar = boleia.isMine && fase === 'aberta' && livres > 0 && porConvidar.length > 0;
  const podeVotar = agora <= prazos.votarAte.getTime();
  const listaImprevistos = imprevistos.data ?? [];
  const mostrarImprevisto = participante && podeReportarImprevisto(partida, agora) && !meuImprevisto;

  function abrirConversa() {
    if (!boleia || !jogo) return;
    router.push({ pathname: '/carro/[rideId]', params: { rideId: boleia.id, jogoId: jogo.id } });
  }

  /** The one thing this person can do about the ride right now. */
  function acaoPrincipal(): ReactNode {
    if (!boleia || cancelada) return null;
    if (boleia.isMine) {
      return partilharEmDestaque ? (
        <Button
          label="Partilhar boleia"
          icon={icons.partilhar}
          variant={pedidos.length > 0 ? 'secondary' : 'primary'}
          onPress={() => void partilhar()}
        />
      ) : null;
    }
    if (fase === 'a-confirmar' || fase === 'terminada') return null;
    if (boleia.myStatus === 'accepted' || boleia.myStatus === 'requested') {
      const aceite = boleia.myStatus === 'accepted';
      return (
        <View style={styles.estado}>
          <Etiqueta
            icon={aceite ? icons.checkInFeito : icons.horario}
            label={aceite ? 'Tens lugar' : 'Pedido enviado'}
            tone={aceite ? 'positivo' : 'aviso'}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {aceite
              ? 'Aparece a horas no ponto de encontro.'
              : `O condutor responde até às ${formatarHora(prazos.pedidosFecham)}.`}
          </ThemedText>
        </View>
      );
    }
    if (suspensoAte) {
      return (
        <Aviso
          tone="erro"
          title="Estás suspenso das boleias"
          message={`Por faltas em boleias anteriores, só podes pedir lugar a partir de ${formatarData(new Date(suspensoAte))}.`}
        />
      );
    }
    if (fase === 'aberta') {
      return (
        <Button
          label={livres > 0 ? 'Pedir lugar' : 'Boleia cheia'}
          icon={icons.perfil}
          disabled={aTratar || livres <= 0}
          onPress={() => setCompromisso(true)}
        />
      );
    }
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
        Os pedidos para esta boleia já fecharam.
      </ThemedText>
    );
  }

  // The car's card: the chat first, then who is going, then (for the driver) friends to invite.
  type Linha = { chave: string; desenhar: (separador: boolean) => ReactNode };
  const linhasDoCarro: Linha[] = participante
    ? [
        {
          chave: 'conversa',
          desenhar: (separador) => (
            <LinhaGrupo
              onPress={abrirConversa}
              accessibilityLabel={`Conversa do carro${conversa && conversa.unread > 0 ? `, ${plural(conversa.unread, 'mensagem nova', 'mensagens novas')}` : ''}. Toca para abrir.`}
              leading={<IconCircle name={icons.conversa} />}
              title="Conversa do carro"
              subtitle={
                conversa?.lastBody
                  ? `${conversa.lastName ?? 'Alguém'}: ${conversa.lastBody}`
                  : 'Combinem a hora certa e o sítio de encontro'
              }
              trailing={
                <View style={styles.trailing}>
                  {conversa && conversa.unread > 0 ? (
                    <Badge label={String(conversa.unread)} />
                  ) : null}
                  <Seta />
                </View>
              }
              separador={separador}
            />
          ),
        },
        ...noCarro.map((pessoa) => ({
          chave: pessoa.profileId,
          desenhar: (separador: boolean) => (
            <Pessoa
              pessoa={pessoa}
              cartao={cartaoDe(pessoa.profileId)}
              separador={separador}
              onMais={maisSobre(pessoa)}
            />
          ),
        })),
        ...(boleia.isMine ? naVolta : []).map((pessoa) => ({
          chave: `volta-${pessoa.profileId}`,
          desenhar: (separador: boolean) => (
            <LinhaGrupo
              leading={<Avatar nome={pessoa.displayName} />}
              title={pessoa.displayName}
              subtitle={`Só na volta · a ${formatarDistancia(pessoa.distanceToCarM)} do carro · paga ${formatarCentimos(pessoa.shareCents)}`}
              separador={separador}
            />
          ),
        })),
        ...(podeConvidar
          ? [
              {
                chave: 'convidar',
                desenhar: (separador: boolean) => (
                  <LinhaGrupo
                    onPress={() => setVerConvidar((atual) => !atual)}
                    accessibilityLabel={`Convidar amigos, ${plural(porConvidar.length, 'amigo', 'amigos')}. Toca para ${verConvidar ? 'esconder' : 'ver'}.`}
                    leading={<IconCircle name={icons.perfil} tone="yellow" />}
                    title="Convidar amigos"
                    subtitle="Entram sem pedir: o lugar fica deles quando aceitarem"
                    trailing={<Seta aberta={verConvidar} />}
                    separador={separador || verConvidar}
                  />
                ),
              },
              ...(verConvidar ? porConvidar : []).map((amigo) => ({
                chave: `amigo-${amigo.profileId}`,
                desenhar: (separador: boolean) => (
                  <LinhaGrupo
                    leading={<Avatar nome={amigo.displayName} />}
                    title={amigo.displayName}
                    subtitle={
                      amigo.tripsTogether > 0
                        ? plural(amigo.tripsTogether, 'viagem juntos', 'viagens juntos')
                        : 'Ainda sem viagens juntos'
                    }
                    trailing={
                      <LinkTexto
                        label={convidados.includes(amigo.profileId) ? 'Convidado' : 'Convidar'}
                        disabled={convidados.includes(amigo.profileId)}
                        onPress={() => {
                          if (convidados.includes(amigo.profileId)) return;
                          void executar(() => inviteFriendToRide(boleia.id, amigo.profileId)).then(
                            () => setConvidados((atuais) => [...atuais, amigo.profileId])
                          );
                        }}
                      />
                    }
                    separador={separador}
                  />
                ),
              })),
            ]
          : []),
      ]
    : [];

  // Rows after the cost in the details card: the deadlines (unless cancelled) and the return seats.
  const depoisDoCusto = !cancelada || (boleia.isMine && boleia.roundTrip);
  const linhaSeparada = (ultima: boolean) =>
    ultima ? null : { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected };

  return (
    <Screen>
      {moderacao.elemento}
      <Card>
        <View style={styles.condutor}>
          <Avatar nome={boleia.driverName} url={cartaoDe(boleia.driverId)?.avatarUrl} size={48} />
          <View style={styles.flex}>
            <ThemedText type="eyebrow" themeColor="accentInk" numberOfLines={1}>
              {boleia.isMine ? 'A tua boleia' : `Boleia de ${boleia.driverName}`}
            </ThemedText>
            <ThemedText type="subtitle" style={styles.origem} numberOfLines={2}>
              {boleia.originName}
            </ThemedText>
            <LinhaDetalhes
              partes={[
                formatarDia(partida, agora),
                estadio ? `para o ${estadio.nome}` : null,
                boleia.isMine ? null : reputacao(boleia.driverCompleted, boleia.driverFaults),
              ]}
            />
          </View>
          {/* Whoever is in the car already has the «⋯» on the driver's row below. */}
          {boleia.isMine || participante ? null : (
            <BotaoMais
              nome={boleia.driverName}
              onPress={() =>
                moderacao.abrirPessoa({
                  pessoa: { profileId: boleia.driverId, nome: boleia.driverName },
                  temFoto: Boolean(cartaoDe(boleia.driverId)?.avatarUrl),
                })
              }
            />
          )}
        </View>
        {cancelada ? <Etiqueta icon={icons.fechar} label="Cancelada" tone="negativo" /> : null}
        <View style={[styles.factos, { borderColor: theme.backgroundSelected }]}>
          <Facto rotulo="Saída" valor={formatarHora(partida)} />
          <View style={[styles.divisoria, { backgroundColor: theme.backgroundSelected }]} />
          <Facto
            rotulo="Por pessoa"
            valor={formatarCentimos(boleia.shareNowCents)}
            nota={
              boleia.shareFullCents < boleia.shareNowCents
                ? `cheia: ${formatarCentimos(boleia.shareFullCents)}`
                : undefined
            }
          />
          <View style={[styles.divisoria, { backgroundColor: theme.backgroundSelected }]} />
          <Facto
            rotulo="Lugares"
            valor={livres > 0 ? String(livres) : 'Cheia'}
            nota={livres > 0 ? `livres de ${boleia.seatsOffered}` : undefined}
          />
        </View>
        {boleia.note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`«${boleia.note}»`}
          </ThemedText>
        ) : null}
        {acaoPrincipal()}
      </Card>

      {boleia.isMine && pedidos.length > 0 && fase === 'aberta' ? (
        <>
          <SectionHeader
            title="Pedidos"
            trailing={`Responde até às ${formatarHora(prazos.pedidosFecham)}`}
          />
          <Card style={styles.linhas}>
            {pedidos.map((pedido, indice) => (
              <View
                key={pedido.profileId}
                style={[styles.bloco, linhaSeparada(indice === pedidos.length - 1)]}>
                <Pessoa
                  pessoa={pedido}
                  cartao={cartaoDe(pedido.profileId)}
                  onMais={maisSobre(pedido)}
                />
                <View style={styles.botoes}>
                  <View style={styles.flex}>
                    <Button
                      label="Aceitar"
                      icon={icons.selecionado}
                      disabled={aTratar || livres <= 0}
                      onPress={() =>
                        void executar(() => answerRequest(boleia.id, pedido.profileId, true))
                      }
                    />
                  </View>
                  <LinkTexto
                    neutro
                    label="Recusar"
                    disabled={aTratar}
                    onPress={() =>
                      void executar(() => answerRequest(boleia.id, pedido.profileId, false))
                    }
                  />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {boleia.isMine && pedidosVolta.length > 0 ? (
        <>
          <SectionHeader title="Pedidos para a volta" trailing={String(pedidosVolta.length)} />
          <ThemedText type="small" themeColor="textSecondary">
            Ficaram sem transporte. Só vês a que distância estão do carro.
          </ThemedText>
          <Card style={styles.linhas}>
            {pedidosVolta.map((pedido, indice) => (
              <View
                key={pedido.profileId}
                style={[styles.bloco, linhaSeparada(indice === pedidosVolta.length - 1)]}>
                <LinhaGrupo
                  leading={<Avatar nome={pedido.displayName} />}
                  title={pedido.displayName}
                  subtitle={`A ${formatarDistancia(pedido.distanceToCarM)} do carro · ${reputacao(pedido.completed, pedido.faults)}`}
                  trailing={
                    <ThemedText type="smallBold">
                      {formatarCentimos(pedido.shareCents)}
                    </ThemedText>
                  }
                />
                <View style={styles.botoes}>
                  <View style={styles.flex}>
                    <Button
                      label="Aceitar"
                      icon={icons.selecionado}
                      disabled={aTratar || livres - naVolta.length <= 0}
                      onPress={() =>
                        void executar(() => answerReturnRequest(boleia.id, pedido.profileId, true))
                      }
                    />
                  </View>
                  <LinkTexto
                    neutro
                    label="Recusar"
                    disabled={aTratar}
                    onPress={() =>
                      void executar(() => answerReturnRequest(boleia.id, pedido.profileId, false))
                    }
                  />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {participante && !cancelada && fase === 'a-confirmar' && outros.length > 0 ? (
        <>
          <SectionHeader title="Quem apareceu?" trailing="Ninguém vê o que respondes" />
          <Card style={styles.linhas}>
            {outros.map((pessoa, indice) => {
              const resposta = presencas.data?.[pessoa.profileId];
              return (
                <View
                  key={pessoa.profileId}
                  style={[styles.bloco, linhaSeparada(indice === outros.length - 1)]}>
                  <Pessoa pessoa={pessoa} cartao={cartaoDe(pessoa.profileId)} />
                  <View style={styles.chips}>
                    <Chip
                      label="Apareceu"
                      selected={resposta === true}
                      emCartao
                      accessibilityLabel={`${pessoa.name} apareceu`}
                      onPress={() => {
                        if (aTratar) return;
                        void executar(() => reportAttendance(boleia.id, pessoa.profileId, true));
                      }}
                    />
                    <Chip
                      label="Não apareceu"
                      selected={resposta === false}
                      emCartao
                      accessibilityLabel={`${pessoa.name} não apareceu`}
                      onPress={() => {
                        if (aTratar) return;
                        void executar(() => reportAttendance(boleia.id, pessoa.profileId, false));
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {participante && listaImprevistos.length > 0 ? (
        <>
          <SectionHeader title="Imprevistos" />
          <Card style={styles.linhas}>
            {listaImprevistos.map((item, indice) => {
              const meu = item.profileId === userId;
              return (
                <View
                  key={item.id}
                  style={[styles.bloco, linhaSeparada(indice === listaImprevistos.length - 1)]}>
                  <LinhaGrupo
                    leading={<IconCircle name={icons.aviso} tone="yellow" />}
                    title={`${meu ? 'Tu' : item.name}: ${MOTIVOS[item.reason]}`}
                    subtitle={[
                      item.note,
                      `${plural(item.accepts, 'aceita', 'aceitam')} · ${plural(item.rejects, 'não aceita', 'não aceitam')}`,
                    ]
                      .filter(Boolean)
                      .join('\n')}
                  />
                  {meu || !podeVotar ? null : (
                    <View style={styles.chips}>
                      <Chip
                        label="Aceito"
                        selected={item.myVote === true}
                        emCartao
                        accessibilityLabel={`Aceito o imprevisto de ${item.name}`}
                        onPress={() => {
                          if (aTratar) return;
                          void executar(() => voteIncident(item.id, true));
                        }}
                      />
                      <Chip
                        label="Não aceito"
                        selected={item.myVote === false}
                        emCartao
                        accessibilityLabel={`Não aceito o imprevisto de ${item.name}`}
                        onPress={() => {
                          if (aTratar) return;
                          void executar(() => voteIncident(item.id, false));
                        }}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </Card>
          <ThemedText type="small" themeColor="textMuted">
            Se não houver mais votos contra do que a favor, não fica falta.
          </ThemedText>
        </>
      ) : null}

      {linhasDoCarro.length > 0 ? (
        <>
          <SectionHeader title="No carro" />
          <Card style={styles.linhas}>
            {linhasDoCarro.map((linha, indice) => (
              <View key={linha.chave}>{linha.desenhar(indice < linhasDoCarro.length - 1)}</View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Detalhes" />
      <Card style={styles.linhas}>
        <LinhaGrupo
          onPress={() => abrirDirecoes(boleia.origin, 'carro')}
          accessibilityLabel={`Ponto de encontro: ${boleia.originName}. Toca para abrir no mapa.`}
          leading={<IconCircle name={icons.pontoEncontro} />}
          title="Ponto de encontro"
          subtitle="Abrir no mapa"
          trailing={<Seta />}
          separador
        />
        {boleia.parking ? (
          <LinhaGrupo
            onPress={
              boleia.parking.location
                ? () => boleia.parking?.location && abrirDirecoes(boleia.parking.location, 'carro')
                : undefined
            }
            accessibilityLabel={`O carro fica no ${boleia.parking.name}.${boleia.parking.location ? ' Toca para ver como chegar.' : ''}`}
            leading={<IconCircle name={icons.carro} tone="sky" />}
            title={boleia.parking.name}
            subtitle={
              minutosDoParque !== null
                ? `${minutosDoParque} min a pé até ao estádio · parque escolhido`
                : 'Parque verificado'
            }
            trailing={boleia.parking.location ? <Seta /> : undefined}
            separador
          />
        ) : null}
        <LinhaGrupo
          leading={<IconCircle name={icons.rota} tone="neutral" />}
          title={`${OPCOES[boleia.routeOption]} · ${boleia.roundTrip ? 'ida e volta' : 'só ida'}`}
          subtitle={`${formatarDistancia(boleia.distanceM)} · ${duracao(boleia.durationS)}`}
          separador
        />
        <LinhaGrupo
          onPress={() => setVerCusto((atual) => !atual)}
          accessibilityLabel={`Custo total ${formatarCentimos(boleia.totalCents)}. Toca para ${verCusto ? 'esconder' : 'ver'} as contas.`}
          leading={<IconCircle name={icons.preco} tone="yellow" />}
          title={`Total ${formatarCentimos(boleia.totalCents)}`}
          subtitle="Combustível e portagens, a dividir por todos"
          trailing={<Seta aberta={verCusto} />}
          separador={depoisDoCusto || verCusto}
        />
        {verCusto ? (
          <View style={[styles.contas, linhaSeparada(!depoisDoCusto)]}>
            <LinhaValor
              rotulo={`Combustível${boleia.roundTrip ? ' (ida e volta)' : ''}`}
              valor={formatarCentimos(boleia.fuelCents)}
            />
            <LinhaValor
              rotulo={`Portagens${boleia.tollM > 0 ? ` · ${formatarDistancia(boleia.tollM)} por sentido` : ''}`}
              valor={formatarCentimos(boleia.tollCents)}
            />
            <LinhaValor
              rotulo={`Cada um agora (${plural(1 + boleia.seatsTaken, 'pessoa', 'pessoas')})`}
              valor={formatarCentimos(boleia.shareNowCents)}
              destaque
            />
            <LinhaValor
              rotulo={`Com a boleia cheia (${plural(1 + boleia.seatsOffered, 'pessoa', 'pessoas')})`}
              valor={formatarCentimos(boleia.shareFullCents)}
            />
            <ThemedText type="small" themeColor="textMuted">
              Portagens estimadas com os preços de 2026 (classe 1). O combustível usa o consumo e o
              preço que o condutor indicou. O condutor também paga a sua parte.
            </ThemedText>
          </View>
        ) : null}
        {cancelada ? null : (
          <LinhaGrupo
            leading={<IconCircle name={icons.horario} tone="neutral" />}
            title={`Pedidos fecham às ${formatarHora(prazos.pedidosFecham)}`}
            subtitle={
              fase === 'fechada' && participante
                ? 'Já fecharam. Se não puderes ir, regista um imprevisto.'
                : `Confirmar quem apareceu até ${formatarData(prazos.confirmarAte)}`
            }
            separador={boleia.isMine && boleia.roundTrip}
          />
        )}
        {boleia.isMine && boleia.roundTrip ? (
          <LinhaGrupo
            leading={<IconCircle name={icons.carro} tone="neutral" />}
            title="Lugares na volta"
            subtitle={
              boleia.acceptsReturnRequests
                ? 'Aceitas quem ficou sem transporte'
                : 'Abre-os a quem ficar sem transporte'
            }
            trailing={
              <Switch
                value={boleia.acceptsReturnRequests}
                disabled={aTratar}
                onValueChange={(valor) =>
                  void executar(() => setRideReturnRequests(boleia.id, valor))
                }
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor={theme.accentText}
                ios_backgroundColor={theme.border}
                accessibilityLabel="Aceitar pedidos de boleia de volta"
              />
            }
          />
        ) : null}
      </Card>

      <GrupoDaBoleia boleia={boleia} participante={participante} />

      <View style={styles.secundarias}>
        {!cancelada && !partilharEmDestaque ? (
          <LinkTexto label="Partilhar" onPress={() => void partilhar()} />
        ) : null}
        {mostrarImprevisto ? (
          <LinkTexto
            neutro
            label="Tive um imprevisto"
            disabled={aTratar}
            onPress={() => setFormImprevisto(true)}
          />
        ) : null}
        {ativa && souPassageiro ? (
          <LinkTexto
            perigo={boleia.myStatus === 'accepted'}
            neutro={boleia.myStatus !== 'accepted'}
            label={boleia.myStatus === 'accepted' ? 'Sair da boleia' : 'Cancelar pedido'}
            disabled={aTratar}
            onPress={sair}
          />
        ) : null}
        {ativa && boleia.isMine ? (
          <LinkTexto perigo label="Cancelar boleia" disabled={aTratar} onPress={cancelar} />
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
        Percurso: © contribuidores do OpenStreetMap, Valhalla (FOSSGIS)
      </ThemedText>

      <CompromissoBoleia
        visivel={compromisso}
        papel="passageiro"
        onFechar={() => setCompromisso(false)}
        onAceitar={() => {
          setCompromisso(false);
          // The passenger must hear the driver's answer the moment it comes.
          void ativarNotificacoesDeBoleias().catch(() => undefined);
          void executar(async () => {
            await requestSeat(boleia.id);
            // Pedir lugar é ir ao jogo: o bilhete abre-se sozinho.
            await garantirVou(jogo.id).catch(() => undefined);
          });
        }}
      />
      <ImprevistoBoleia
        visivel={formImprevisto}
        aEnviar={aTratar}
        onFechar={() => setFormImprevisto(false)}
        onEnviar={(motivo: IncidentReason, nota: string) =>
          void executar(() => reportIncident(boleia.id, motivo, nota)).then((feito) => {
            if (feito) setFormImprevisto(false);
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  condutor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.twoAndHalf,
  },
  origem: {
    fontSize: 28,
    lineHeight: 32,
  },
  factos: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: Spacing.twoAndHalf,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  facto: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  factoValor: {
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  divisoria: {
    width: 1,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linhas: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  bloco: {
    paddingBottom: Spacing.twoAndHalf,
  },
  contas: {
    gap: Spacing.two,
    paddingVertical: Spacing.twoAndHalf,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  setaAberta: {
    transform: [{ rotate: '90deg' }],
  },
  linhaValor: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  valor: {
    fontVariant: ['tabular-nums'],
  },
  destaque: {
    fontWeight: 800,
  },
  botoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  secundarias: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  centro: {
    textAlign: 'center',
  },
});
