import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { LinhaQueAbre } from '@/components/linha-que-abre';
import { Spacing } from '@/constants/theme';
import type { SafetyNote } from '@/features/safety/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import { Card } from '@/ui/card';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Orange marks home fans' places and areas, here and on the map. */
const COR_ADEPTOS_CASA = '#E8590C';

/** Red used for the areas to avoid, here and on the map (orange already marks home fans' places). */
export const COR_ZONA_A_EVITAR = '#C92A2A';

/** Display order and, for some kinds, a sentence added to the description once the row opens. */
const TIPOS: { kind: SafetyNote['kind']; detalhe?: string }[] = [
  { kind: 'percurso_visitantes' },
  {
    kind: 'zona_adeptos_casa',
    detalhe: 'Evita-a com as cores do teu clube.',
  },
  { kind: 'indicacao_oficial' },
  {
    kind: 'zona_a_evitar',
    detalhe: 'Está a vermelho no mapa.',
  },
];

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

function Marca({ kind }: { kind: SafetyNote['kind'] }) {
  if (kind === 'zona_a_evitar' || kind === 'zona_adeptos_casa') {
    return (
      <View
        style={[
          styles.marcaZona,
          { backgroundColor: kind === 'zona_a_evitar' ? COR_ZONA_A_EVITAR : COR_ADEPTOS_CASA },
        ]}>
        <Icon name={icons.aviso} size={18} color="#FFFFFF" />
      </View>
    );
  }
  return (
    <IconCircle
      name={kind === 'indicacao_oficial' ? icons.aviso : icons.pontoEncontro}
      tone="sky"
    />
  );
}

type CuidadosVisitantesProps = {
  notas: readonly SafetyNote[];
};

/**
 * What visiting fans should know, one row per note: the official route and entrance, areas home supporters hold, how
 * the police organised visitors in derbies, and areas with incidents. The description and the sources open on tap.
 */
export function CuidadosVisitantes({ notas }: CuidadosVisitantesProps) {
  const ordenadas = TIPOS.flatMap((tipo) =>
    notas.filter((nota) => nota.kind === tipo.kind).map((nota) => ({ nota, tipo }))
  );
  if (ordenadas.length === 0) return null;

  return (
    <Card style={styles.card}>
      {ordenadas.map(({ nota, tipo }) => (
        <LinhaQueAbre
          key={nota.id}
          leading={<Marca kind={nota.kind} />}
          title={nota.title}
          separador>
          <ThemedText type="small" themeColor="textSecondary">
            {tipo.detalhe ? `${nota.description} ${tipo.detalhe}` : nota.description}
          </ThemedText>
          <Fontes nota={nota} />
        </LinhaQueAbre>
      ))}
      <ThemedText type="small" themeColor="textMuted" style={styles.rodape}>
        Muda de jogo para jogo: segue sempre a PSP no dia.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  marcaZona: {
    width: 41,
    height: 41,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontes: {
    gap: 2,
  },
  fonte: {
    textDecorationLine: 'underline',
  },
  rodape: {
    paddingVertical: Spacing.twoAndHalf,
  },
});
