import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { InscricaoFolha, type PedidoDeInscricao } from '@/features/casas/components/InscricaoFolha';
import { useSupportersClub } from '@/features/casas/hooks/useCasas';
import {
  useBookClubTrip,
  useCancelMyClubBooking,
  useClubTrip,
  useClubTripNotices,
} from '@/features/casas/hooks/useClubTrips';
import { mensagemDeRecusa, textoListaDeEspera, textoLugaresLivres } from '@/features/casas/mensagens';
import type { ClubTripFull, MyClubBooking } from '@/features/casas/types';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaCurto, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ConfirmacaoInline } from '@/ui/confirmacao-inline';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';
import { useFormatarDinheiro } from '@/ui/valor';

/** The booking the app wrote while the server has not answered yet (see `useBookClubTrip`). */
const PENDENTE = 'pending';

/** Free seats across the vehicles, as the server counted them. */
function lugaresLivres(viagem: ClubTripFull) {
  return viagem.summary.reduce((total, vehicle) => total + Math.max(0, vehicle.seats - vehicle.occupied), 0);
}

/** «Porto x Benfica · sábado, 8 de novembro às 20:30», when the game is in the catalogue. */
function textoDoJogo(fixtureId: string, agora: number) {
  const jogo = obterJogo(fixtureId);
  if (!jogo) return null;
  const casa = obterClube(jogo.casaId);
  const fora = obterClube(jogo.foraId);
  if (!casa || !fora) return null;
  return `${casa.nomeCurto} x ${fora.nomeCurto} · ${formatarDiaCurto(new Date(jogo.inicio), agora)} às ${formatarHora(new Date(jogo.inicio))}`;
}

/**
 * A Casa's trip as a fan sees it: the game, the Casa, price, free seats, stops, my booking and the Casa's notices,
 * with «Inscrever-me» or «Cancelar inscrição». The list of other passengers is never shown here.
 */
export function ViagemDaCasa({
  tripId,
  onAbrirCasa,
  onGerir,
  renderMais,
}: {
  tripId: string;
  onAbrirCasa: (casaId: string) => void;
  /** «Gerir», for the Casa's managers. */
  onGerir?: () => void;
  /** The «⋯» next to the name (to report the trip); not shown to the Casa's own managers. */
  renderMais?: (nome: string) => ReactNode;
}) {
  const theme = useTheme();
  const agora = useNow();
  const dinheiro = useFormatarDinheiro();
  const consulta = useClubTrip(tripId);
  const viagem = consulta.data;
  const casa = useSupportersClub(viagem?.trip.supportersClubId ?? null);
  const avisos = useClubTripNotices(tripId);
  const inscrever = useBookClubTrip(viagem?.trip.fixtureId ?? null);
  const cancelar = useCancelMyClubBooking(tripId, viagem?.trip.fixtureId ?? null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [aConfirmarCancelar, setAConfirmarCancelar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDaFolha, setErroDaFolha] = useState<string | null>(null);

  if (consulta.isLoading) {
    return (
      <>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
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

  const { trip } = viagem;
  // On a cancelled trip only the «Viagem cancelada» notice speaks: no booking, no amount.
  const minha =
    trip.status !== 'cancelled' && viagem.myBooking && viagem.myBooking.status !== 'cancelled'
      ? viagem.myBooking
      : null;
  const prazoPassou = agora >= Date.parse(trip.bookingsCloseAt);
  const abertas = trip.status === 'open' && !prazoPassou;
  const jogo = textoDoJogo(trip.fixtureId, agora);
  const livres = lugaresLivres(viagem);

  /** The sheet stays open, with everything filled in, until the server says yes; a refusal shows inside it. */
  async function inscreverMe(pedido: PedidoDeInscricao): Promise<boolean> {
    setErroDaFolha(null);
    setErro(null);
    try {
      await inscrever.mutateAsync({ tripId, ...pedido });
      setFolhaAberta(false);
      vibrarSucesso();
      return true;
    } catch (problema) {
      setErroDaFolha(mensagemDeRecusa(problema, 'inscrever'));
      vibrarErro();
      return false;
    }
  }

  function cancelarInscricao(reserva: MyClubBooking) {
    setAConfirmarCancelar(false);
    setErro(null);
    cancelar.mutate(reserva.bookingId, {
      onError: (problema) => {
        setErro(mensagemDeRecusa(problema, 'cancelar'));
        vibrarErro();
      },
    });
  }

  return (
    <>
      <View style={styles.cabecalho}>
        <View style={styles.titulo}>
          <ThemedText type="subtitle" style={styles.flex}>
            {trip.name}
          </ThemedText>
          {renderMais && !casa.isLoading && (casa.data?.myRole ?? null) === null ? renderMais(trip.name) : null}
        </View>
        {jogo ? <ThemedText themeColor="textSecondary">{jogo}</ThemedText> : null}
        {trip.membersOnly ? (
          <View style={styles.etiquetas}>
            <Etiqueta label="Só sócios" tone="info" />
          </View>
        ) : null}
      </View>

      {onGerir && (casa.data?.myRole ?? null) !== null ? (
        <Button label="Gerir" icon={icons.lista} onPress={onGerir} />
      ) : null}

      {casa.data ? (
        <Card style={styles.lista}>
          <LinhaGrupo
            onPress={() => onAbrirCasa(casa.data?.id ?? trip.supportersClubId)}
            accessibilityLabel={`${casa.data.name}. Toca para abrir.`}
            leading={<IconCircle name={icons.casa} />}
            title={casa.data.name}
            trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
          />
        </Card>
      ) : null}

      {trip.status === 'cancelled' ? (
        <Aviso tone="erro" title="Viagem cancelada" message="A Casa cancelou esta viagem." />
      ) : !abertas ? (
        <Aviso
          title="Inscrições fechadas"
          message="Para mudares alguma coisa, fala com a Casa."
        />
      ) : null}

      <Card style={styles.lista}>
        <LinhaGrupo
          leading={<IconCircle name={icons.preco} />}
          title="Preço por pessoa"
          valor={trip.priceCents > 0 ? dinheiro.formatar(trip.priceCents) : 'Gratuito'}
          separador
        />
        <LinhaGrupo
          leading={<IconCircle name={icons.autocarro} />}
          title="Lugares"
          valor={textoLugaresLivres(livres)}
          separador
        />
        <LinhaGrupo
          leading={<IconCircle name={icons.horario} />}
          title="Inscrições até"
          valor={`${formatarDiaCurto(new Date(trip.bookingsCloseAt), agora)} às ${formatarHora(new Date(trip.bookingsCloseAt))}`}
        />
      </Card>

      <SectionHeader title="Paragens" />
      <Card style={styles.lista}>
        {viagem.stops.map((stop, indice) => (
          <LinhaGrupo
            key={stop.id}
            leading={<IconCircle name={icons.pontoEncontro} />}
            title={stop.name}
            valor={formatarHora(new Date(stop.passesAt))}
            separador={indice < viagem.stops.length - 1}
          />
        ))}
      </Card>

      {trip.note ? (
        <Card>
          <ThemedText>{trip.note}</ThemedText>
        </Card>
      ) : null}

      {minha ? (
        <>
          <SectionHeader title="A tua inscrição" />
          <MinhaInscricao reserva={minha} />
          {minha.bookingId !== PENDENTE && abertas ? (
            aConfirmarCancelar ? (
              <ConfirmacaoInline
                mensagem={
                  minha.people > 1
                    ? 'Deixas o teu lugar e os de quem vai contigo.'
                    : 'Deixas o teu lugar nesta viagem.'
                }
                confirmar="Sim, cancelar"
                cancelar="Deixa estar"
                perigo
                aTratar={cancelar.isPending}
                onConfirmar={() => cancelarInscricao(minha)}
                onCancelar={() => setAConfirmarCancelar(false)}
              />
            ) : (
              <LinkTexto perigo label="Cancelar inscrição" onPress={() => setAConfirmarCancelar(true)} />
            )
          ) : null}
        </>
      ) : abertas ? (
        <Button
          label="Inscrever-me"
          icon={icons.autocarro}
          onPress={() => {
            setErroDaFolha(null);
            setFolhaAberta(true);
          }}
        />
      ) : null}

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}

      {(avisos.data ?? []).length > 0 ? (
        <>
          <SectionHeader title="Avisos da Casa" />
          {(avisos.data ?? []).map((aviso) => (
            <Card key={aviso.id} style={styles.aviso}>
              <ThemedText type="small" themeColor="textSecondary">
                {`${formatarDiaCurto(new Date(aviso.createdAt), agora)} às ${formatarHora(new Date(aviso.createdAt))}`}
              </ThemedText>
              <ThemedText>{aviso.body}</ThemedText>
            </Card>
          ))}
        </>
      ) : null}

      <InscricaoFolha
        visivel={folhaAberta}
        stops={viagem.stops}
        membersOnly={trip.membersOnly}
        priceCents={trip.priceCents}
        erro={erroDaFolha}
        aEnviar={inscrever.isPending}
        onConfirmar={inscreverMe}
        onFechar={() => {
          setFolhaAberta(false);
          setErroDaFolha(null);
        }}
      />
    </>
  );
}

/** My booking: where and when I get on, the vehicle, how many we are and what the Casa asks (once the server said). */
function MinhaInscricao({ reserva }: { reserva: MyClubBooking }) {
  const dinheiro = useFormatarDinheiro();
  const pendente = reserva.bookingId === PENDENTE;
  const inscrito = reserva.status === 'booked';

  return (
    <Card style={styles.lista}>
      <View style={styles.estado}>
        {pendente ? (
          <Etiqueta label="A confirmar…" tone="neutro" />
        ) : inscrito ? (
          <Etiqueta icon={icons.selecionado} label="Inscrito" tone="positivo" />
        ) : (
          <Etiqueta label={textoListaDeEspera(reserva.positionInWaiting)} tone="aviso" />
        )}
        {!pendente && inscrito && reserva.paid ? (
          <Etiqueta icon={icons.selecionado} label="Pago" tone="positivo" />
        ) : null}
      </View>
      <LinhaGrupo
        leading={<IconCircle name={icons.pontoEncontro} />}
        title={reserva.stopName}
        valor={formatarHora(new Date(reserva.passesAt))}
        separador
      />
      {!pendente && inscrito && reserva.vehicleLabel ? (
        <LinhaGrupo
          leading={<IconCircle name={icons.autocarro} />}
          title={reserva.vehicleLabel}
          separador
        />
      ) : null}
      <LinhaGrupo
        leading={<IconCircle name={icons.perfil} />}
        title={reserva.people > 1 ? `Tu e mais ${plural(reserva.people - 1, 'pessoa', 'pessoas')}` : 'Só tu'}
        separador={!pendente && inscrito}
      />
      {!pendente && inscrito ? (
        <LinhaGrupo
          leading={<IconCircle name={icons.preco} />}
          title={reserva.paid ? 'Pago à Casa' : 'A pagar à Casa'}
          valor={dinheiro.formatar(reserva.dueCents)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    gap: Spacing.one,
  },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  etiquetas: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  estado: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  aviso: {
    gap: Spacing.one,
  },
});
