import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { LigacaoDemo } from '@/components/ligacao-demo';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { RelogioProvider } from '@/state/relogio';
import { SonsProvider } from '@/state/sons';

/** Onboarding enquanto não estiver concluído; depois, as tabs. */
function NavegacaoRaiz() {
  const { onboardingConcluido } = useAppState();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!onboardingConcluido}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingConcluido}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RelogioProvider>
        <AppStateProvider>
          <SonsProvider>
            <LigacaoDemo />
            <NavegacaoRaiz />
          </SonsProvider>
        </AppStateProvider>
      </RelogioProvider>
    </ThemeProvider>
  );
}
