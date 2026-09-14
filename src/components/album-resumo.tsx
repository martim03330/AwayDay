import { Pressable, StyleSheet, View } from 'react-native';

import { FotoRecordacao } from '@/components/foto-recordacao';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ordenarFotos } from '@/lib/album';
import { plural } from '@/lib/formatos';
import { obterMissao } from '@/mocks/missoes';
import type { FotoMissao } from '@/mocks/tipos';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const MINIATURAS = 3;
/** Each polaroid sits a little crooked, like photos stuck in an album. */
const ROTACOES = ['-4deg', '3deg', '-2deg'] as const;

type AlbumResumoProps = {
  fotos: readonly FotoMissao[];
  onAbrir: () => void;
};

/** Entrada do álbum no perfil: as fotos mais recentes e quantas estão verificadas. */
export function AlbumResumo({ fotos, onAbrir }: AlbumResumoProps) {
  const theme = useTheme();
  const recentes = ordenarFotos(fotos).slice(0, MINIATURAS);
  const verificadas = fotos.filter((foto) => foto.verificada).length;

  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={`Álbum de recordações: ${plural(fotos.length, 'foto', 'fotos')}, ${verificadas} verificadas. Toca para abrir.`}
      style={({ pressed }) => [styles.contentor, pressed && styles.pressed]}>
      {recentes.length > 0 ? (
        <View style={styles.polaroides}>
          {recentes.map((foto, indice) => (
            <View
              key={foto.id}
              style={[
                styles.polaroide,
                { backgroundColor: theme.backgroundElement, transform: [{ rotate: ROTACOES[indice] ?? '0deg' }] },
              ]}>
              <FotoRecordacao foto={foto} compacta style={styles.miniatura} />
              <ThemedText style={styles.legenda} numberOfLines={2}>
                {obterMissao(foto.missaoId)?.distintivo.nome ?? 'Recordação'}
              </ThemedText>
            </View>
          ))}
          {Array.from({ length: MINIATURAS - recentes.length }, (_, indice) => (
            <View key={`vazio-${indice}`} style={styles.espaco} />
          ))}
        </View>
      ) : null}

      <View
        style={[
          styles.linha,
          recentes.length === 0
            ? [styles.vazio, { borderColor: theme.borderStrong }]
            : { backgroundColor: theme.backgroundElement },
        ]}>
        <View style={[styles.azulejo, { backgroundColor: theme.successBackground }]}>
          <Icon name={icons.album} size={22} color={theme.accentInk} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.titulo}>
            {fotos.length > 0 ? plural(fotos.length, 'recordação', 'recordações') : 'Álbum ainda vazio'}
          </ThemedText>
          <ThemedText style={styles.subtitulo} themeColor="textSecondary">
            {fotos.length > 0
              ? `${plural(verificadas, 'verificada', 'verificadas')} · as fotos das tuas missões`
              : 'Cada missão cumprida fecha com uma foto, que fica aqui guardada.'}
          </ThemedText>
        </View>
        <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contentor: {
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.75,
  },
  polaroides: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 6,
    paddingHorizontal: Spacing.one,
  },
  polaroide: {
    flex: 1,
    gap: Spacing.two,
    padding: Spacing.two,
    paddingBottom: 12,
    borderRadius: 6,
    boxShadow: '0 6px 16px rgba(19, 36, 27, 0.12)',
  },
  espaco: {
    flex: 1,
  },
  miniatura: {
    aspectRatio: 1,
    borderRadius: 3,
  },
  legenda: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: 800,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  vazio: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  azulejo: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
    gap: 1,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  subtitulo: {
    fontSize: 13,
    lineHeight: 18,
  },
});
