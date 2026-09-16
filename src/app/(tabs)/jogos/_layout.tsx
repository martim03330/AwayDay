import { Stack } from 'expo-router';

import { Colors, fontFamily } from '@/constants/theme';

export default function JogosLayout() {
  return (
    <Stack>
      {/* The list draws its own green pitch header. */}
      <Stack.Screen name="index" options={{ headerShown: false }}>
        <Stack.Screen.Title large>Jogos</Stack.Screen.Title>
      </Stack.Screen>
      {/* Native header painted green so it runs straight into the fixture's pitch header. */}
      <Stack.Screen
        name="[jogoId]"
        options={{
          headerStyle: { backgroundColor: Colors.accent },
          headerTintColor: Colors.accentText,
          headerTitleStyle: { fontFamily: fontFamily('body', 700), color: Colors.accentText },
          headerShadowVisible: false,
        }}>
        <Stack.Screen.Title>Jogo</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="o-meu-jogo">
        <Stack.Screen.Title>O meu jogo</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="oferecer-boleia">
        <Stack.Screen.Title>Oferecer boleia</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="boleia">
        <Stack.Screen.Title>Boleia</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="boleia-de-volta">
        <Stack.Screen.Title>Boleia de volta</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="contas">
        <Stack.Screen.Title>Contas da viagem</Stack.Screen.Title>
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
