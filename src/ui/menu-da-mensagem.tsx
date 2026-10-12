import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REACOES, type Emoji } from '@/lib/conversa';
import { Icon, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

export type AcaoDaMensagem = {
  label: string;
  icon: IconName;
  perigo?: boolean;
  onPress: () => void;
};

type MenuDaMensagemProps = {
  /** The message the menu is about; `null` keeps it closed. */
  texto: string | null;
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
export function MenuDaMensagem({ texto, onReagir, minhaReacao, acoes, onFechar }: MenuDaMensagemProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={texto !== null} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable
        style={[styles.fundo, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar">
        <View style={styles.conteudo}>
          {texto ? (
            <View style={[styles.mensagem, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText numberOfLines={4}>{texto}</ThemedText>
            </View>
          ) : null}

          {onReagir ? (
            <View
              style={[styles.reacoes, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="toolbar">
              {REACOES.map((emoji) => (
                <Pressable
                  key={emoji}
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
              ))}
            </View>
          ) : null}

          <View style={[styles.acoes, { backgroundColor: theme.backgroundElement }]}>
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
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  mensagem: {
    alignSelf: 'stretch',
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reacoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    transform: [{ scale: 1.15 }],
  },
  acoes: {
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
