import { Stack, useNavigation, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { fontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { closeAccountFlow } from '@/features/auth/navigation';
import { Icon, icons } from '@/ui/icon';

function BotaoFechar({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
  );
}

/** Conta: abre em modal por cima da introdução ou das tabs. */
export default function ContaLayout() {
  const router = useRouter();
  const theme = useTheme();
  const raiz = useNavigation('/');
  const fechar = () => closeAccountFlow(router, raiz);

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerTintColor: theme.text,
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { fontFamily: fontFamily('body', 800), fontSize: 16, color: theme.text },
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen
        name="entrar"
        options={{ title: 'Entrar', headerLeft: () => <BotaoFechar onPress={fechar} /> }}
      />
      <Stack.Screen
        name="criar-conta"
        options={{ title: 'Criar conta', headerLeft: () => <BotaoFechar onPress={fechar} /> }}
      />
      <Stack.Screen name="confirmar-email" options={{ title: 'Confirmar email' }} />
      <Stack.Screen name="recuperar-password" options={{ title: 'Recuperar password' }} />
      <Stack.Screen name="nova-password" options={{ title: 'Nova password' }} />
      <Stack.Screen
        name="apagar-conta"
        options={{ title: 'Apagar conta', headerLeft: () => <BotaoFechar onPress={fechar} /> }}
      />
    </Stack>
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
