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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';

import { LigacaoDemo } from '@/components/ligacao-demo';
import { Colors, fontFamily } from '@/constants/theme';
import { FixtureCatalogSync } from '@/features/fixtures/components/FixtureCatalogSync';
import { restoreFixtureCatalog } from '@/features/fixtures/hooks/useFixtureCatalog';
import { PlaceCatalogSync } from '@/features/places/components/PlaceCatalogSync';
import { restorePlaceCatalog } from '@/features/places/hooks/usePlaceCatalog';
import { AvisosBoleias } from '@/features/rides/components/AvisosBoleias';
import { QueryProvider } from '@/lib/query-client';
import { AICoachProvider } from '@/state/ai-coach';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { PlanosJogosProvider } from '@/state/planos-jogos';
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

/**
 * Hides the splash screen once the app can draw real screens: fonts settled (a failed font falls back to the system
 * font) and the catalogue restored, which may wait a few seconds for fresh data.
 */
function EsconderSplash() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return null;
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

  if (!fontsSettled) return null;

  return (
    // Gestures (e.g. swiping between tascos) need this root.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider
        onRestored={async (client) => {
          await Promise.all([restoreFixtureCatalog(client), restorePlaceCatalog(client)]);
        }}>
        <EsconderSplash />
        <FixtureCatalogSync />
        <PlaceCatalogSync />
        <ThemeProvider value={navigationTheme}>
          <RelogioProvider>
            <AppStateProvider>
              <PlanosJogosProvider>
                <SonsProvider>
                  <AvisosBoleias />
                  <AICoachProvider>
                    <LigacaoDemo />
                    <SincronizarConta />
                    <JuntarAtividade />
                    <NotificacoesPush />
                    <NavegacaoRaiz />
                  </AICoachProvider>
                </SonsProvider>
              </PlanosJogosProvider>
            </AppStateProvider>
          </RelogioProvider>
        </ThemeProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
