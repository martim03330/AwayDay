import { Stack } from 'expo-router';

export default function SessaoLayout() {
  return (
    <Stack>
      <Stack.Screen name="[sessaoId]/index" options={{ headerBackTitle: 'Jogos' }}>
        <Stack.Screen.Title>A viagem</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[sessaoId]/despesas">
        <Stack.Screen.Title>Despesas</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="[sessaoId]/nova-despesa"
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
