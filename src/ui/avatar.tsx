import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { iniciais } from '@/lib/iniciais';
import { ThemedText } from '@/ui/themed-text';

// Re-exported: screens and the group face import the initials from here.
export { iniciais };

type AvatarProps = {
  nome: string;
  /** Link assinado da foto. Sem ele, ficam as iniciais. */
  url?: string | null;
  size?: number;
};

/**
 * A cara de uma pessoa ao lado do nome dela. Quem não tem foto continua a ter iniciais — não há aqui nenhuma foto
 * por omissão nem nenhum boneco: metade das pessoas não vai pôr foto, e isso tem de ficar bem.
 */
export function Avatar({ nome, url, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const raio = { width: size, height: size, borderRadius: size / 2 };
  // The line height follows the letters: with the text style's fixed one, big initials were cut top and bottom.
  const letra = Math.round(size * 0.36);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[raio, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        transition={120}
        accessibilityIgnoresInvertColors
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Foto de ${nome}`}
      />
    );
  }

  return (
    <View
      style={[raio, styles.iniciais, { backgroundColor: theme.backgroundSelected }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Sem foto de ${nome}`}>
      <ThemedText
        type="smallBold"
        allowFontScaling={false}
        themeColor="textSecondary"
        style={{ fontSize: letra, lineHeight: Math.round(letra * 1.25) }}>
        {iniciais(nome)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  iniciais: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
