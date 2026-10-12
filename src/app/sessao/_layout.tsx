import { Stack } from 'expo-router';

import { BotaoVoltar } from '@/ui/botao-voltar';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function SessaoLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS }}>
      <Stack.Screen
        name="[sessaoId]/index"
        options={{ headerLeft: () => <BotaoVoltar destino="/jogos" /> }}>
        <Stack.Screen.Title>A viagem</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[sessaoId]/despesas">
        <Stack.Screen.Title>Despesas</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[sessaoId]/recordacao">
        <Stack.Screen.Title>Recordação</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="[sessaoId]/nova-despesa"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
