import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Nota } from '@/mocks/tipos';
import { ThemedText } from '@/ui/themed-text';

const NOTAS: readonly Nota[] = [1, 2, 3, 4, 5];

const ROTULOS: Record<Nota, string> = {
  1: 'Mau',
  2: 'Fraco',
  3: 'Razoável',
  4: 'Bom',
  5: 'Excelente',
};

type SeletorNotaProps = {
  label: string;
  description?: string;
  value: Nota | null;
  onChange: (nota: Nota) => void;
};

export function SeletorNota({ label, description, value, onChange }: SeletorNotaProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.cabecalho}>
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {value === null ? 'Sem nota' : `${value} · ${ROTULOS[value]}`}
        </ThemedText>
      </View>
      {description ? (
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      ) : null}
      <View style={styles.opcoes} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {NOTAS.map((nota) => {
          const preenchida = value !== null && nota <= value;
          return (
            <Pressable
              key={nota}
              onPress={() => onChange(nota)}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === nota }}
              accessibilityLabel={`${label}: ${nota} de 5, ${ROTULOS[nota]}`}
              style={({ pressed }) => [
                styles.opcao,
                { backgroundColor: preenchida ? theme.accent : theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                style={[styles.numero, { color: preenchida ? theme.accentText : theme.text }]}>
                {nota}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opcoes: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  opcao: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  numero: {
    fontSize: 17,
  },
  pressed: {
    opacity: 0.7,
  },
});
