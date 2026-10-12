import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REACOES, type Emoji } from '@/lib/conversa';
import { Icon, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/**
 * As in WhatsApp, but calm: the message and the reactions grow in from just below their size (0.94) with a soft
 * ease-out, the emojis follow one after the other, and the actions fade in last. No springs: nothing overshoots.
 */
const SUAVE = Easing.out(Easing.cubic);
const ENTRADA_DA_BOLHA = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.94 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: SUAVE },
}).duration(180);
const entradaDoEmoji = (indice: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.7 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: SUAVE },
  })
    .delay(30 + indice * 18)
    .duration(170);
const ENTRADA_DAS_ACOES = FadeIn.delay(70).duration(150).easing(SUAVE);

export type AcaoDaMensagem = {
  label: string;
  icon: IconName;
  perigo?: boolean;
  onPress: () => void;
};

type MenuDaMensagemProps = {
  /** The message the menu is about; `null` keeps it closed. */
  texto: string | null;
  /** Yours: the bubble shows green, on the right, as in the chat. */
  minha?: boolean;
  /** Reactions are offered only when there is somewhere to send them. */
  onReagir?: (emoji: Emoji) => void;
  minhaReacao: Emoji | null;
  acoes: readonly AcaoDaMensagem[];
  onFechar: () => void;
};

/**
 * What opens on a long press on a message, as in WhatsApp: a bar of reactions on top (yours highlighted; the same one
 * again takes it away) and the actions below (reply, edit, delete, report). Tapping outside closes it.
 */
export function MenuDaMensagem({ texto, minha = false, onReagir, minhaReacao, acoes, onFechar }: MenuDaMensagemProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduzirMovimento = useReducedMotion();
  const anima = <T,>(animacao: T) => (reduzirMovimento ? undefined : animacao);

  return (
    // No Modal animation (its fade is slow): the backdrop fades in and the menu appears where it stays, with a short
    // fade and a few pixels of movement, so the reactions can be tapped almost at once.
    <Modal visible={texto !== null} transparent animationType="none" onRequestClose={onFechar}>
      <Animated.View entering={FadeIn.duration(100)} style={styles.tudo}>
      <Pressable
        style={[styles.fundo, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar">
        <View style={styles.conteudo}>
          {/* Reactions above the message, actions below it, as in WhatsApp. */}
          {onReagir ? (
            <Animated.View
              entering={anima(ENTRADA_DA_BOLHA)}
              style={[styles.reacoes, minha ? styles.aDireita : styles.aEsquerda, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="toolbar">
              {REACOES.map((emoji, indice) => (
                <Animated.View key={emoji} entering={anima(entradaDoEmoji(indice))}>
                <Pressable
                  onPress={() => {
                    onReagir(emoji);
                    onFechar();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={minhaReacao === emoji ? `Tirar ${emoji}` : `Reagir com ${emoji}`}
                  accessibilityState={{ selected: minhaReacao === emoji }}
                  style={({ pressed }) => [
                    styles.emoji,
                    minhaReacao === emoji && { backgroundColor: theme.successBackground },
                    pressed && styles.premido,
                  ]}>
                  <ThemedText style={styles.textoEmoji}>{emoji}</ThemedText>
                </Pressable>
                </Animated.View>
              ))}
            </Animated.View>
          ) : null}

          {texto ? (
            <Animated.View
              entering={anima(ENTRADA_DA_BOLHA)}
              style={[
                styles.mensagem,
                minha
                  ? [styles.aDireita, { backgroundColor: theme.accent, borderBottomRightRadius: 6 }]
                  : [styles.aEsquerda, { backgroundColor: theme.backgroundElement, borderBottomLeftRadius: 6 }],
              ]}>
              <ThemedText numberOfLines={6} style={{ color: minha ? theme.accentText : theme.text }}>
                {texto}
              </ThemedText>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={anima(ENTRADA_DAS_ACOES)}
            style={[styles.acoes, minha ? styles.aDireita : styles.aEsquerda, { backgroundColor: theme.backgroundElement }]}>
            {acoes.map((acao, indice) => (
              <Pressable
                key={acao.label}
                onPress={() => {
                  onFechar();
                  acao.onPress();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.acao,
                  indice < acoes.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                  pressed && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText style={[styles.textoAcao, acao.perigo && { color: theme.dangerText }]}>
                  {acao.label}
                </ThemedText>
                <Icon name={acao.icon} size={20} color={acao.perigo ? theme.dangerText : theme.text} />
              </Pressable>
            ))}
          </Animated.View>
        </View>
      </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tudo: {
    flex: 1,
  },
  fundo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: Spacing.three,
  },
  conteudo: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  aDireita: {
    alignSelf: 'flex-end',
  },
  aEsquerda: {
    alignSelf: 'flex-start',
  },
  mensagem: {
    maxWidth: '85%',
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reacoes: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  emoji: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoEmoji: {
    fontSize: 26,
    lineHeight: 32,
  },
  premido: {
    transform: [{ scale: 1.2 }],
  },
  acoes: {
    minWidth: 240,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  textoAcao: {
    fontSize: 16,
  },
});
