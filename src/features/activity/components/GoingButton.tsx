import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { fetchGoingCount } from '@/features/activity/api';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';
import { usePlanosJogos } from '@/state/planos-jogos';
import { Button } from '@/ui/button';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const DURACAO_MS = 300;

/**
 * "Vou a este jogo" on an upcoming fixture. With an account it is saved there (and feeds the match-day suggestions);
 * without one, on this phone. Once marked, it opens "O meu jogo".
 */
export function GoingButton({ fixtureId }: { fixtureId: string }) {
  const router = useRouter();
  const { vou, alternarVou } = usePlanosJogos();
  const [aGuardar, setAGuardar] = useState(false);
  const going = vou(fixtureId);
  const { modoDemo } = useAppState();
  const queryClient = useQueryClient();
  // Fans with an account who said they are going; only shown from 5 people up.
  const quantos = useQuery({
    queryKey: ['going-count', fixtureId],
    queryFn: modoDemo ? skipToken : () => fetchGoingCount(fixtureId),
    staleTime: 60 * 1000,
    meta: { persist: false },
  });

  function toggle() {
    if (aGuardar) return;
    setAGuardar(true);
    void alternarVou(fixtureId).finally(() => {
      setAGuardar(false);
      void queryClient.invalidateQueries({ queryKey: ['going-count', fixtureId] });
    });
  }

  return (
    <View style={styles.block}>
      <BilheteAlternar going={going} onPress={toggle} />
      {going ? (
        <Button
          label="Abrir o meu jogo"
          variant="secondary"
          icon={icons.acesso}
          onPress={() =>
            router.push({ pathname: '/jogos/o-meu-jogo', params: { jogoId: fixtureId } })
          }
        />
      ) : null}
      <ThemedText themeColor="textSecondary" style={styles.help}>
        {going
          ? 'Toca outra vez se mudares de planos.'
          : 'Marca e preparamos o teu dia: tasco, horas e avisos.'}
      </ThemedText>
      {modoDemo || quantos.isLoading ? null : (
        <ThemedText type="smallBold" style={styles.help}>
          {quantos.data != null
            ? `${quantos.data} adeptos da app vão a este jogo`
            : 'Ainda são menos de 5 adeptos da app a ir a este jogo. Mostramos o número a partir de 5.'}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * The toggle drawn as a ticket: dashed outline while not going, solid green once marked.
 * Same transition as `BotaoAlternar` (colour fade, press bounce, content fade), which cannot draw
 * the dashed state.
 */
function BilheteAlternar({ going, onPress }: { going: boolean; onPress: () => void }) {
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const progresso = useSharedValue(going ? 1 : 0);
  const escala = useSharedValue(1);

  // Only animate the content after the first change, not when the screen opens.
  const [anterior, setAnterior] = useState(going);
  const [mudancas, setMudancas] = useState(0);
  if (anterior !== going) {
    setAnterior(going);
    setMudancas((total) => total + 1);
  }

  useEffect(() => {
    progresso.set(withTiming(going ? 1 : 0, { duration: reduzirMovimento ? 0 : DURACAO_MS }));
  }, [going, progresso, reduzirMovimento]);

  const fundo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progresso.get(),
      [0, 1],
      [theme.backgroundElement, theme.accent]
    ),
    transform: [{ scale: escala.get() }],
  }));

  function tocar() {
    if (!reduzirMovimento) {
      escala.set(
        withSequence(withTiming(0.96, { duration: 90 }), withTiming(1, { duration: 160 }))
      );
    }
    onPress();
  }

  const cor = going ? theme.accentText : theme.accentInk;
  const texto = going ? 'Vais a este jogo' : 'Vou a este jogo';

  return (
    <Pressable
      onPress={tocar}
      accessibilityRole="button"
      accessibilityState={{ selected: going }}
      accessibilityLabel={texto}>
      <Animated.View
        style={[
          styles.botao,
          { borderColor: theme.accent, borderStyle: going ? 'solid' : 'dashed' },
          fundo,
        ]}>
        <Animated.View
          key={String(going)}
          entering={mudancas > 0 && !reduzirMovimento ? FadeIn.duration(DURACAO_MS) : undefined}
          style={styles.conteudo}>
          <Icon name={going ? icons.selecionado : icons.acesso} size={22} color={cor} />
          <ThemedText style={[styles.label, { color: cor }]}>{texto}</ThemedText>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  botao: {
    minHeight: 60,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 2,
  },
  conteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  help: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
