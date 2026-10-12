import { Stack } from 'expo-router';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

/**
 * The list is always at the bottom of this tab's stack, even when a link opens a screen inside it (e.g. a ride shared
 * by link): without it, «back» had nowhere to go and tapping the tab only went back to that screen (testers got stuck).
 */
export const unstable_settings = { anchor: 'index' };

export default function LocaisLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS }}>
      {/* Both screens draw their own header (green pitch on the list, yellow card on the tasco). */}
      <Stack.Screen name="index" options={{ headerShown: false }}>
        <Stack.Screen.Title large>Locais</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[localId]" options={{ headerShown: false }}>
        <Stack.Screen.Title>Local</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="sugerir-prato"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="sugerir-tasco"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
