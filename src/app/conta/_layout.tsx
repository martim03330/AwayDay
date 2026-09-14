import { Stack, useNavigation, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { Colors, fontFamily } from '@/constants/theme';
import { closeAccountFlow } from '@/features/auth/navigation';
import { Icon, icons } from '@/ui/icon';

function BotaoFechar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Fechar"
      style={({ pressed }) => [styles.fechar, pressed && styles.pressed]}>
      <Icon name={icons.fechar} size={18} />
    </Pressable>
  );
}

/** Conta: abre em modal por cima da introdução ou das tabs. */
export default function ContaLayout() {
  const router = useRouter();
  const raiz = useNavigation('/');
  const fechar = () => closeAccountFlow(router, raiz);

  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerTintColor: Colors.text,
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { fontFamily: fontFamily('body', 800), fontSize: 16, color: Colors.text },
        contentStyle: { backgroundColor: Colors.background },
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
    backgroundColor: Colors.backgroundElement,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.6,
  },
});
