import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Local } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** The page's host, e.g. "record.pt", so a source reads at a glance. */
function dominio(url: string) {
  const semProtocolo = url.replace(/^https:\/\//, '');
  return semProtocolo.split('/')[0]?.replace(/^www\./, '') ?? semProtocolo;
}

/** Why fans go to this tasco on match day, and the pages that say so. Only shown for researched places. */
export function ReferenciaAdeptos({
  referencia,
}: {
  referencia: NonNullable<Local['referencia']>;
}) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.topo}>
        <IconCircle name={icons.selecionado} tone="green" />
        <View style={styles.textos}>
          <ThemedText style={styles.titulo}>Referido por adeptos</ThemedText>
          <ThemedText themeColor="textSecondary">{referencia.nota}</ThemedText>
        </View>
      </View>
      <View style={styles.fontes}>
        <ThemedText type="eyebrow" themeColor="textMuted">
          Fontes
        </ThemedText>
        {referencia.fontes.map((fonte) => (
          <Pressable
            key={fonte.url}
            onPress={() => Linking.openURL(fonte.url)}
            accessibilityRole="link"
            accessibilityLabel={`${fonte.titulo}, ${dominio(fonte.url)}`}
            style={({ pressed }) => [styles.fonte, pressed && styles.pressed]}>
            <Icon name={icons.seguinte} size={14} color={theme.textSecondary} />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.fonteTexto}>
              {`${dominio(fonte.url)} · ${fonte.titulo}`}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  fontes: {
    gap: Spacing.one,
  },
  fonte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 32,
  },
  fonteTexto: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
