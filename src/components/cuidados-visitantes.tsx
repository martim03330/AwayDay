import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { SafetyNote } from '@/features/safety/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import type { Clube } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Red used for the areas to avoid, here and on the map (orange already marks home fans' places). */
export const COR_ZONA_A_EVITAR = '#C92A2A';

function Fontes({ nota }: { nota: SafetyNote }) {
  const theme = useTheme();
  return (
    <View style={styles.fontes}>
      {nota.sources.map((fonte) => (
        <Pressable
          key={fonte.url}
          onPress={() => void Linking.openURL(fonte.url).catch(() => undefined)}
          accessibilityRole="link"
          accessibilityLabel={`Fonte: ${fonte.title}${fonte.date ? `, ${formatarData(new Date(fonte.date))}` : ''}. Abre no navegador.`}>
          <ThemedText type="small" style={[styles.fonte, { color: theme.accentInk }]}>
            {`Fonte: ${fonte.title}${fonte.date ? ` · ${formatarData(new Date(fonte.date))}` : ''}`}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function Nota({ nota }: { nota: SafetyNote }) {
  const theme = useTheme();
  const zona = nota.kind === 'zona_a_evitar';
  return (
    <View style={[styles.nota, { borderTopColor: theme.backgroundSelected }]}>
      <View style={styles.cabecalhoNota}>
        {zona ? (
          <View style={[styles.marcaZona, { backgroundColor: COR_ZONA_A_EVITAR }]}>
            <Icon name={icons.aviso} size={16} color="#FFFFFF" />
          </View>
        ) : (
          <IconCircle name={icons.pontoEncontro} tone="sky" />
        )}
        <ThemedText style={styles.titulo}>{nota.title}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {nota.description}
      </ThemedText>
      <Fontes nota={nota} />
    </View>
  );
}

type CuidadosVisitantesProps = {
  notas: readonly SafetyNote[];
  visitante: Clube;
};

/** What visiting fans should know in a derby: how the police usually organised them, and areas with incidents. */
export function CuidadosVisitantes({ notas, visitante }: CuidadosVisitantesProps) {
  const indicacoes = notas.filter((nota) => nota.kind === 'indicacao_oficial');
  const zonas = notas.filter((nota) => nota.kind === 'zona_a_evitar');
  if (notas.length === 0) return null;

  return (
    <Card style={styles.card}>
      <ThemedText type="eyebrow" themeColor="accentInk">
        {`Para adeptos do ${visitante.nomeCurto}`}
      </ThemedText>

      {indicacoes.length > 0 ? (
        <View style={styles.grupo}>
          <ThemedText type="smallBold">Como a PSP tem organizado os visitantes</ThemedText>
          {indicacoes.map((nota) => (
            <Nota key={nota.id} nota={nota} />
          ))}
        </View>
      ) : null}

      {zonas.length > 0 ? (
        <View style={styles.grupo}>
          <ThemedText type="smallBold">Zonas a evitar com as cores do clube</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Houve incidentes nestas zonas nas últimas épocas. Estão marcadas a vermelho no mapa.
          </ThemedText>
          {zonas.map((nota) => (
            <Nota key={nota.id} nota={nota} />
          ))}
        </View>
      ) : null}

      <ThemedText type="smallBold">
        As indicações mudam de jogo para jogo. Segue sempre as indicações da PSP no dia do jogo.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  grupo: {
    gap: Spacing.two,
  },
  nota: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  cabecalhoNota: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  marcaZona: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  fontes: {
    gap: 2,
  },
  fonte: {
    textDecorationLine: 'underline',
  },
});
