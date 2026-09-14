import { Stack } from 'expo-router';

export default function LocaisLayout() {
  return (
    <Stack>
      {/* Both screens draw their own header (green pitch on the list, yellow card on the tasco). */}
      <Stack.Screen name="index" options={{ headerShown: false }}>
        <Stack.Screen.Title large>Locais</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[localId]" options={{ headerShown: false }}>
        <Stack.Screen.Title>Local</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
