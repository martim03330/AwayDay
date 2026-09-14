import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon, icons } from '@/ui/icon';

function BotaoFechar() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Fechar">
      <Icon name={icons.fechar} size={20} />
    </Pressable>
  );
}

/** Conta: abre em modal por cima da introdução ou das tabs. */
export default function ContaLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="entrar" options={{ title: 'Entrar', headerLeft: () => <BotaoFechar /> }} />
      <Stack.Screen
        name="criar-conta"
        options={{ title: 'Criar conta', headerLeft: () => <BotaoFechar /> }}
      />
      <Stack.Screen name="confirmar-email" options={{ title: 'Confirmar email' }} />
      <Stack.Screen name="recuperar-password" options={{ title: 'Recuperar password' }} />
      <Stack.Screen name="nova-password" options={{ title: 'Nova password' }} />
    </Stack>
  );
}
