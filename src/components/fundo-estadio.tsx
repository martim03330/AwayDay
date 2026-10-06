import { Image } from 'expo-image';
import { type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { ThemedText } from '@/ui/themed-text';

const FOTO = require('@/assets/images/boas-vindas-estadio.jpg');

/** Freely licensed (CC BY-SA 4.0): the author and licence have to be shown with it. */
const CREDITO = {
  texto: 'Foto: Zemszo, CC BY-SA 4.0',
  link: 'https://commons.wikimedia.org/wiki/File:Mezokovesd_Zsory_stadion.jpg',
};

/** The night sky behind the text, close to the photo's own top. */
export const NOITE = '#05080F';

/**
 * A stadium at night under the floodlights, filling the screen, with the sky darkened so white text reads on top.
 * No crowd, no club: any fan can picture their own ground.
 */
export function FundoEstadio({ children }: { children: ReactNode }) {
  useBarraDeEstadoClara();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.ecra}>
      <Image
        source={FOTO}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={{ left: '30%', bottom: 0 }}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
      <Svg
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Defs>
          <LinearGradient id="noite" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NOITE} stopOpacity={0.96} />
            <Stop offset="0.45" stopColor={NOITE} stopOpacity={0.55} />
            <Stop offset="0.7" stopColor={NOITE} stopOpacity={0.35} />
            <Stop offset="1" stopColor={NOITE} stopOpacity={0.92} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#noite)" />
      </Svg>

      <View
        style={[
          styles.conteudo,
          { paddingTop: insets.top + Spacing.four, paddingBottom: Math.max(insets.bottom, Spacing.three) },
        ]}>
        {children}
        <Pressable
          onPress={() => void Linking.openURL(CREDITO.link)}
          accessibilityRole="link"
          accessibilityLabel={`${CREDITO.texto}. Abre a página da foto.`}
          // Taller target downwards only: upwards it would cover the links above (Termos · Privacidade).
          hitSlop={{ top: 0, bottom: 14, left: 14, right: 14 }}
          style={styles.credito}>
          <ThemedText style={styles.creditoTexto}>{CREDITO.texto}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
    backgroundColor: NOITE,
  },
  conteudo: {
    flex: 1,
    paddingHorizontal: 24,
  },
  credito: {
    alignSelf: 'center',
    marginTop: Spacing.three,
    paddingVertical: Spacing.one,
  },
  creditoTexto: {
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
