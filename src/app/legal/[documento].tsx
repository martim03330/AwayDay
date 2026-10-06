import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DOCUMENTOS_LEGAIS } from '@/lib/legal';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

/** A política de privacidade, os termos ou o «sobre e contactos», com os mesmos textos das páginas públicas. */
export default function DocumentoLegalScreen() {
  const theme = useTheme();
  const { documento } = useLocalSearchParams<{ documento?: string }>();
  const doc = DOCUMENTOS_LEGAIS.find((candidato) => candidato.id === documento);

  if (!doc) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Documento' }} />
        <EmptyState icon={icons.naoEncontrado} title="Não encontrámos este documento" message="Fecha e tenta outra vez." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: doc.titulo }} />
      <View style={styles.topo}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {doc.titulo}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{doc.resumo}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {`Atualizado a ${doc.atualizadoEm}`}
        </ThemedText>
      </View>

      {doc.seccoes.map((seccao) => (
        <View key={seccao.titulo} style={styles.seccao}>
          <ThemedText type="smallBold" style={styles.titulo} accessibilityRole="header">
            {seccao.titulo}
          </ThemedText>
          {seccao.blocos.map((bloco, indice) =>
            bloco.tipo === 'paragrafo' ? (
              <ThemedText key={indice} style={styles.texto}>
                {bloco.texto}
              </ThemedText>
            ) : (
              <View key={indice} style={styles.lista}>
                {bloco.itens.map((item) => (
                  <View key={item} style={styles.item}>
                    <View style={[styles.marca, { backgroundColor: theme.accent }]} />
                    <ThemedText style={[styles.texto, styles.flex]}>{item}</ThemedText>
                  </View>
                ))}
              </View>
            )
          )}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topo: {
    gap: Spacing.two,
  },
  seccao: {
    gap: Spacing.two,
  },
  titulo: {
    fontSize: 17,
    lineHeight: 23,
  },
  texto: {
    fontSize: 15,
    lineHeight: 23,
  },
  lista: {
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    gap: Spacing.twoAndHalf,
  },
  marca: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
  },
  flex: {
    flex: 1,
  },
});
