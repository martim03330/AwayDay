import { Stack } from 'expo-router';

export default function RankingLayout() {
  return (
    <Stack>
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
