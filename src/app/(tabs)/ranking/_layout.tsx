import { Stack } from 'expo-router';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function RankingLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS }}>
      {/* O início desenha o próprio cabeçalho verde, como a Malta. */}
      <Stack.Screen name="index" options={{ headerShown: false }}>
        <Stack.Screen.Title>Ranking</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="tabelas">
        <Stack.Screen.Title>Tabelas</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="missoes">
        <Stack.Screen.Title>Missões</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="estadios">
        <Stack.Screen.Title>Quem vai à bola</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
