import { ScrollView, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { vibrarSelecao } from '@/lib/vibrar';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

type Opcao<T extends string> = { valor: T; label: string };

type SegmentadoProps<T extends string> = {
  opcoes: readonly Opcao<T>[];
  valor: T;
  onChange: (valor: T) => void;
  /**
   * Many options with longer labels (price ranges): each keeps its full width and the bar scrolls sideways, instead
   * of squeezing every label into an equal slice.
   */
  deslizante?: boolean;
};

/** Duas ou três vistas do mesmo ecrã, lado a lado («Lista | Acertar contas»). */
export function Segmentado<T extends string>({ opcoes, valor, onChange, deslizante = false }: SegmentadoProps<T>) {
  const theme = useTheme();
  const barra = (
    <View
      accessibilityRole="tablist"
      style={[styles.caixa, { backgroundColor: theme.backgroundSelected }, deslizante && styles.caixaDeslizante]}>
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <Premivel
            key={opcao.valor}
            onPress={() => {
              if (!ativo) vibrarSelecao();
              onChange(opcao.valor);
            }}
            accessibilityRole="tab"
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityState={{ selected: ativo }}
            style={[
              styles.opcao,
              deslizante && styles.opcaoDeslizante,
              ativo && [styles.ativa, { backgroundColor: theme.backgroundElement }],
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: ativo ? theme.text : theme.textSecondary }}
              numberOfLines={1}>
              {opcao.label}
            </ThemedText>
          </Premivel>
        );
      })}
    </View>
  );

  if (!deslizante) return barra;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {barra}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  caixa: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.pill,
    gap: 4,
  },
  opcao: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
  },
  caixaDeslizante: {
    alignSelf: 'flex-start',
  },
  opcaoDeslizante: {
    flex: 0,
    minWidth: 92,
    paddingHorizontal: Spacing.three,
  },
  ativa: {
    boxShadow: '0 1px 3px rgba(19, 36, 27, 0.12)',
  },
});
