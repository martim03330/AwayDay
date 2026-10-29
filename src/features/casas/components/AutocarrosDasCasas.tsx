import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useClubTripsForFixture } from '@/features/casas/hooks/useClubTrips';
import type { ClubTripListItem } from '@/features/casas/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarHora } from '@/lib/datas';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { ThemedText } from '@/ui/themed-text';

function estado(item: ClubTripListItem) {
  if (item.myStatus === 'booked') return <Etiqueta label="Inscrito" tone="positivo" />;
  if (item.myStatus === 'waiting') return <Etiqueta label="Em espera" tone="aviso" />;
  if (item.freeSeats <= 0) return <Etiqueta label="Cheio" tone="neutro" />;
  return null;
}

/**
 * «Autocarros das Casas» on the game page: the trips of the Casas of the viewer's club, nearest first (the server
 * orders them by the first stop's distance). Draws nothing while there are none.
 */
export function AutocarrosDasCasas({
  fixtureId,
  ativo,
  onAbrir,
}: {
  fixtureId: string;
  /** Off for a game already played, or without an account. */
  ativo: boolean;
  onAbrir: (tripId: string) => void;
}) {
  const theme = useTheme();
  const viagens = useClubTripsForFixture(fixtureId, ativo);
  const lista = ativo ? (viagens.data ?? []) : [];
  if (lista.length === 0) return null;

  return (
    <Card style={styles.lista}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.titulo} accessibilityRole="header">
        Autocarros das Casas
      </ThemedText>
      {lista.map((item, indice) => (
        <LinhaGrupo
          key={item.tripId}
          onPress={() => onAbrir(item.tripId)}
          accessibilityLabel={`${item.clubName}, sai às ${formatarHora(new Date(item.firstStopPassesAt))}. Toca para abrir.`}
          leading={
            <View style={[styles.azulejo, { backgroundColor: theme.successBackground }]}>
              <Icon name={icons.autocarro} size={20} color={theme.accentInk} />
            </View>
          }
          title={item.clubName}
          valor={formatarHora(new Date(item.firstStopPassesAt))}
          trailing={estado(item) ?? <Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
          separador={indice < lista.length - 1}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  titulo: {
    paddingTop: Spacing.two,
  },
  azulejo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
