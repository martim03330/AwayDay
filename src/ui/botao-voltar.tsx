import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';

/**
 * Back button for the first screen of a stack that opens over the tabs (a group, a car, a trip). Opened from a
 * notification there may be nothing to go back to, and the native back button then disappears: this one is always
 * there and, with no history, goes to `destino` instead.
 */
export function BotaoVoltar({ destino }: { destino: Href }) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(destino))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      testID="botao-voltar"
      style={({ pressed }) => [styles.botao, pressed && styles.pressed]}>
      <Icon name={icons.voltar} size={26} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  botao: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
