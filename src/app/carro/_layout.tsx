import { Stack } from 'expo-router';

import { BotaoVoltar } from '@/ui/botao-voltar';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function CarroLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="[rideId]" options={{ headerLeft: () => <BotaoVoltar destino="/jogos" /> }}>
        <Stack.Screen.Title>Conversa do carro</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
