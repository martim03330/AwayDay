import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { RideSummary } from '@/features/rides/api';
import { setRideReturnRequests } from '@/features/rides/api';
import { useRefreshRides, useReturnBoard, useRideBoard } from '@/features/rides/hooks/useRides';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
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
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const ESTADOS: Record<NonNullable<RideSummary['myStatus']>, string> = {
  requested: 'Pedido enviado',
  accepted: 'Vais nesta boleia',
  declined: 'Pedido recusado',
  left: 'Saíste',
  left_late: 'Saíste tarde',
  expired: 'Pedido sem resposta',
};

function LinhaBoleia({ boleia, onPress }: { boleia: RideSummary; onPress: () => void }) {
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
        { borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={styles.linhaTopo}>
        <Icon name={icons.carro} size={20} color={theme.textSecondary} />
        <ThemedText style={styles.origem} numberOfLines={1}>
          {boleia.originName}
        </ThemedText>
        <ThemedText style={styles.preco}>{formatarCentimos(boleia.shareNowCents)}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {`${boleia.isMine ? 'A tua boleia' : boleia.driverName} · sai ${formatarDiaEHora(new Date(boleia.departureAt), agora).toLowerCase()}`}
      </ThemedText>
      <View style={styles.etiquetas}>
        {boleia.driverIsFriend ? (
          <Etiqueta icon={icons.perfil} label="Amigo" tone="positivo" />
        ) : null}
        {boleia.status === 'cancelled' ? (
          <Etiqueta icon={icons.fechar} label="Cancelada" tone="negativo" />
        ) : (
          <Etiqueta
            icon={icons.perfil}
            label={livres > 0 ? plural(livres, 'lugar livre', 'lugares livres') : 'Cheia'}
            tone={livres > 0 ? 'positivo' : 'neutro'}
          />
        )}
        {boleia.shareFullCents < boleia.shareNowCents ? (
          <Etiqueta
            icon={icons.preco}
            label={`Cheia: ${formatarCentimos(boleia.shareFullCents)} cada`}
            tone="destaque"
          />
        ) : null}
        <Etiqueta
          icon={icons.selecionado}
          label={
            boleia.driverCompleted === 0 && boleia.driverFaults === 0
              ? 'Primeira boleia'
              : `${plural(boleia.driverCompleted, 'boleia', 'boleias')} · ${plural(boleia.driverFaults, 'falta', 'faltas')}`
          }
          tone={boleia.driverFaults > 0 ? 'aviso' : 'neutro'}
        />
        {boleia.myStatus ? (
          <Etiqueta icon={icons.selecionado} label={ESTADOS[boleia.myStatus]} tone="neutro" />
        ) : null}
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

  async function abrirVolta(rideId: string) {
    await setRideReturnRequests(rideId, true).catch(() => undefined);
    await atualizar();
  }

  if (!userId) {
    return (
      <Card style={styles.card}>
        <ThemedText themeColor="textSecondary">
          Entra na tua conta para ver as boleias para este jogo ou oferecer lugares no teu carro.
        </ThemedText>
        <LinkTexto label="Entrar" onPress={() => router.push('/conta/entrar')} />
      </Card>
    );
  }

  const boleias = quadro.data ?? [];
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
      <Card style={styles.card}>
        {jaTenhoVolta ? (
          <ThemedText themeColor="textSecondary">
            Já tens maneira de voltar. Se sobrarem lugares no teu carro, abre-os aqui para quem
            ficou sem transporte.
          </ThemedText>
        ) : (
          <ThemedText style={styles.destaque}>
            Não tens maneira de voltar? Vê aqui quem ainda tem lugares.
          </ThemedText>
        )}

        {carros.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            Ainda ninguém abriu lugares na volta. Vai vendo: a malta costuma abri-los perto do fim
            do jogo.
          </ThemedText>
        ) : (
          [...porDestino.entries()].map(([destino, doDestino]) => (
            <View key={destino} style={styles.destino}>
              <ThemedText type="eyebrow" themeColor="accentInk">
                {`Para ${destino}`}
              </ThemedText>
              {doDestino.map((carro) => (
                <ThemedText key={carro.rideId} type="small" themeColor="textSecondary">
                  {`${carro.driverName} · ${plural(carro.seatsLeft, 'lugar livre', 'lugares livres')} · ${formatarCentimos(carro.priceCents)} cada${carro.myStatus === 'pending' ? ' · pedido enviado' : carro.myStatus === 'accepted' ? ' · tens lugar' : ''}`}
                </ThemedText>
              ))}
            </View>
          ))
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
          <ThemedText type="small" themeColor="textMuted">
            Estás a aceitar pedidos de boleia de volta. Quem pedir aparece na tua boleia.
          </ThemedText>
        ) : null}
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      {foraDePortugal ? (
        <ThemedText type="small" themeColor="textSecondary">
          Jogo fora de Portugal: a maioria vai de avião. Se ficar perto, podes oferecer ou procurar
          boleia na mesma.
        </ThemedText>
      ) : null}
      {quadro.isLoading ? (
        <ThemedText themeColor="textSecondary">A procurar boleias…</ThemedText>
      ) : quadro.isError ? (
        <ThemedText themeColor="textSecondary">
          Não deu para carregar as boleias. Verifica a ligação e tenta outra vez.
        </ThemedText>
      ) : boleias.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          Ainda ninguém ofereceu boleia para este jogo. Abre a tua: o preço por pessoa desce à
          medida que a malta entra.
        </ThemedText>
      ) : (
        <View style={styles.lista}>
          {boleias.map((boleia) => (
            <LinhaBoleia
              key={boleia.id}
              boleia={boleia}
              onPress={() =>
                router.push({
                  pathname: '/jogos/boleia',
                  params: { rideId: boleia.id, jogoId: jogo.id },
                })
              }
            />
          ))}
        </View>
      )}
      {voltaAberta ? (
        <Button
          label="Perdi o transporte: pedir boleia de volta"
          icon={icons.carro}
          onPress={() =>
            router.push({ pathname: '/jogos/boleia-de-volta', params: { jogoId: jogo.id } })
          }
        />
      ) : null}
      {jaOfereco ? (
        <ThemedText type="small" themeColor="textMuted">
          Já ofereces boleia para este jogo. Para mudar alguma coisa, cancela-a e abre outra.
        </ThemedText>
      ) : (
        <Button
          label="Oferecer boleia"
          icon={icons.carro}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/jogos/oferecer-boleia', params: { jogoId: jogo.id } })
          }
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  destino: {
    gap: 4,
  },
  destaque: {
    fontWeight: 800,
  },
  card: {
    gap: Spacing.three,
  },
  lista: {
    gap: Spacing.two,
  },
  linha: {
    gap: Spacing.two,
    paddingVertical: Spacing.twoAndHalf,
    paddingHorizontal: Spacing.twoAndHalf,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  linhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  origem: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  preco: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
