import { Stack } from 'expo-router';

import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';
import { BotaoVoltar } from '@/ui/botao-voltar';

/**
 * The Casa, the trip and the registration can each be the first screen of this stack (opened from the profile, the
 * game page or a notification), where the native back button does not appear: they get one that is always there.
 */
export default function CasaLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="registar" options={{ headerLeft: () => <BotaoVoltar destino="/perfil" /> }}>
        <Stack.Screen.Title>Registar a Casa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="entrar">
        <Stack.Screen.Title>Código de gestor</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[casaId]/index" options={{ headerLeft: () => <BotaoVoltar destino="/perfil" /> }}>
        <Stack.Screen.Title>Casa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[casaId]/gestores">
        <Stack.Screen.Title>Gestores</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[casaId]/nova-viagem">
        <Stack.Screen.Title>Nova viagem</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="viagem/[viagemId]/index" options={{ headerLeft: () => <BotaoVoltar destino="/jogos" /> }}>
        <Stack.Screen.Title>Viagem da Casa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="viagem/[viagemId]/gerir">
        <Stack.Screen.Title>Gerir viagem</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
