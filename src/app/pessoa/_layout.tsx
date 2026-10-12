import { Stack } from 'expo-router';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function PessoaLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS }}>
      <Stack.Screen name="[pessoaId]">
        <Stack.Screen.Title>Perfil</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
