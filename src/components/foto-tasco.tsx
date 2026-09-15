import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Local } from '@/mocks/tipos';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type Foto = NonNullable<Local['foto']>;

/** "Foto: Autor · CC BY-SA 4.0", the credit the licence asks for. */
export function creditoFoto(foto: Foto) {
  return `Foto: ${[foto.autor, foto.licenca].filter(Boolean).join(' · ')}`;
}

/** A small square photo of the tasco for cards, or its icon when there is no photo yet. */
export function MiniaturaTasco({ local, tamanho = 72 }: { local: Local; tamanho?: number }) {
  const theme = useTheme();
  const estilo = [styles.miniatura, { width: tamanho, height: tamanho }];

  if (!local.foto) {
    return (
      <View
        style={[estilo, { backgroundColor: theme.backgroundSelected }]}
        accessible
        accessibilityLabel={`${local.nome}: ainda sem foto`}>
        <Icon name={icons.tasco} size={tamanho * 0.4} color={theme.textMuted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: local.foto.url }}
      contentFit="cover"
      transition={150}
      accessibilityLabel={`Foto do ${local.nome}`}
      style={[estilo, { backgroundColor: theme.backgroundSelected }]}
    />
  );
}

/** The tasco's photo across the page, with the credit over it (tap to open the original). */
export function FotoTasco({ local }: { local: Local }) {
  if (!local.foto) return null;
  const foto = local.foto;
  const credito = creditoFoto(foto);

  return (
    <View style={styles.foto}>
      <Image
        source={{ uri: foto.url }}
        contentFit="cover"
        transition={200}
        accessibilityLabel={`Foto do ${local.nome}`}
        style={StyleSheet.absoluteFill}
      />
      <Pressable
        onPress={() => Linking.openURL(foto.fonte)}
        accessibilityRole="link"
        accessibilityLabel={`${credito}. Abrir a origem da foto`}
        hitSlop={8}
        style={styles.credito}>
        <ThemedText style={styles.creditoTexto} numberOfLines={1}>
          {credito}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  miniatura: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foto: {
    height: 190,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  credito: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    maxWidth: '85%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  creditoTexto: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    lineHeight: 14,
  },
});
