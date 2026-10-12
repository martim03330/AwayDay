import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { vibrarSelecao } from '@/lib/vibrar';
import type { Nota } from '@/mocks/tipos';
import { Premivel } from '@/ui/premivel';
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
        <View style={styles.textos}>
          <ThemedText style={styles.label}>{label}</ThemedText>
          {description ? (
            <ThemedText style={styles.descricao} themeColor="textSecondary">
              {description}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText
          style={styles.valor}
          themeColor={value === null ? 'textSecondary' : 'accentInk'}>
          {value === null ? 'Sem nota' : `${value} · ${ROTULOS[value]}`}
        </ThemedText>
      </View>
      <View style={styles.opcoes} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {NOTAS.map((nota) => {
          const preenchida = value !== null && nota <= value;
          return (
            <Premivel
              key={nota}
              onPress={() => {
                vibrarSelecao();
                onChange(nota);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === nota }}
              accessibilityLabel={`${label}: ${nota} de 5, ${ROTULOS[nota]}`}
              style={({ pressed }) => [
                styles.opcao,
                preenchida
                  ? { backgroundColor: theme.accent, borderColor: theme.accent }
                  : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                value === nota && styles.escolhida,
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="score"
                style={[styles.numero, { color: preenchida ? theme.accentText : theme.textMuted }]}>
                {nota}
              </ThemedText>
            </Premivel>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  cabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  textos: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  descricao: {
    fontSize: 13,
    lineHeight: 18,
  },
  valor: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: 800,
  },
  opcoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  opcao: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  escolhida: {
    boxShadow: '0 0 0 3px #FFCE3A',
  },
  numero: {
    fontSize: 24,
    lineHeight: 28,
  },
  pressed: {
    opacity: 0.85,
  },
});
