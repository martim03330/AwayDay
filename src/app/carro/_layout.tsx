import { Stack } from 'expo-router';

import { BotaoVoltar } from '@/ui/botao-voltar';

export default function CarroLayout() {
  return (
    <Stack>
      <Stack.Screen name="[rideId]" options={{ headerLeft: () => <BotaoVoltar destino="/jogos" /> }}>
        <Stack.Screen.Title>Conversa do carro</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
