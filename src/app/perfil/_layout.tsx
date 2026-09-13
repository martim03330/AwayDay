import { Stack } from 'expo-router';

export default function PerfilLayout() {
  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Screen.Title large>Perfil</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="clube"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.7, 1],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
