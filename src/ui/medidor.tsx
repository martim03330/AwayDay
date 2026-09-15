import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Nota } from '@/mocks/tipos';
import { Icon, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** `amarelo`: beer (cervejómetro). `verde`: food (petiscómetro). */
export type TomMedidor = 'amarelo' | 'verde';

type MedidorProps = {
  label: string;
  icon: IconName;
  /** `null` until enough people rated. */
  value: Nota | null;
  tone?: TomMedidor;
  compact?: boolean;
};

const ESCALA = [1, 2, 3, 4, 5] as const;

/** Escala de 1 a 5 com ícones, usada no cervejómetro e no petiscómetro. */
export function Medidor({ label, icon, value, tone = 'verde', compact = false }: MedidorProps) {
  const theme = useTheme();
  const accessibilityLabel =
    value === null ? `${label}: ainda sem notas suficientes` : `${label}: ${value} de 5`;
  const cores = {
    amarelo: { fundo: theme.warningBackground, texto: theme.warning, cheio: theme.warning },
    verde: { fundo: theme.successBackground, texto: theme.successText, cheio: theme.accent },
  }[tone];

  if (compact) {
    return (
      <View
        accessible
        accessibilityLabel={accessibilityLabel}
        style={[styles.pill, { backgroundColor: cores.fundo }]}>
        <Icon name={icon} size={16} color={cores.texto} />
        <ThemedText style={[styles.pillTexto, { color: cores.texto }]}>
          {value === null ? 'Sem notas' : `${value}/5`}
        </ThemedText>
      </View>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.full}>
      <View style={styles.esquerda}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        <View style={styles.escala}>
          {ESCALA.map((step) => (
            <Icon
              key={step}
              name={icon}
              size={24}
              color={value !== null && step <= value ? cores.cheio : theme.borderStrong}
            />
          ))}
        </View>
      </View>
      {value === null ? (
        <ThemedText themeColor="textMuted" style={styles.semNotas}>
          Poucas notas
        </ThemedText>
      ) : (
        <ThemedText type="score" style={styles.valor}>
          {value}
          <ThemedText type="score" themeColor="textMuted" style={styles.deCinco}>
            {' de 5'}
          </ThemedText>
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: Radius.pill,
  },
  pillTexto: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  full: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  esquerda: {
    flex: 1,
    gap: 6,
  },
  label: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  escala: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  valor: {
    fontSize: 28,
    lineHeight: 32,
  },
  deCinco: {
    fontSize: 16,
    lineHeight: 32,
  },
  semNotas: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
});
