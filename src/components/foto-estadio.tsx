import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { obterClube } from '@/mocks/clubes';
import type { Venue } from '@/mocks/tipos';
import { Icon, icons } from '@/ui/icon';

const COR_POR_DEFEITO = '#0B7A43';

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

  const cor = obterClube(venue.clubeId)?.cores.primaria ?? COR_POR_DEFEITO;

  return (
    <View
      accessible
      accessibilityLabel={`Ilustração do ${venue.nome}. Fotografia indisponível na demo.`}
      style={[
        styles.foto,
        { experimental_backgroundImage: `linear-gradient(160deg, ${cor} 0%, #0B0B0B 100%)` },
      ]}>
      <View style={styles.icone}>
        <Icon name={icons.estadio} size={72} color="rgba(255,255,255,0.22)" />
      </View>
      <View style={styles.legenda}>
        <Text style={styles.nome} numberOfLines={2}>
          {venue.nome}
        </Text>
        <Text style={styles.detalhe}>{venue.cidade} · fotografia indisponível na demo</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  foto: {
    height: 170,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  icone: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  legenda: {
    padding: 16,
    gap: 2,
  },
  nome: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  detalhe: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
});
