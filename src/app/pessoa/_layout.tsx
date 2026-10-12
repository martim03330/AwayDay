import { Stack } from 'expo-router';

export default function PessoaLayout() {
  return (
    <Stack>
      <Stack.Screen name="[pessoaId]">
        <Stack.Screen.Title>Perfil</Stack.Screen.Title>
      </Stack.Screen>
    </Stack>
  );
}
