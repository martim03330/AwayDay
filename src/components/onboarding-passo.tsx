import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useBarraDeEstadoClara } from '@/hooks/use-barra-de-estado-clara';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const TOTAL_PASSOS = 3;
/** Acima deste número de caracteres, a frase usa letra mais pequena para não ocupar o ecrã todo. */
const LIMITE_FRASE_CURTA = 70;
/** Mowing stripes: 36 px wide, every 72 px. */
const STRIPES = Array.from({ length: 16 }, (_, index) => index * 72 + 36);

type OnboardingPassoProps = {
  passo: 1 | 2 | 3 | 4;
  /** Uma frase por ecrã: é o que dá o tom à app. */
  frase: string;
  children: ReactNode;
  rodape: ReactNode;
};

export function OnboardingPasso({ passo, frase, children, rodape }: OnboardingPassoProps) {
  useBarraDeEstadoClara();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.ecra}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STRIPES.map((left) => (
          <View key={left} style={[styles.risca, { left }]} />
        ))}
        <View style={styles.circuloCentral}>
          <Svg width={340} height={340} viewBox="0 0 340 340" fill="none" stroke={Colors.accentText} strokeWidth={3}>
            <Circle cx={170} cy={170} r={100} />
            <Path d="M0 170H340" />
          </Svg>
        </View>
      </View>

      <View style={[styles.topo, { paddingTop: insets.top + Spacing.three }]}>
        <View style={styles.barraTopo}>
          {passo > 1 ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={({ pressed }) => [styles.voltar, pressed && styles.pressed]}>
              <Icon name={icons.voltar} size={20} color={Colors.accentText} />
            </Pressable>
          ) : null}
          <View
            style={styles.progresso}
            accessible
            accessibilityLabel={`Passo ${passo} de ${TOTAL_PASSOS}`}>
            {Array.from({ length: TOTAL_PASSOS }, (_, indice) => (
              <View
                key={indice}
                style={[
                  styles.pontoProgresso,
                  {
                    width: indice + 1 === passo ? 28 : 8,
                    backgroundColor: indice < passo ? Colors.highlight : 'rgba(255, 255, 255, 0.35)',
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <ThemedText
          type="title"
          style={[styles.frase, frase.length > LIMITE_FRASE_CURTA && styles.fraseLonga]}
          accessibilityRole="header">
          {frase}
        </ThemedText>
      </View>

      <View style={[styles.folha, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>

        <View
          style={[
            styles.rodape,
            {
              borderTopColor: theme.border,
              backgroundColor: theme.background,
              paddingBottom: Math.max(insets.bottom, Spacing.three),
            },
          ]}>
          {rodape}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Colors.accent,
  },
  risca: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
  },
  circuloCentral: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.16,
  },
  topo: {
    gap: 22,
    paddingHorizontal: 22,
    paddingBottom: 26,
  },
  barraTopo: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  voltar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  pressed: {
    opacity: 0.6,
  },
  progresso: {
    flexDirection: 'row',
    gap: 6,
  },
  pontoProgresso: {
    height: 8,
    borderRadius: 4,
  },
  frase: {
    fontSize: 46,
    lineHeight: 50,
    color: Colors.accentText,
  },
  fraseLonga: {
    fontSize: 32,
    lineHeight: 36,
  },
  folha: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: Radius.header,
    borderTopRightRadius: Radius.header,
  },
  conteudo: {
    gap: Spacing.two,
    paddingTop: 22,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  rodape: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: 14,
    borderTopWidth: 1,
  },
});
