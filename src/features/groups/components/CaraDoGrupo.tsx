import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { iniciais } from '@/ui/avatar';
import { ThemedText } from '@/ui/themed-text';

type CaraDoGrupoProps = {
  nome: string;
  /** Link assinado da foto do grupo. Sem ela, ficam as iniciais num azulejo verde. */
  url?: string | null;
  size?: number;
};

/** A cara de um grupo: a foto que a malta escolheu, ou as iniciais do nome enquanto ninguém põe uma. */
export function CaraDoGrupo({ nome, url, size = 52 }: CaraDoGrupoProps) {
  const theme = useTheme();
  const forma = { width: size, height: size, borderRadius: size * 0.32 };
  // The line height follows the letters: with the text style's fixed one, big initials were cut top and bottom.
  const letra = Math.round(size * 0.34);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[forma, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        transition={120}
        accessibilityIgnoresInvertColors
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Foto do grupo ${nome}`}
      />
    );
  }

  return (
    <View
      style={[forma, styles.contorno, styles.iniciais, { backgroundColor: theme.accent }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Grupo ${nome}, sem foto`}>
      <ThemedText
        type="smallBold"
        allowFontScaling={false}
        style={{ color: theme.accentText, fontSize: letra, lineHeight: Math.round(letra * 1.25) }}>
        {iniciais(nome)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  contorno: {
    borderCurve: 'continuous',
  },
  iniciais: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
