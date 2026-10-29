import { Stack } from 'expo-router';

import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function CasaLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="[casaId]">
        <Stack.Screen.Title>Casa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="viagem/[viagemId]">
        <Stack.Screen.Title>Viagem da Casa</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
