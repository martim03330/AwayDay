import { Stack } from 'expo-router';

export default function PerfilLayout() {
  return (
    <Stack>
      {/* The profile draws its own green header. */}
      <Stack.Screen name="index" options={{ headerShown: false }}>
        <Stack.Screen.Title>Perfil</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="missoes" options={{ headerShown: false }}>
        <Stack.Screen.Title>Missões</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="passaporte">
        <Stack.Screen.Title>Passaporte de estádios</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="os-meus-jogos">
        <Stack.Screen.Title>Os teus jogos</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="pontos-de-encontro">
        <Stack.Screen.Title>Pontos de encontro</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="definicoes">
        <Stack.Screen.Title>Definições</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="album">
        <Stack.Screen.Title>Álbum de recordações</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="novidades">
        <Stack.Screen.Title>Novidades</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="retrospetiva">
        <Stack.Screen.Title>Retrospetiva</Stack.Screen.Title>
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
