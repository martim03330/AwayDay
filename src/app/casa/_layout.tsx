import { Stack } from 'expo-router';

import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function CasaLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="registar">
        <Stack.Screen.Title>Registar a Casa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="entrar">
        <Stack.Screen.Title>Código de gestor</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[casaId]/index">
        <Stack.Screen.Title>Casa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[casaId]/gestores">
        <Stack.Screen.Title>Gestores</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[casaId]/nova-viagem">
        <Stack.Screen.Title>Nova viagem</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="viagem/[viagemId]/index">
        <Stack.Screen.Title>Viagem da Casa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="viagem/[viagemId]/gerir">
        <Stack.Screen.Title>Gerir viagem</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
