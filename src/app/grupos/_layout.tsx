import { Stack } from 'expo-router';

export default function GruposLayout() {
  return (
    <Stack>
      <Stack.Screen name="entrar">
        <Stack.Screen.Title>Convite</Stack.Screen.Title>
      </Stack.Screen>
      {/* A conversa desenha o próprio título: a cara do grupo, o nome e quem está online. */}
      <Stack.Screen name="[grupoId]/index" options={{ title: 'Grupo', headerBackTitle: 'Malta' }} />
      <Stack.Screen name="[grupoId]/definicoes">
        <Stack.Screen.Title>Grupo</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[grupoId]/planos">
        <Stack.Screen.Title>Planos</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[grupoId]/plano/[planoId]">
        <Stack.Screen.Title>Plano</Stack.Screen.Title>
      </Stack.Screen>
      <Stack.Screen name="[grupoId]/historico">
        <Stack.Screen.Title>Histórico</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
