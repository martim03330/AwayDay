import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { RideSummary } from '@/features/rides/api';
import { setRideReturnRequests } from '@/features/rides/api';
import { useMunicipalities, useMyHome } from '@/features/profile/hooks/useMyProfile';
import { useRefreshRides, useReturnBoard, useRideBoard } from '@/features/rides/hooks/useRides';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { kmDePartida, ordenarBoleiasPorPerto } from '@/lib/boleias-perto';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { podePedirVolta } from '@/lib/regras-volta';
import { useUserId } from '@/lib/session';
import { obterEstadio } from '@/mocks/estadios';
import type { Jogo } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const ESTADOS: Record<NonNullable<RideSummary['myStatus']>, string> = {
  requested: 'Pedido enviado',
  accepted: 'Vais nesta boleia',
  declined: 'Pedido recusado',
  left: 'Saíste',
  left_late: 'Saíste tarde',
  expired: 'Pedido sem resposta',
};

function LinhaBoleia({
  boleia,
  km,
  onPress,
  separador,
}: {
  boleia: RideSummary;
  /** How far it leaves from the person's concelho, when we know it. */
  km: number | null;
  onPress: () => void;
  separador: boolean;
}) {
  const theme = useTheme();
  const agora = useNow(60 * 1000);
  const livres = boleia.seatsOffered - boleia.seatsTaken;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Boleia de ${boleia.driverName} a partir de ${boleia.originName}, ${plural(livres, 'lugar livre', 'lugares livres')}, ${formatarCentimos(boleia.shareNowCents)} por pessoa agora`}
      style={({ pressed }) => [
        styles.linha,
        separador && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <View style={styles.linhaTopo}>
        <View style={styles.corpo}>
          <ThemedText style={styles.origem} numberOfLines={1}>
            {boleia.originName}
          </ThemedText>
          <LinhaDetalhes
            partes={[
              boleia.isMine ? 'A tua boleia' : boleia.driverName,
              `sai ${formatarDiaEHora(new Date(boleia.departureAt), agora).toLowerCase()}`,
              boleia.isMine
                ? null
                : boleia.driverCompleted === 0 && boleia.driverFaults === 0
                  ? 'primeira boleia'
                  : `${plural(boleia.driverCompleted, 'boleia', 'boleias')} · ${plural(boleia.driverFaults, 'falta', 'faltas')}`,
            ]}
          />
        </View>
        <View style={styles.precoCaixa}>
          <ThemedText style={styles.preco}>{formatarCentimos(boleia.shareNowCents)}</ThemedText>
          {boleia.shareFullCents < boleia.shareNowCents ? (
            <ThemedText type="small" themeColor="textMuted">
              {`cheia: ${formatarCentimos(boleia.shareFullCents)}`}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.etiquetas}>
        {boleia.status === 'cancelled' ? (
          <Etiqueta icon={icons.fechar} label="Cancelada" tone="negativo" />
        ) : boleia.myStatus ? (
          <Etiqueta
            icon={icons.selecionado}
            label={ESTADOS[boleia.myStatus]}
            tone={
              boleia.myStatus === 'accepted'
                ? 'positivo'
                : boleia.myStatus === 'requested'
                  ? 'aviso'
                  : 'neutro'
            }
          />
        ) : (
          <Etiqueta
            icon={icons.perfil}
            label={livres > 0 ? plural(livres, 'lugar livre', 'lugares livres') : 'Cheia'}
            tone={livres > 0 ? 'positivo' : 'neutro'}
          />
        )}
        {km !== null && !boleia.isMine ? (
          <Etiqueta
            icon={icons.localizacao}
            label={km < 1 ? 'Sai perto de ti' : `Sai a ${km} km de ti`}
            tone={km <= 15 ? 'info' : 'neutro'}
          />
        ) : null}
        {boleia.driverIsFriend ? <Etiqueta label="Amigo" tone="destaque" /> : null}
      </View>
    </Pressable>
  );
}

/** The rides to this game: join one, or offer yours. Needs an account (seats and people are real). */
export function BoleiasDoJogo({ jogo }: { jogo: Jogo }) {
  const router = useRouter();
  const userId = useUserId();
  const agora = useNow(60 * 1000);
  const quadro = useRideBoard(jogo.id, userId !== null);
  // From about half time until an hour after the end: the time when someone finds out they have no way home.
  const voltaAberta = podePedirVolta(jogo.inicio, agora);
  const comecou = agora >= Date.parse(jogo.inicio);
  const boleiasDeVolta = useReturnBoard(jogo.id, userId !== null && comecou);
  const atualizar = useRefreshRides();
  // Where the person usually leaves from (their concelho's centre): the closest rides go first.
  const casa = useMyHome(userId);
  const municipios = useMunicipalities(casa.data?.municipalityId != null);
  const concelho = municipios.data?.find((municipio) => municipio.id === casa.data?.municipalityId);
  const partida = concelho ? { latitude: concelho.latitude, longitude: concelho.longitude } : null;
  const levoCarro = casa.data?.usualTransport === 'driver';

  async function abrirVolta(rideId: string) {
    await setRideReturnRequests(rideId, true).catch(() => undefined);
    await atualizar();
  }

  if (!userId) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          Entra na tua conta para ver as boleias deste jogo ou oferecer lugares no teu carro.
        </ThemedText>
        <LinkTexto label="Entrar" onPress={() => router.push('/conta/entrar')} />
      </Card>
    );
  }

  const boleias = ordenarBoleiasPorPerto(quadro.data ?? [], partida);
  const jaOfereco = boleias.some((boleia) => boleia.isMine && boleia.status === 'open');
  const foraDePortugal = obterEstadio(jogo.estadioId)?.regiao === 'estrangeiro';

  // Depois do apito, uma boleia de ida não serve para nada: o que interessa é quem volta e para onde.
  if (comecou) {
    const carros = boleiasDeVolta.data ?? [];
    const porDestino = new Map<string, typeof carros>();
    for (const carro of carros) {
      const destino = carro.originCity ?? 'Sem destino indicado';
      porDestino.set(destino, [...(porDestino.get(destino) ?? []), carro]);
    }
    const jaTenhoVolta = boleias.some(
      (boleia) => boleia.roundTrip && (boleia.isMine || boleia.myStatus === 'accepted')
    );
    const minhaComVolta = boleias.find(
      (boleia) => boleia.isMine && boleia.status === 'open' && boleia.roundTrip
    );

    return (
      <>
        <ThemedText themeColor="textSecondary">
          {jaTenhoVolta
            ? 'Já tens maneira de voltar. Se te sobram lugares, abre-os a quem ficou sem transporte.'
            : 'Sem maneira de voltar? Estes carros ainda têm lugar.'}
        </ThemedText>

        {carros.length === 0 ? (
          <Card>
            <ThemedText themeColor="textSecondary">
              Ainda ninguém abriu lugares na volta. A malta costuma abri-los perto do fim do jogo.
            </ThemedText>
          </Card>
        ) : (
          <Card style={styles.linhas}>
            {[...porDestino.entries()].map(([destino, doDestino], indice) => (
              <View key={destino} style={indice > 0 ? styles.destinoSeguinte : undefined}>
                <ThemedText type="eyebrow" themeColor="accentInk" style={styles.destino}>
                  {`Para ${destino}`}
                </ThemedText>
                {doDestino.map((carro, posicao) => (
                  <LinhaGrupo
                    key={carro.rideId}
                    leading={<IconCircle name={icons.carro} tone="neutral" size={16} />}
                    title={carro.driverName}
                    subtitle={`${plural(carro.seatsLeft, 'lugar livre', 'lugares livres')} · ${formatarCentimos(carro.priceCents)} cada`}
                    trailing={
                      carro.myStatus === 'pending' ? (
                        <Etiqueta label="Pedido enviado" tone="aviso" />
                      ) : carro.myStatus === 'accepted' ? (
                        <Etiqueta label="Tens lugar" tone="positivo" />
                      ) : undefined
                    }
                    separador={posicao < doDestino.length - 1}
                  />
                ))}
              </View>
            ))}
          </Card>
        )}

        <Button
          label={carros.length > 0 ? 'Pedir lugar na volta' : 'Ver quem volta'}
          icon={icons.carro}
          variant={jaTenhoVolta ? 'secondary' : 'primary'}
          onPress={() =>
            router.push({ pathname: '/jogos/boleia-de-volta', params: { jogoId: jogo.id } })
          }
        />

        {minhaComVolta && !minhaComVolta.acceptsReturnRequests ? (
          <LinkTexto
            label="Tenho lugares na volta: abrir a quem precisa"
            onPress={() => void abrirVolta(minhaComVolta.id)}
          />
        ) : null}
        {minhaComVolta?.acceptsReturnRequests ? (
          <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
            Estás a aceitar pedidos de volta: aparecem na tua boleia.
          </ThemedText>
        ) : null}
      </>
    );
  }

  const oferecer = (
    <Button
      label="Oferecer boleia"
      icon={icons.carro}
      variant={levoCarro ? 'primary' : 'secondary'}
      onPress={() =>
        router.push({ pathname: '/jogos/oferecer-boleia', params: { jogoId: jogo.id } })
      }
    />
  );

  return (
    <>
      {levoCarro && !jaOfereco ? oferecer : null}
      {voltaAberta ? (
        <Button
          label="Perdi o transporte: pedir boleia de volta"
          icon={icons.carro}
          variant="highlight"
          onPress={() =>
            router.push({ pathname: '/jogos/boleia-de-volta', params: { jogoId: jogo.id } })
          }
        />
      ) : null}
      {foraDePortugal ? (
        <ThemedText type="small" themeColor="textSecondary">
          Jogo fora de Portugal: a maioria vai de avião, mas há quem vá de carro.
        </ThemedText>
      ) : null}

      {quadro.isLoading ? (
        <SkeletonCard lines={3} />
      ) : quadro.isError ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            Não deu para carregar as boleias. Verifica a ligação e tenta outra vez.
          </ThemedText>
        </Card>
      ) : boleias.length === 0 ? (
        <Card>
          <ThemedText style={styles.destaque}>Ainda ninguém ofereceu boleia</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Abre a tua: o preço por pessoa desce à medida que a malta entra.
          </ThemedText>
        </Card>
      ) : (
        <Card style={styles.linhas}>
          {boleias.map((boleia, indice) => (
            <LinhaBoleia
              key={boleia.id}
              boleia={boleia}
              km={kmDePartida(partida, boleia.origin)}
              separador={indice < boleias.length - 1}
              onPress={() =>
                router.push({
                  pathname: '/jogos/boleia',
                  params: { rideId: boleia.id, jogoId: jogo.id },
                })
              }
            />
          ))}
        </Card>
      )}

      {jaOfereco ? (
        <ThemedText type="small" themeColor="textMuted" style={styles.centro}>
          Já ofereces boleia para este jogo. Para mudar, cancela-a e abre outra.
        </ThemedText>
      ) : levoCarro ? null : (
        oferecer
      )}
    </>
  );
}

const styles = StyleSheet.create({
  destaque: {
    fontWeight: 800,
  },
  centro: {
    textAlign: 'center',
  },
  linhas: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  destino: {
    paddingTop: Spacing.twoAndHalf,
  },
  destinoSeguinte: {
    marginTop: Spacing.two,
  },
  linha: {
    gap: Spacing.two,
    paddingVertical: Spacing.twoAndHalf,
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.twoAndHalf,
  },
  corpo: {
    flex: 1,
    gap: Spacing.half,
  },
  origem: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  precoCaixa: {
    alignItems: 'flex-end',
  },
  preco: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
