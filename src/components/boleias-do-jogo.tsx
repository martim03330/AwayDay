import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { RideSummary } from '@/features/rides/api';
import { useRideBoard } from '@/features/rides/hooks/useRides';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
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
  const quadro = useRideBoard(jogo.id, userId !== null);

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

  return (
    <Card style={styles.card}>
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
      <Button
        label="Oferecer boleia"
        icon={icons.carro}
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/jogos/oferecer-boleia', params: { jogoId: jogo.id } })
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  lista: {
    gap: Spacing.two,
  },
  linha: {
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
    gap: Spacing.one,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
