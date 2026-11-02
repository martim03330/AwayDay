import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { BotaoReticencias, MenuDeAcoes, type MenuAberto } from '@/features/casas/components/MenuDeAcoes';
import {
  LUGARES_POR_OMISSAO,
  NOMES_DOS_TRANSPORTES,
  lerAcompanhantes,
  nomeDoTransporte,
} from '@/features/casas/formulario';
import { useMemberCode, useSupportersClub } from '@/features/casas/hooks/useCasas';
import {
  useAddClubTripVehicle,
  useAddManualClubBooking,
  useClubTrip,
  useClubTripBookings,
  useClubTripNotices,
  useManageClubBooking,
  usePostClubTripNotice,
  useSetClubTripStatus,
} from '@/features/casas/hooks/useClubTrips';
import { mensagemDaGestao } from '@/features/casas/mensagens';
import type {
  ClubBooking,
  ClubTripFull,
  ClubTripStatus,
  ClubTripVehicleSummary,
  ClubVehicleKind,
  ManageBookingAction,
} from '@/features/casas/types';
import { useNow } from '@/hooks/use-now';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { somarCentimos } from '@/lib/money';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { CampoTexto } from '@/ui/campo-texto';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { ConfirmacaoInline } from '@/ui/confirmacao-inline';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { Quantidade } from '@/ui/quantidade';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';
import { useFormatarDinheiro } from '@/ui/valor';

const TIPOS: ClubVehicleKind[] = ['autocarro', 'minibus', 'carrinha'];

const ESTADOS: Record<ClubTripStatus, { label: string; tone: 'positivo' | 'aviso' | 'negativo' }> = {
  open: { label: 'Inscrições abertas', tone: 'positivo' },
  closed: { label: 'Inscrições fechadas', tone: 'aviso' },
  cancelled: { label: 'Cancelada', tone: 'negativo' },
};

/** «Porto x Benfica · sábado, 8 de novembro às 20:30», when the game is in the catalogue. */
function textoDoJogo(fixtureId: string, agora: number) {
  const jogo = obterJogo(fixtureId);
  if (!jogo) return null;
  const casa = obterClube(jogo.casaId);
  const fora = obterClube(jogo.foraId);
  if (!casa || !fora) return null;
  return `${casa.nomeCurto} x ${fora.nomeCurto} · ${formatarDiaEHora(new Date(jogo.inicio), agora)}`;
}

/** The totals across the vehicles, as the server counted them. */
function totais(viagem: ClubTripFull) {
  return {
    ocupados: viagem.summary.reduce((total, vehicle) => total + vehicle.occupied, 0),
    lugares: viagem.summary.reduce((total, vehicle) => total + vehicle.seats, 0),
    pagos: viagem.summary.reduce((total, vehicle) => total + vehicle.paidPeople, 0),
    porReceber: somarCentimos(...viagem.summary.map((vehicle) => vehicle.dueCents)),
  };
}

function livres(vehicle: ClubTripVehicleSummary) {
  return Math.max(0, vehicle.seats - vehicle.occupied);
}

/**
 * A Casa's trip as its managers run it: the totals, each vehicle with who is in it, the waiting list, and the
 * actions (move, paid, boarded, take off; add a vehicle, book someone by hand, notices, close, reopen, cancel).
 * Every amount and count comes from the server.
 */
export function GerirViagem({ tripId }: { tripId: string }) {
  const agora = useNow();
  const dinheiro = useFormatarDinheiro();
  const consulta = useClubTrip(tripId);
  const viagem = consulta.data;
  const casa = useSupportersClub(viagem?.trip.supportersClubId ?? null);
  const gestor = (casa.data?.myRole ?? null) !== null;
  const reservas = useClubTripBookings(tripId, gestor);
  const avisos = useClubTripNotices(gestor ? tripId : null);
  const codigo = useMemberCode(
    viagem?.trip.supportersClubId ?? null,
    gestor && (viagem?.trip.membersOnly ?? false)
  );
  const gerir = useManageClubBooking();
  const mudarEstado = useSetClubTripStatus();
  const [menu, setMenu] = useState<MenuAberto | null>(null);
  const [aConfirmarCancelar, setAConfirmarCancelar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (consulta.isLoading || (viagem && casa.isLoading)) {
    return (
      <>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </>
    );
  }

  if (!viagem) {
    return (
      <EmptyState
        icon={icons.autocarro}
        title={consulta.isError ? 'Sem ligação' : 'Viagem indisponível'}
        message={consulta.isError ? 'Tenta outra vez daqui a pouco.' : 'Esta viagem já não está disponível.'}
      />
    );
  }

  if (!gestor) {
    return (
      <EmptyState
        icon={icons.casa}
        title="Só para quem gere a Casa"
        message="Este ecrã não está disponível na tua conta."
      />
    );
  }

  const { trip } = viagem;
  const cancelada = trip.status === 'cancelled';
  const soma = totais(viagem);
  const lista = reservas.data ?? [];
  const emEspera = lista.filter((reserva) => reserva.status === 'waiting');
  const pessoasEmEspera = emEspera.reduce((total, reserva) => total + reserva.people, 0);
  const jogo = textoDoJogo(trip.fixtureId, agora);

  function falhou(problema: unknown) {
    vibrarErro();
    Alert.alert('Não deu', mensagemDaGestao(problema));
  }

  function agir(reserva: ClubBooking, action: ManageBookingAction, vehicleId?: string) {
    gerir.mutate(
      { bookingId: reserva.id, action, vehicleId },
      { onSuccess: () => vibrarSucesso(), onError: falhou }
    );
  }

  function escolherTransporte(reserva: ClubBooking) {
    const destinos = viagem?.summary.filter(
      (vehicle) => vehicle.vehicleId !== reserva.vehicleId && livres(vehicle) >= reserva.people
    );
    if (!destinos || destinos.length === 0) {
      Alert.alert(
        'Sem lugar',
        `Nenhum outro transporte tem lugar para ${plural(reserva.people, 'pessoa', 'pessoas')}.`
      );
      return;
    }
    setMenu({
      titulo: `Para que transporte vai ${reserva.name}?`,
      acoes: destinos.map((vehicle) => ({
        label: vehicle.label,
        onPress: () => agir(reserva, 'move', vehicle.vehicleId),
      })),
    });
  }

  function tirar(reserva: ClubBooking) {
    Alert.alert(
      `Tirar ${reserva.name} da viagem?`,
      reserva.people > 1
        ? `Saem as ${reserva.people} pessoas desta inscrição, e quem está em lista de espera sobe.`
        : 'Quem está em lista de espera sobe para o lugar.',
      [
        { text: 'Deixa estar', style: 'cancel' },
        { text: 'Tirar', style: 'destructive', onPress: () => agir(reserva, 'remove') },
      ]
    );
  }

  function abrirMenu(reserva: ClubBooking) {
    const inscrito = reserva.status === 'booked';
    setMenu({
      titulo: reserva.name,
      acoes: [
        ...(!cancelada ? [{ label: 'Mudar de transporte', onPress: () => escolherTransporte(reserva) }] : []),
        reserva.paid
          ? { label: 'Não pago', onPress: () => agir(reserva, 'unpaid') }
          : { label: 'Pago', onPress: () => agir(reserva, 'paid') },
        ...(inscrito
          ? [
              reserva.boarded
                ? { label: 'Não entrou', onPress: () => agir(reserva, 'not_boarded') }
                : { label: 'Entrou', onPress: () => agir(reserva, 'boarded') },
            ]
          : []),
        { label: 'Tirar da viagem', perigo: true, onPress: () => tirar(reserva) },
      ],
    });
  }

  function definirEstado(status: ClubTripStatus) {
    setErro(null);
    setAConfirmarCancelar(false);
    mudarEstado.mutate(
      { tripId, status },
      {
        onSuccess: () => vibrarSucesso(),
        onError: (problema) => {
          vibrarErro();
          setErro(mensagemDaGestao(problema));
        },
      }
    );
  }

  const linhas = (doTransporte: ClubBooking[]) =>
    doTransporte.map((reserva, indice) => (
      <LinhaDaReserva
        key={reserva.id}
        reserva={reserva}
        separador={indice < doTransporte.length - 1}
        onMais={() => abrirMenu(reserva)}
      />
    ));

  return (
    <>
      <View style={styles.cabecalho}>
        <ThemedText type="subtitle">{trip.name}</ThemedText>
        {jogo ? <ThemedText themeColor="textSecondary">{jogo}</ThemedText> : null}
        <View style={styles.etiquetas}>
          <Etiqueta label={ESTADOS[trip.status].label} tone={ESTADOS[trip.status].tone} />
          {trip.membersOnly ? <Etiqueta label="Só sócios" tone="info" /> : null}
        </View>
      </View>

      <Card style={styles.totais}>
        <ThemedText>
          Lugares ocupados <ThemedText type="smallBold">{`${soma.ocupados}/${soma.lugares}`}</ThemedText>
        </ThemedText>
        <ThemedText>
          Em espera <ThemedText type="smallBold">{plural(pessoasEmEspera, 'pessoa', 'pessoas')}</ThemedText>
        </ThemedText>
        <ThemedText>
          Pagos <ThemedText type="smallBold">{plural(soma.pagos, 'pessoa', 'pessoas')}</ThemedText>
        </ThemedText>
        <ThemedText>
          Por receber <ThemedText type="smallBold">{dinheiro.formatar(soma.porReceber)}</ThemedText>
        </ThemedText>
      </Card>

      {trip.membersOnly && codigo.data ? (
        <Card style={styles.lista}>
          <LinhaGrupo
            leading={<IconCircle name={icons.password} />}
            title="Código de sócio"
            valor={codigo.data}
          />
        </Card>
      ) : null}

      {reservas.isError ? <MensagemErro>Não deu para carregar os inscritos.</MensagemErro> : null}

      {viagem.summary.map((vehicle) => {
        const doTransporte = lista.filter(
          (reserva) => reserva.status === 'booked' && reserva.vehicleId === vehicle.vehicleId
        );
        return (
          <View key={vehicle.vehicleId} style={styles.seccao}>
            <SectionHeader title={vehicle.label} trailing={`${vehicle.occupied}/${vehicle.seats}`} />
            {reservas.isLoading ? (
              <SkeletonCard lines={2} />
            ) : doTransporte.length === 0 ? (
              <ThemedText themeColor="textSecondary">Ninguém neste transporte.</ThemedText>
            ) : (
              <Card style={styles.lista}>{linhas(doTransporte)}</Card>
            )}
          </View>
        );
      })}

      {emEspera.length > 0 ? (
        <>
          <SectionHeader title={`Lista de espera · ${emEspera.length}`} />
          <Card style={styles.lista}>{linhas(emEspera)}</Card>
        </>
      ) : null}

      {!cancelada ? (
        <>
          <AcrescentarTransporte tripId={tripId} quantos={viagem.summary.length} />
          <InscreverAMao viagem={viagem} />
          <AvisarTodos tripId={tripId} />
        </>
      ) : null}

      {(avisos.data ?? []).length > 0 ? (
        <>
          <SectionHeader title="Avisos enviados" />
          {(avisos.data ?? []).map((aviso) => (
            <Card key={aviso.id} style={styles.aviso}>
              <ThemedText type="small" themeColor="textSecondary">
                {formatarDiaEHora(new Date(aviso.createdAt), agora)}
              </ThemedText>
              <ThemedText>{aviso.body}</ThemedText>
            </Card>
          ))}
        </>
      ) : null}

      {cancelada ? (
        <Aviso tone="erro" title="Viagem cancelada" message="Os inscritos foram avisados." />
      ) : (
        <>
          <SectionHeader title="Inscrições" />
          <View style={styles.acoes}>
            {trip.status === 'open' ? (
              <LinkTexto
                label="Fechar inscrições"
                disabled={mudarEstado.isPending}
                onPress={() => definirEstado('closed')}
              />
            ) : (
              <LinkTexto
                label="Reabrir inscrições"
                disabled={mudarEstado.isPending}
                onPress={() => definirEstado('open')}
              />
            )}
            {aConfirmarCancelar ? null : (
              <LinkTexto perigo label="Cancelar viagem" onPress={() => setAConfirmarCancelar(true)} />
            )}
          </View>
          {aConfirmarCancelar ? (
            <ConfirmacaoInline
              mensagem="Todos os inscritos ficam sem lugar e são avisados. Não dá para desfazer."
              confirmar="Sim, cancelar"
              cancelar="Deixa estar"
              perigo
              aTratar={mudarEstado.isPending}
              onConfirmar={() => definirEstado('cancelled')}
              onCancelar={() => setAConfirmarCancelar(false)}
            />
          ) : null}
        </>
      )}

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}

      <MenuDeAcoes menu={menu} onFechar={() => setMenu(null)} />
    </>
  );
}

/** One booking: the name, how many and where they get on, and the «⋯» with what can be done. */
function LinhaDaReserva({
  reserva,
  separador,
  onMais,
}: {
  reserva: ClubBooking;
  separador: boolean;
  onMais: () => void;
}) {
  const detalhe = [
    reserva.stopName,
    reserva.companions.length > 0 ? `com ${reserva.companions.join(', ')}` : null,
    reserva.isManual ? 'inscrito à mão' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <LinhaGrupo
      leading={<IconCircle name={icons.perfil} tone="neutral" />}
      title={reserva.name}
      valor={reserva.people > 1 ? plural(reserva.people, 'pessoa', 'pessoas') : undefined}
      subtitle={detalhe}
      trailing={
        <View style={styles.trailing}>
          {reserva.paid ? <Etiqueta label="Pago" tone="positivo" /> : null}
          {reserva.boarded ? <Etiqueta label="Entrou" tone="info" /> : null}
          <BotaoReticencias nome={reserva.name} onPress={onMais} />
        </View>
      }
      separador={separador}
    />
  );
}

/** «Acrescentar transporte»: the kind, a name and the seats. The waiting list moves up into it. */
function AcrescentarTransporte({ tripId, quantos }: { tripId: string; quantos: number }) {
  const acrescentar = useAddClubTripVehicle();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<ClubVehicleKind>('autocarro');
  const [nome, setNome] = useState('');
  const [lugares, setLugares] = useState(LUGARES_POR_OMISSAO.autocarro);
  const [erro, setErro] = useState<string | null>(null);

  function abrir() {
    setTipo('autocarro');
    setNome(nomeDoTransporte('autocarro', quantos + 1));
    setLugares(LUGARES_POR_OMISSAO.autocarro);
    setErro(null);
    setAberto(true);
  }

  function escolherTipo(novo: ClubVehicleKind) {
    setTipo(novo);
    setNome(nomeDoTransporte(novo, quantos + 1));
    setLugares(LUGARES_POR_OMISSAO[novo]);
  }

  function enviar() {
    setErro(null);
    acrescentar.mutate(
      { tripId, vehicle: { kind: tipo, label: nome.trim(), seats: lugares } },
      {
        onSuccess: () => {
          vibrarSucesso();
          setAberto(false);
        },
        onError: (problema) => {
          vibrarErro();
          setErro(mensagemDaGestao(problema));
        },
      }
    );
  }

  if (!aberto) {
    return <Button label="Acrescentar transporte" variant="secondary" icon={icons.autocarro} onPress={abrir} />;
  }

  return (
    <Card>
      <ThemedText type="smallBold">Novo transporte</ThemedText>
      <View style={styles.chips}>
        {TIPOS.map((opcao) => (
          <Chip
            key={opcao}
            label={NOMES_DOS_TRANSPORTES[opcao]}
            selected={opcao === tipo}
            emCartao
            onPress={() => escolherTipo(opcao)}
          />
        ))}
      </View>
      <Campo label="Nome do transporte" value={nome} onChangeText={setNome} maxLength={40} />
      <Quantidade rotulo="Lugares" valor={lugares} min={1} max={80} onChange={setLugares} />
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={acrescentar.isPending ? 'A acrescentar…' : 'Acrescentar'}
        disabled={acrescentar.isPending || nome.trim().length === 0}
        onPress={enviar}
      />
      <LinkTexto neutro label="Deixa estar" onPress={() => setAberto(false)} />
    </Card>
  );
}

/** «Inscrever à mão»: someone without the app (at the Casa or by phone), with the same rules for the seats. */
function InscreverAMao({ viagem }: { viagem: ClubTripFull }) {
  const inscrever = useAddManualClubBooking();
  const primeira = viagem.stops.length === 1 ? (viagem.stops[0]?.id ?? null) : null;
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [paragem, setParagem] = useState<string | null>(primeira);
  const [acompanhantes, setAcompanhantes] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setAberto(false);
    setNome('');
    setParagem(primeira);
    setAcompanhantes('');
    setErro(null);
  }

  function enviar() {
    if (!paragem) return;
    setErro(null);
    inscrever.mutate(
      {
        tripId: viagem.trip.id,
        name: nome.trim(),
        stopId: paragem,
        companions: lerAcompanhantes(acompanhantes),
      },
      {
        onSuccess: () => {
          vibrarSucesso();
          fechar();
        },
        onError: (problema) => {
          vibrarErro();
          setErro(mensagemDaGestao(problema));
        },
      }
    );
  }

  if (!aberto) {
    return <Button label="Inscrever à mão" variant="secondary" icon={icons.perfil} onPress={() => setAberto(true)} />;
  }

  return (
    <Card>
      <ThemedText type="smallBold">Inscrever à mão</ThemedText>
      <Campo
        label="Nome"
        value={nome}
        onChangeText={setNome}
        maxLength={60}
        autoCapitalize="words"
        placeholder="Ex.: Joaquim Silva"
      />
      <ThemedText type="small" themeColor="textSecondary">
        Paragem
      </ThemedText>
      <View style={styles.chips}>
        {viagem.stops.map((stop) => (
          <Chip
            key={stop.id}
            label={stop.name}
            selected={stop.id === paragem}
            emCartao
            onPress={() => setParagem(stop.id)}
          />
        ))}
      </View>
      <Campo
        label="Quem vai com esta pessoa (opcional)"
        value={acompanhantes}
        onChangeText={setAcompanhantes}
        maxLength={400}
        autoCapitalize="words"
        placeholder="Ex.: Maria, Tomás"
        ajuda="Nomes separados por vírgulas."
      />
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={inscrever.isPending ? 'A inscrever…' : 'Inscrever'}
        disabled={inscrever.isPending || nome.trim().length < 2 || !paragem}
        onPress={enviar}
      />
      <LinkTexto neutro label="Deixa estar" onPress={fechar} />
    </Card>
  );
}

/** «Avisar todos»: a notice that reaches everyone on the trip (notification and the list on the trip). */
function AvisarTodos({ tripId }: { tripId: string }) {
  const enviarAviso = usePostClubTripNotice();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  function enviar() {
    setErro(null);
    enviarAviso.mutate(
      { tripId, body: texto.trim() },
      {
        onSuccess: () => {
          vibrarSucesso();
          setTexto('');
          setAberto(false);
        },
        onError: (problema) => {
          vibrarErro();
          setErro(mensagemDaGestao(problema));
        },
      }
    );
  }

  if (!aberto) {
    return <Button label="Avisar todos" variant="secondary" icon={icons.megafone} onPress={() => setAberto(true)} />;
  }

  return (
    <Card>
      <CampoTexto
        label="Aviso aos inscritos"
        value={texto}
        onChangeText={setTexto}
        maxLength={500}
        placeholder="Ex.: A saída passa para as 9:30."
      />
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={enviarAviso.isPending ? 'A enviar…' : 'Enviar aviso'}
        disabled={enviarAviso.isPending || texto.trim().length === 0}
        onPress={enviar}
      />
      <LinkTexto
        neutro
        label="Deixa estar"
        onPress={() => {
          setAberto(false);
          setErro(null);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    gap: Spacing.one,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  totais: {
    gap: Spacing.one,
  },
  seccao: {
    gap: Spacing.three,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  aviso: {
    gap: Spacing.one,
  },
});
