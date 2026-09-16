import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

/** "Martim Henriques" -> "MH". Uma pessoa sem foto é reconhecida pelas iniciais, como sempre foi. */
export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

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

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[raio, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        transition={120}
        accessibilityIgnoresInvertColors
        accessibilityLabel={`Foto de ${nome}`}
      />
    );
  }

  return (
    <View
      style={[raio, styles.iniciais, { backgroundColor: theme.backgroundSelected }]}
      accessibilityLabel={`Sem foto de ${nome}`}>
      <ThemedText
        type="smallBold"
        allowFontScaling={false}
        themeColor="textSecondary"
        style={{ fontSize: Math.round(size * 0.36) }}>
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
