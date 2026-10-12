import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons, type IconName } from '@/ui/icon';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

type ExpansorProps = {
  titulo: string;
  /** A short line under the title (e.g. «Fecham ruas e parques»). */
  subtitulo?: string;
  icon?: IconName;
  /** How many things are inside, in a pill on the right. */
  contagem?: number;
  aberto: boolean;
  onPress: () => void;
  /** 'aviso' for match-day warnings: amber instead of green. */
  tom?: 'normal' | 'aviso';
};

/**
 * Everything that opens and closes («Mais 16 parques», «3 avisos para dia de jogo», «Porquê?»): a soft rounded band
 * with an icon, the title, a count and a round arrow that turns as it opens. Replaces the green text links with «>»,
 * which testers found cheap-looking.
 */
export function Expansor({
  titulo,
  subtitulo,
  icon,
  contagem,
  aberto,
  onPress,
  tom = 'normal',
}: ExpansorProps) {
  const theme = useTheme();
  const aviso = tom === 'aviso';
  const fundo = aviso ? theme.warningBackground : theme.backgroundSelected;
  const tinta = aviso ? theme.warningText : theme.accentInk;
  const circulo = aviso ? 'rgba(255, 255, 255, 0.55)' : theme.backgroundElement;

  const seta = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(aberto ? '90deg' : '0deg', { duration: 180 }) }],
  }));

  return (
    <Premivel
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberto }}
      accessibilityLabel={[titulo, subtitulo, contagem !== undefined ? String(contagem) : null]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.faixa, { backgroundColor: fundo }, pressed && styles.premido]}>
      {icon ? (
        <View style={[styles.icone, { backgroundColor: circulo }]}>
          <Icon name={icon} size={18} color={tinta} />
        </View>
      ) : null}
      <View style={styles.texto}>
        <ThemedText style={[styles.titulo, aviso && { color: theme.warningText }]} numberOfLines={2}>
          {titulo}
        </ThemedText>
        {subtitulo ? (
          <ThemedText
            type="small"
            style={{ color: aviso ? theme.warningText : theme.textSecondary }}
            numberOfLines={2}>
            {subtitulo}
          </ThemedText>
        ) : null}
      </View>
      {contagem !== undefined ? (
        <View style={[styles.contagem, { backgroundColor: aviso ? theme.warningText : theme.accent }]}>
          <ThemedText style={[styles.contagemTexto, { color: aviso ? theme.warningBackground : theme.accentText }]}>
            {contagem}
          </ThemedText>
        </View>
      ) : null}
      <Animated.View style={[styles.seta, { backgroundColor: circulo }, seta]}>
        <Icon name={icons.seguinte} size={16} color={tinta} />
      </Animated.View>
    </Premivel>
  );
}

const styles = StyleSheet.create({
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.twoAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  premido: {
    opacity: 0.85,
  },
  icone: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    flex: 1,
    gap: 1,
  },
  titulo: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  contagem: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contagemTexto: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: 800,
  },
  seta: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
