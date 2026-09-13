import { Stack } from 'expo-router';

export default function JogosLayout() {
  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Screen.Title large>Jogos</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[jogoId]">
        <Stack.Screen.Title>Jogo</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="avaliar"
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
