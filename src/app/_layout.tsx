import {
  BigShoulders_700Bold,
  BigShoulders_800ExtraBold,
  BigShoulders_900Black,
} from '@expo-google-fonts/big-shoulders';
import { BigShouldersStencil_800ExtraBold } from '@expo-google-fonts/big-shoulders-stencil';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { LigacaoDemo } from '@/components/ligacao-demo';
import { Colors, fontFamily } from '@/constants/theme';
import { FixtureCatalogSync } from '@/features/fixtures/components/FixtureCatalogSync';
import { restoreFixtureCatalog } from '@/features/fixtures/hooks/useFixtureCatalog';
import { QueryProvider } from '@/lib/query-client';
import { AICoachProvider } from '@/state/ai-coach';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { JuntarAtividade } from '@/state/juntar-atividade';
import { RelogioProvider } from '@/state/relogio';
import { NotificacoesPush } from '@/state/notificacoes-push';
import { SincronizarConta } from '@/state/sincronizar-conta';
import { SonsProvider } from '@/state/sons';

// Keep the splash screen up until the fonts are ready, so text never flashes in the system font.
SplashScreen.preventAutoHideAsync();

const navigationTheme: typeof DefaultTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.danger,
  },
  fonts: {
    regular: { fontFamily: fontFamily('body', 500), fontWeight: 'normal' },
    medium: { fontFamily: fontFamily('body', 600), fontWeight: 'normal' },
    bold: { fontFamily: fontFamily('body', 800), fontWeight: 'normal' },
    heavy: { fontFamily: fontFamily('body', 800), fontWeight: 'normal' },
  },
};

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
  const [fontsLoaded, fontError] = useFonts({
    BigShoulders_700Bold,
    BigShoulders_800ExtraBold,
    BigShoulders_900Black,
    BigShouldersStencil_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const fontsSettled = fontsLoaded || fontError !== null;

  useEffect(() => {
    // If a font fails to load, the app still opens: text falls back to the system font.
    if (fontsSettled) SplashScreen.hideAsync();
  }, [fontsSettled]);

  if (!fontsSettled) return null;

  return (
    <QueryProvider onRestored={restoreFixtureCatalog}>
      <FixtureCatalogSync />
      <ThemeProvider value={navigationTheme}>
        <RelogioProvider>
          <AppStateProvider>
            <SonsProvider>
              <AICoachProvider>
                <LigacaoDemo />
                <SincronizarConta />
                <JuntarAtividade />
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
