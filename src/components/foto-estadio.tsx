import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { obterClube } from '@/mocks/clubes';
import type { Venue } from '@/mocks/tipos';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Fotografia do estádio ou, sem `photoUrl`, uma capa gerada com as cores do clube da casa. */
export function FotoEstadio({ venue }: { venue: Venue }) {
  if (venue.photoUrl) {
    return (
      <Image
        source={{ uri: venue.photoUrl }}
        contentFit="cover"
        accessibilityLabel={`Fotografia do ${venue.nome}`}
        style={styles.foto}
      />
    );
  }

  const cor = obterClube(venue.clubeId)?.cores.primaria ?? Colors.accent;

  return (
    <View
      accessible
      accessibilityLabel={`Ilustração do ${venue.nome}. Fotografia indisponível na demo.`}
      style={[
        styles.foto,
        {
          backgroundColor: cor,
          // Darkens the club colour towards the bottom so the caption stays legible.
          experimental_backgroundImage:
            'linear-gradient(160deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.55) 100%)',
        },
      ]}>
      <View style={styles.icone} pointerEvents="none">
        <Icon name={icons.estadio} size={110} color="rgba(255,255,255,0.28)" strokeWidth={1.2} />
      </View>
      <ThemedText style={styles.legenda} numberOfLines={1}>
        {`${venue.cidade} · fotografia indisponível na demo`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  foto: {
    height: 150,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  icone: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  legenda: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 600,
  },
});
