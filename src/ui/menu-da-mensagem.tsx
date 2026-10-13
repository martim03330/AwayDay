import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REACOES, type Citacao, type Emoji } from '@/lib/conversa';
import { type PosicaoNoEcra, useCoresDaConversa } from '@/ui/conversa';
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

const ALTURA_REACOES = 54;
const ALTURA_ACAO = 51;
const ESPACO = 8;
const MARGEM = 12;

/**
 * Where each part goes: the message where it was, the reactions just above, the actions just below. When they would
 * leave the screen, everything moves up (or down) together, and a very tall message is cut to what fits.
 */
function arrumar(
  posicao: PosicaoNoEcra,
  larguraDoEcra: number,
  alturaDoEcra: number,
  margens: { top: number; bottom: number },
  comReacoes: boolean,
  quantasAcoes: number
) {
  const topo = margens.top + MARGEM;
  const fundo = alturaDoEcra - Math.max(margens.bottom, MARGEM) - MARGEM;
  const alturaReacoes = comReacoes ? ALTURA_REACOES + ESPACO : 0;
  const alturaAcoes = quantasAcoes * ALTURA_ACAO + ESPACO;
  const altura = Math.max(40, Math.min(posicao.altura, fundo - topo - alturaReacoes - alturaAcoes));
  let mensagem = posicao.y;
  if (mensagem + altura + alturaAcoes > fundo) mensagem = fundo - alturaAcoes - altura;
  if (mensagem - alturaReacoes < topo) mensagem = topo + alturaReacoes;
  return {
    x: posicao.x,
    largura: posicao.largura,
    altura,
    margemDireita: Math.max(MARGEM, larguraDoEcra - (posicao.x + posicao.largura)),
    mensagem,
    reacoes: mensagem - alturaReacoes,
    acoes: mensagem + altura + ESPACO,
  };
}

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
  /** Where the held bubble is: the message is drawn right there, reactions above it and actions below. */
  posicao?: PosicaoNoEcra | null;
  /** The message's time, as under the bubble («editada · 14:27» when edited). */
  hora?: string;
  /** Who wrote it, when the bubble shows the name on top (someone else's, first of a run). */
  nome?: string | null;
  /** The message it replies to, as quoted on top of the bubble. */
  citacao?: Citacao | null;
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
export function MenuDaMensagem({
  texto,
  minha = false,
  posicao = null,
  hora,
  nome = null,
  citacao = null,
  onReagir,
  minhaReacao,
  acoes,
  onFechar,
}: MenuDaMensagemProps) {
  const theme = useTheme();
  const cores = useCoresDaConversa();
  const insets = useSafeAreaInsets();
  const ecra = useWindowDimensions();
  const lugar = posicao ? arrumar(posicao, ecra.width, ecra.height, insets, onReagir !== undefined, acoes.length) : null;
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
        <View style={lugar ? styles.camada : styles.conteudo} pointerEvents="box-none">
          {/* Reactions above the message, actions below it, as in WhatsApp. */}
          {onReagir ? (
            <Animated.View
              entering={anima(ENTRADA_DA_BOLHA)}
              style={[
                styles.reacoes,
                { backgroundColor: theme.backgroundElement },
                lugar
                  ? [styles.solto, { top: lugar.reacoes }, minha ? { right: lugar.margemDireita } : { left: lugar.x }]
                  : minha
                    ? styles.aDireita
                    : styles.aEsquerda,
              ]}
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
                  ? { backgroundColor: theme.accent, borderBottomRightRadius: 6 }
                  : [cores.bolhaDosOutros, { borderBottomLeftRadius: 6 }],
                lugar
                  ? [styles.solto, { top: lugar.mensagem, left: lugar.x, width: lugar.largura, maxHeight: lugar.altura }]
                  : [styles.mensagemLivre, minha ? styles.aDireita : styles.aEsquerda],
              ]}>
              {/* The same parts as the bubble in the chat (name, quote, text, time), so the copy sits right over it. */}
              {nome ? (
                <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                  {nome}
                </ThemedText>
              ) : null}
              {citacao ? (
                <View
                  style={[
                    styles.citacao,
                    {
                      borderLeftColor: minha ? theme.accentText : theme.accentInk,
                      backgroundColor: minha ? 'rgba(255,255,255,0.16)' : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    numberOfLines={1}
                    style={{ color: minha ? theme.accentText : theme.accentInk }}>
                    {citacao.displayName ?? 'Um adepto'}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    numberOfLines={2}
                    style={{ color: minha ? theme.accentText : theme.textSecondary }}>
                    {citacao.body ?? 'Mensagem indisponível'}
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText
                numberOfLines={lugar ? undefined : 6}
                style={{ color: minha ? theme.accentText : theme.text }}>
                {texto}
              </ThemedText>
              {hora ? (
                <ThemedText type="small" style={[styles.hora, { color: minha ? theme.accentText : theme.textMuted }]}>
                  {hora}
                </ThemedText>
              ) : null}
            </Animated.View>
          ) : null}

          <Animated.View
            entering={anima(ENTRADA_DAS_ACOES)}
            style={[
              styles.acoes,
              { backgroundColor: theme.backgroundElement },
              lugar
                ? [styles.solto, { top: lugar.acoes }, minha ? { right: lugar.margemDireita } : { left: lugar.x }]
                : minha
                  ? styles.aDireita
                  : styles.aEsquerda,
            ]}>
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
  camada: {
    ...StyleSheet.absoluteFill,
  },
  solto: {
    position: 'absolute',
  },
  mensagemLivre: {
    maxWidth: '85%',
  },
  citacao: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginBottom: 2,
  },
  hora: {
    alignSelf: 'flex-end',
    fontSize: 11,
    opacity: 0.75,
  },
  mensagem: {
    overflow: 'hidden',
    gap: 2,
    borderRadius: 18,
    borderCurve: 'continuous',
    // Same as the chat bubble, so the copy sits exactly over it.
    paddingHorizontal: Spacing.twoAndHalf,
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
