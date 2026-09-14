import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const TOTAL_PASSOS = 4;
/** Acima deste número de caracteres, a frase usa letra mais pequena para não ocupar o ecrã todo. */
const LIMITE_FRASE_CURTA = 70;

type OnboardingPassoProps = {
  passo: 1 | 2 | 3 | 4;
  /** Uma frase por ecrã: é o que dá o tom à app. */
  frase: string;
  children: ReactNode;
  rodape: ReactNode;
};

export function OnboardingPasso({ passo, frase, children, rodape }: OnboardingPassoProps) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.ecra,
        { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}>
      <View style={styles.topo}>
        {passo > 1 ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => [styles.lateral, pressed && styles.pressed]}>
            <Icon name={icons.voltar} size={20} />
          </Pressable>
        ) : (
          <View style={styles.lateral} />
        )}
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
                  width: indice + 1 === passo ? 24 : 8,
                  backgroundColor: indice < passo ? theme.accent : theme.backgroundSelected,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.lateral} />
      </View>

      <ScrollView contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled">
        <ThemedText
          style={[styles.frase, frase.length > LIMITE_FRASE_CURTA && styles.fraseLonga]}
          accessibilityRole="header">
          {frase}
        </ThemedText>
        {children}
      </ScrollView>

      <View style={[styles.rodape, { borderTopColor: theme.border }]}>{rodape}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  lateral: {
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  progresso: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  pontoProgresso: {
    height: 8,
    borderRadius: 4,
  },
  conteudo: {
    gap: Spacing.four,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  frase: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: 700,
    marginTop: Spacing.two,
  },
  fraseLonga: {
    fontSize: 24,
    lineHeight: 30,
  },
  rodape: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
