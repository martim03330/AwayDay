import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { fontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons } from '@/ui/icon';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

/** Privacidade, termos e contactos: abrem em modal por cima de qualquer sítio (criar conta, definições, introdução). */
export default function LegalLayout() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS,
        headerShadowVisible: false,
        headerTintColor: theme.text,
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { fontFamily: fontFamily('body', 800), fontSize: 16, color: theme.text },
        contentStyle: { backgroundColor: theme.background },
        headerLeft: () => (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={({ pressed }) => [
              styles.fechar,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <Icon name={icons.fechar} size={18} color={theme.text} />
          </Pressable>
        ),
      }}
    />
  );
}

const styles = StyleSheet.create({
  fechar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
