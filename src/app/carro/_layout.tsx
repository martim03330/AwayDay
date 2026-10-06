import { Stack } from 'expo-router';

export default function CarroLayout() {
  return (
    <Stack>
      <Stack.Screen name="[rideId]">
        <Stack.Screen.Title>Conversa do carro</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
