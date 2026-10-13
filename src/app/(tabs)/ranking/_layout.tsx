import { Stack } from 'expo-router';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

/**
 * The list is always at the bottom of this tab's stack, even when a link opens a screen inside it (e.g. a ride shared
 * by link): without it, «back» had nowhere to go and tapping the tab only went back to that screen (testers got stuck).
 */
export const unstable_settings = { anchor: 'index' };

export default function RankingLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS, headerBackButtonDisplayMode: 'minimal' }}>
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
    </Stack>
  );
}
