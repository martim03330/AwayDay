import { Stack } from 'expo-router';
import { SEM_EFEITOS_NAS_BORDAS } from '@/constants/navegacao';

export default function MaltaLayout() {
  return (
    <Stack screenOptions={{ scrollEdgeEffects: SEM_EFEITOS_NAS_BORDAS }}>
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
