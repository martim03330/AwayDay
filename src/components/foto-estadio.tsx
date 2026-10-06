import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { obterClube } from '@/mocks/clubes';
import type { Venue } from '@/mocks/tipos';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/**
 * Fotografia do estádio (Wikimedia Commons, com o crédito que a licença pede) ou, sem `photoUrl`, uma capa gerada com
 * as cores do clube da casa.
 */
export function FotoEstadio({ venue }: { venue: Venue }) {
  if (venue.photoUrl) {
    const credito = venue.fotoCredito;
    const textoCredito = credito
      ? `Foto: ${[credito.autor, credito.licenca].filter(Boolean).join(' · ')}`
      : null;

    return (
      <View style={styles.foto}>
        <Image
          source={{ uri: venue.photoUrl }}
          contentFit="cover"
          transition={200}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Fotografia do ${venue.nome}`}
          style={StyleSheet.absoluteFill}
        />
        {credito && textoCredito ? (
          <Pressable
            onPress={() => Linking.openURL(credito.url)}
            accessibilityRole="link"
            accessibilityLabel={`${textoCredito}. Abrir a origem da fotografia`}
            hitSlop={14}
            style={styles.credito}>
            <ThemedText style={styles.creditoTexto} numberOfLines={1}>
              {textoCredito}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const cor = obterClube(venue.clubeId)?.cores.primaria ?? Colors.accent;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Ilustração do ${venue.nome}. Ainda sem fotografia.`}
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
        {`${venue.cidade} · ainda sem fotografia`}
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
  credito: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    maxWidth: '80%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  creditoTexto: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 14,
  },
});
