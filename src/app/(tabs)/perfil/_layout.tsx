import { Stack } from 'expo-router';

export default function PerfilLayout() {
  return (
    <Stack>
      <Stack.Screen name="index">
        <Stack.Screen.Title large>Perfil</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="album">
        <Stack.Screen.Title>Álbum de recordações</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="novidades">
        <Stack.Screen.Title>Novidades</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="foto"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen name="notificacoes">
        <Stack.Screen.Title>Notificações</Stack.Screen.Title>
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
      <Stack.Screen
        name="clube-terra"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
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
