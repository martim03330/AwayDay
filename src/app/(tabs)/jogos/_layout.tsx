import { Stack } from 'expo-router';

import { fontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function JogosLayout() {
  const theme = useTheme();

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
          headerStyle: { backgroundColor: theme.accent },
          headerTintColor: theme.accentText,
          headerTitleStyle: { fontFamily: fontFamily('body', 700), color: theme.accentText },
          headerShadowVisible: false,
        }}>
        <Stack.Screen.Title>Jogo</Stack.Screen.Title>
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
      <Stack.Screen name="estadio">
        <Stack.Screen.Title>O estádio</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="mapa">
        <Stack.Screen.Title>Mapa</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="chegar">
        <Stack.Screen.Title>Chegar e estacionar</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="boleias">
        <Stack.Screen.Title>Boleias</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen
        name="combinar"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <Stack.Screen name="dormir">
        <Stack.Screen.Title>Onde dormir</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="barulho">
        <Stack.Screen.Title>Barulhómetro</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="conversa">
        <Stack.Screen.Title>Conversa do carro</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="resumo">
        <Stack.Screen.Title>Resumo da viagem</Stack.Screen.Title>
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
