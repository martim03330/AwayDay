import { Stack, useNavigation, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { closeAccountFlow } from '@/features/auth/navigation';
import { Icon, icons } from '@/ui/icon';

function BotaoFechar({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar">
      <Icon name={icons.fechar} size={20} />
    </Pressable>
  );
}

/** Conta: abre em modal por cima da introdução ou das tabs. */
export default function ContaLayout() {
  const router = useRouter();
  const raiz = useNavigation('/');
  const fechar = () => closeAccountFlow(router, raiz);

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
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
    </Stack>
  );
}
