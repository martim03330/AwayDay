import { Stack } from 'expo-router';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

/**
 * The list is always at the bottom of this tab's stack, even when a link opens a screen inside it (e.g. a ride shared
 * by link): without it, «back» had nowhere to go and tapping the tab only went back to that screen (testers got stuck).
 */
export const unstable_settings = { anchor: 'index' };

export default function MaltaLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS, headerBackButtonDisplayMode: 'minimal' }}>
      {/* A lista desenha o próprio cabeçalho verde, como os Jogos. */}
      <Stack.Screen name="index" options={{ headerShown: false }}>
        <Stack.Screen.Title>Malta</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="novo"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
