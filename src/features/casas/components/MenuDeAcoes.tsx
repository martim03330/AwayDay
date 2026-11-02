import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

export type AcaoDoMenu = { label: string; perigo?: boolean; onPress: () => void };

export type MenuAberto = { titulo: string; acoes: AcaoDoMenu[] };

/** How long the menu takes to fade away before the chosen action runs. */
export const DEPOIS_DE_FECHAR_MS = 450;

/**
 * A small sheet at the bottom with one line per action, title only. The action runs once the menu has faded away,
 * so it may show an alert or open another menu (e.g. «Mudar de transporte» → the vehicles).
 */
export function MenuDeAcoes({ menu, onFechar }: { menu: MenuAberto | null; onFechar: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={menu !== null} transparent animationType="fade" onRequestClose={onFechar}>
      <View style={styles.fundo}>
        {/* The dark background closes the menu; the menu sits beside it, not inside it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        />
        <View
          style={[
            styles.menu,
            { backgroundColor: theme.backgroundElement, marginBottom: insets.bottom + Spacing.two },
          ]}>
          {menu ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.titulo}>
              {menu.titulo}
            </ThemedText>
          ) : null}
          {(menu?.acoes ?? []).map((acao) => (
            <Pressable
              key={acao.label}
              onPress={() => {
                onFechar();
                // iOS drops an alert (or another sheet) asked for while this one is still fading away.
                setTimeout(acao.onPress, DEPOIS_DE_FECHAR_MS);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.opcao,
                { borderTopColor: theme.backgroundSelected },
                pressed && { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText style={acao.perigo ? { color: theme.dangerText } : undefined}>
                {acao.label}
              </ThemedText>
            </Pressable>
          ))}
          <Pressable
            onPress={onFechar}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.opcao,
              { borderTopColor: theme.backgroundSelected },
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Cancelar
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** The discreet «⋯» at the end of a row. */
export function BotaoReticencias({ nome, onPress }: { nome: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Mais opções sobre ${nome}`}
      style={({ pressed }) => [styles.mais, pressed && { opacity: 0.5 }]}>
      <ThemedText style={[styles.reticencias, { color: theme.textMuted }]}>⋯</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: Spacing.two,
  },
  menu: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  titulo: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  opcao: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  mais: {
    paddingHorizontal: Spacing.one,
    minWidth: 28,
    alignItems: 'center',
  },
  reticencias: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: 800,
  },
});
