import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { LigacaoDemo } from '@/components/ligacao-demo';
import { FixtureCatalogSync } from '@/features/fixtures/components/FixtureCatalogSync';
import { restoreFixtureCatalog } from '@/features/fixtures/hooks/useFixtureCatalog';
import { QueryProvider } from '@/lib/query-client';
import { AICoachProvider } from '@/state/ai-coach';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { RelogioProvider } from '@/state/relogio';
import { NotificacoesPush } from '@/state/notificacoes-push';
import { SincronizarConta } from '@/state/sincronizar-conta';
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
      {/* Entrar e criar conta: abre por cima da introdução ou das tabs. */}
      <Stack.Screen name="conta" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryProvider onRestored={restoreFixtureCatalog}>
      <FixtureCatalogSync />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RelogioProvider>
          <AppStateProvider>
            <SonsProvider>
              <AICoachProvider>
                <LigacaoDemo />
                <SincronizarConta />
                <NotificacoesPush />
                <NavegacaoRaiz />
              </AICoachProvider>
            </SonsProvider>
          </AppStateProvider>
        </RelogioProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
