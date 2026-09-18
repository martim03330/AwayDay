import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

type Opcao<T extends string> = { valor: T; label: string };

type SegmentadoProps<T extends string> = {
  opcoes: readonly Opcao<T>[];
  valor: T;
  onChange: (valor: T) => void;
};

/** Duas ou três vistas do mesmo ecrã, lado a lado («Lista | Acertar contas»). */
export function Segmentado<T extends string>({ opcoes, valor, onChange }: SegmentadoProps<T>) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.caixa, { backgroundColor: theme.backgroundSelected }]}>
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <Pressable
            key={opcao.valor}
            onPress={() => onChange(opcao.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            style={[
              styles.opcao,
              ativo && [styles.ativa, { backgroundColor: theme.backgroundElement }],
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: ativo ? theme.text : theme.textSecondary }}
              numberOfLines={1}>
              {opcao.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
  ativa: {
    boxShadow: '0 1px 3px rgba(19, 36, 27, 0.12)',
  },
});
