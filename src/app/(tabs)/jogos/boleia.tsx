import { skipToken, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import * as Linking from 'expo-linking';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { CompromissoBoleia } from '@/components/compromisso-boleia';
import { GrupoDaBoleia } from '@/components/grupo-da-boleia';
import { ImprevistoBoleia, MOTIVOS } from '@/components/imprevisto-boleia';
import { Spacing } from '@/constants/theme';
import {
  answerRequest,
  answerReturnRequest,
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
import { formatarData, formatarDiaEHora, formatarHora } from '@/lib/datas';
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
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
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

function Pessoa({ pessoa }: { pessoa: RidePerson }) {
  return (
    <View style={styles.pessoa}>
      <View style={styles.flex}>
        <ThemedText style={styles.destaque}>{pessoa.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {reputacao(pessoa.completed, pessoa.faults)}
        </ThemedText>
      </View>
      <Etiqueta
        icon={pessoa.status === 'driver' ? icons.carro : icons.perfil}
        label={
          pessoa.status === 'driver'
            ? 'Condutor'
            : pessoa.status === 'left_late'
              ? 'Saiu tarde'
              : 'Passageiro'
        }
        tone={pessoa.status === 'left_late' ? 'aviso' : 'neutro'}
      />
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
  const lista = pessoas.data ?? [];
  const pedidos = lista.filter((pessoa) => pessoa.status === 'requested');
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

  return (
    <Screen>
      <Card style={styles.grupo}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          {`${OPCOES[boleia.routeOption]} · ${boleia.roundTrip ? 'ida e volta' : 'só ida'}`}
        </ThemedText>
        <ThemedText type="title" style={styles.titulo}>
          {boleia.originName}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {`${boleia.isMine ? 'A tua boleia' : `Com ${boleia.driverName}`} · sai ${formatarDiaEHora(partida, agora).toLowerCase()}${estadio ? ` para o ${estadio.nome}` : ''}`}
        </ThemedText>
        <View style={styles.etiquetas}>
          {cancelada ? (
            <Etiqueta icon={icons.fechar} label="Cancelada" tone="negativo" />
          ) : (
            <Etiqueta
              icon={icons.perfil}
              label={livres > 0 ? plural(livres, 'lugar livre', 'lugares livres') : 'Cheia'}
              tone={livres > 0 ? 'positivo' : 'neutro'}
            />
          )}
          <Etiqueta
            icon={icons.rota}
            label={`${formatarDistancia(boleia.distanceM)} · ${duracao(boleia.durationS)}`}
            tone="neutro"
          />
          {boleia.isMine ? null : (
            <Etiqueta
              icon={icons.selecionado}
              label={reputacao(boleia.driverCompleted, boleia.driverFaults)}
              tone={boleia.driverFaults > 0 ? 'aviso' : 'neutro'}
            />
          )}
        </View>
        {boleia.note ? <ThemedText>{boleia.note}</ThemedText> : null}
        <Button
          label="Ver o ponto de encontro no mapa"
          variant="secondary"
          icon={icons.carro}
          onPress={() => abrirDirecoes(boleia.origin, 'carro')}
        />
        {cancelada ? null : (
          <Button
            label="Partilhar boleia"
            variant="secondary"
            icon={icons.partilhar}
            onPress={() => void partilhar()}
          />
        )}
      </Card>

      {cancelada ? null : (
        <Card style={styles.grupo}>
          <ThemedText style={styles.destaque}>Prazos</ThemedText>
          <LinhaValor
            rotulo="Pedidos de lugar e cancelar sem falta"
            valor={`até às ${formatarHora(prazos.pedidosFecham)}`}
          />
          <LinhaValor
            rotulo="Confirmar quem apareceu"
            valor={`até ${formatarData(prazos.confirmarAte)}`}
          />
          {fase === 'fechada' && participante ? (
            <ThemedText type="small" themeColor="textSecondary">
              Os pedidos já fecharam. Se não puderes ir, regista um imprevisto antes de sair.
            </ThemedText>
          ) : null}
        </Card>
      )}

      {boleia.parking ? (
        <>
          <SectionHeader title="Onde deixamos o carro" />
          <Card style={styles.grupo}>
            <ThemedText style={styles.destaque}>{boleia.parking.name}</ThemedText>
            {minutosDoParque !== null ? (
              <ThemedText themeColor="textSecondary">
                {`${minutosDoParque} min a pé até ao estádio`}
              </ThemedText>
            ) : null}
            {boleia.parking.location ? (
              <LinkTexto
                label="Como chegar de carro"
                onPress={() =>
                  boleia.parking?.location && abrirDirecoes(boleia.parking.location, 'carro')
                }
              />
            ) : null}
            <ThemedText type="small" themeColor="textMuted">
              Parque escolhido pelo condutor entre os que verificámos. Vê as fontes na ficha do
              jogo.
            </ThemedText>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Quanto custa" />
      <Card style={styles.grupo}>
        <LinhaValor
          rotulo={`Combustível${boleia.roundTrip ? ' (ida e volta)' : ''}`}
          valor={formatarCentimos(boleia.fuelCents)}
        />
        <LinhaValor
          rotulo={`Portagens${boleia.tollM > 0 ? ` · ${formatarDistancia(boleia.tollM)} pagos por sentido` : ''}`}
          valor={formatarCentimos(boleia.tollCents)}
        />
        <LinhaValor rotulo="Total" valor={formatarCentimos(boleia.totalCents)} destaque />
        <View style={[styles.separador, { backgroundColor: theme.border }]} />
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
      </Card>

      {participante ? (
        <>
          <SectionHeader title="No carro" />
          <Card style={styles.grupo}>
            {noCarro.map((pessoa) => (
              <Pessoa key={pessoa.profileId} pessoa={pessoa} />
            ))}
          </Card>
        </>
      ) : null}

      {boleia.isMine && pedidos.length > 0 && fase === 'aberta' ? (
        <>
          <SectionHeader title="Pedidos" trailing={String(pedidos.length)} />
          <ThemedText type="small" themeColor="textSecondary">
            {`Responde até às ${formatarHora(prazos.pedidosFecham)}: os pedidos sem resposta caducam.`}
          </ThemedText>
          {pedidos.map((pedido) => (
            <Card key={pedido.profileId} style={styles.grupo}>
              <Pessoa pessoa={pedido} />
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
                <View style={styles.flex}>
                  <Button
                    label="Recusar"
                    variant="secondary"
                    icon={icons.fechar}
                    disabled={aTratar}
                    onPress={() =>
                      void executar(() => answerRequest(boleia.id, pedido.profileId, false))
                    }
                  />
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <SectionHeader title="Grupo" />
      <GrupoDaBoleia
        boleia={boleia}
        nomeDoJogo={`${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`}
        participante={participante}
      />

      {boleia.isMine && pedidosVolta.length > 0 ? (
        <>
          <SectionHeader
            title="Pedidos de boleia de volta"
            trailing={String(pedidosVolta.length)}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Ficaram sem transporte depois do jogo. Só sabes a que distância estão do carro: a
            localização exata não é mostrada a ninguém.
          </ThemedText>
          {pedidosVolta.map((pedido) => (
            <Card key={pedido.profileId} style={styles.grupo}>
              <ThemedText style={styles.destaque}>{pedido.displayName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`A ${formatarDistancia(pedido.distanceToCarM)} do carro · ${plural(pedido.completed, 'boleia', 'boleias')} · ${plural(pedido.faults, 'falta', 'faltas')}`}
              </ThemedText>
              <Etiqueta
                icon={icons.preco}
                label={`Paga ${formatarCentimos(pedido.shareCents)} da volta`}
                tone="destaque"
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
                <View style={styles.flex}>
                  <Button
                    label="Recusar"
                    variant="secondary"
                    icon={icons.fechar}
                    disabled={aTratar}
                    onPress={() =>
                      void executar(() => answerReturnRequest(boleia.id, pedido.profileId, false))
                    }
                  />
                </View>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      {boleia.isMine && naVolta.length > 0 ? (
        <Card style={styles.grupo}>
          <ThemedText style={styles.destaque}>
            {plural(naVolta.length, 'pessoa vai contigo na volta', 'pessoas vão contigo na volta')}
          </ThemedText>
          {naVolta.map((pessoa) => (
            <ThemedText key={pessoa.profileId} type="small" themeColor="textSecondary">
              {`${pessoa.displayName} · a ${formatarDistancia(pessoa.distanceToCarM)} do carro · paga ${formatarCentimos(pessoa.shareCents)}`}
            </ThemedText>
          ))}
        </Card>
      ) : null}

      {participante && (imprevistos.data ?? []).length > 0 ? (
        <>
          <SectionHeader title="Imprevistos" />
          {(imprevistos.data ?? []).map((item) => {
            const meu = item.profileId === userId;
            return (
              <Card key={item.id} style={styles.grupo}>
                <ThemedText style={styles.destaque}>
                  {`${meu ? 'Tu' : item.name}: ${MOTIVOS[item.reason]}`}
                </ThemedText>
                {item.note ? <ThemedText themeColor="textSecondary">{item.note}</ThemedText> : null}
                <ThemedText type="small" themeColor="textMuted">
                  {`${plural(item.accepts, 'aceita', 'aceitam')} · ${plural(item.rejects, 'não aceita', 'não aceitam')}. Sem votos contra a mais, não fica falta.`}
                </ThemedText>
                {meu || agora > prazos.votarAte.getTime() ? null : (
                  <View style={styles.botoes}>
                    <View style={styles.flex}>
                      <Button
                        label="Aceito"
                        variant={item.myVote === true ? 'primary' : 'secondary'}
                        disabled={aTratar}
                        onPress={() => void executar(() => voteIncident(item.id, true))}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        label="Não aceito"
                        variant={item.myVote === false ? 'danger' : 'secondary'}
                        disabled={aTratar}
                        onPress={() => void executar(() => voteIncident(item.id, false))}
                      />
                    </View>
                  </View>
                )}
              </Card>
            );
          })}
        </>
      ) : null}

      {participante && !cancelada && fase === 'a-confirmar' && outros.length > 0 ? (
        <>
          <SectionHeader title="Quem apareceu?" />
          <ThemedText type="small" themeColor="textSecondary">
            Diz com honestidade. Ninguém vê o que respondeste, só o resultado.
          </ThemedText>
          {outros.map((pessoa) => {
            const resposta = presencas.data?.[pessoa.profileId];
            return (
              <Card key={pessoa.profileId} style={styles.grupo}>
                <Pessoa pessoa={pessoa} />
                <View style={styles.botoes}>
                  <View style={styles.flex}>
                    <Button
                      label="Apareceu"
                      variant={resposta === true ? 'primary' : 'secondary'}
                      disabled={aTratar}
                      onPress={() =>
                        void executar(() => reportAttendance(boleia.id, pessoa.profileId, true))
                      }
                    />
                  </View>
                  <View style={styles.flex}>
                    <Button
                      label="Não apareceu"
                      variant={resposta === false ? 'danger' : 'secondary'}
                      disabled={aTratar}
                      onPress={() =>
                        void executar(() => reportAttendance(boleia.id, pessoa.profileId, false))
                      }
                    />
                  </View>
                </View>
              </Card>
            );
          })}
        </>
      ) : null}

      {participante && podeReportarImprevisto(partida, agora) && !meuImprevisto ? (
        <Button
          label="Tive um imprevisto"
          variant="secondary"
          icon={icons.aviso}
          disabled={aTratar}
          onPress={() => setFormImprevisto(true)}
        />
      ) : null}

      {cancelada || fase === 'a-confirmar' || fase === 'terminada' ? null : boleia.isMine ? (
        <Button
          label="Cancelar boleia"
          variant="danger"
          icon={icons.fechar}
          disabled={aTratar}
          onPress={cancelar}
        />
      ) : boleia.myStatus === 'requested' || boleia.myStatus === 'accepted' ? (
        <>
          <ThemedText themeColor="textSecondary" style={styles.centro}>
            {boleia.myStatus === 'accepted'
              ? 'Tens lugar. Estás comprometido: aparece a horas no ponto de encontro.'
              : `Pedido enviado. O condutor tem até às ${formatarHora(prazos.pedidosFecham)} para responder.`}
          </ThemedText>
          <Button
            label={boleia.myStatus === 'accepted' ? 'Sair da boleia' : 'Cancelar pedido'}
            variant="secondary"
            icon={icons.fechar}
            disabled={aTratar}
            onPress={sair}
          />
        </>
      ) : suspensoAte ? (
        <Aviso
          tone="erro"
          title="Estás suspenso das boleias"
          message={`Por faltas em boleias anteriores, só podes pedir lugar a partir de ${formatarData(new Date(suspensoAte))}.`}
        />
      ) : fase === 'aberta' ? (
        <Button
          label={livres > 0 ? 'Pedir lugar' : 'Boleia cheia'}
          icon={icons.perfil}
          disabled={aTratar || livres <= 0}
          onPress={() => setCompromisso(true)}
        />
      ) : (
        <ThemedText themeColor="textSecondary" style={styles.centro}>
          Os pedidos para esta boleia já fecharam.
        </ThemedText>
      )}

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
  grupo: {
    gap: Spacing.two,
  },
  titulo: {
    fontSize: 26,
    lineHeight: 30,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
  separador: {
    height: 1,
    marginVertical: 4,
  },
  pessoa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  centro: {
    textAlign: 'center',
  },
});
