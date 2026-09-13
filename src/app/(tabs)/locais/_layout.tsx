import { Stack } from 'expo-router';

export default function LocaisLayout() {
  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Screen.Title large>Locais</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[localId]">
        <Stack.Screen.Title>Local</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
