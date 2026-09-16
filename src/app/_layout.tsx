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
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, type ReactNode } from 'react';

import { LigacaoDemo } from '@/components/ligacao-demo';
import { fontFamily } from '@/constants/theme';
import { useEstaEscuro, useTheme } from '@/hooks/use-theme';
import { FixtureCatalogSync } from '@/features/fixtures/components/FixtureCatalogSync';
import { restoreFixtureCatalog } from '@/features/fixtures/hooks/useFixtureCatalog';
import { PlaceCatalogSync } from '@/features/places/components/PlaceCatalogSync';
import { restorePlaceCatalog } from '@/features/places/hooks/usePlaceCatalog';
import { AvisosJogosPerto } from '@/components/avisos-jogos-perto';
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

const tipos: typeof DefaultTheme.fonts = {
  regular: { fontFamily: fontFamily('body', 500), fontWeight: 'normal' },
  medium: { fontFamily: fontFamily('body', 600), fontWeight: 'normal' },
  bold: { fontFamily: fontFamily('body', 800), fontWeight: 'normal' },
  heavy: { fontFamily: fontFamily('body', 800), fontWeight: 'normal' },
};

/**
 * Dá à navegação as cores da paleta em uso. Vive **dentro** do estado da app, porque é lá que está a escolha do
 * utilizador entre claro, escuro e o que o telemóvel disser.
 */
function TemaDaNavegacao({ children }: { children: ReactNode }) {
  const paleta = useTheme();
  const escuro = useEstaEscuro();
  const base = escuro ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: paleta.accent,
          background: paleta.background,
          card: paleta.background,
          text: paleta.text,
          border: paleta.border,
          notification: paleta.danger,
        },
        fonts: tipos,
      }}>
      {children}
    </ThemeProvider>
  );
}

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
        <RelogioProvider>
          <AppStateProvider>
            <TemaDaNavegacao>
              <PlanosJogosProvider>
                <SonsProvider>
                  <AvisosBoleias />
                  <AvisosJogosPerto />
                  <AICoachProvider>
                    <LigacaoDemo />
                    <SincronizarConta />
                    <JuntarAtividade />
                    <NotificacoesPush />
                    <NavegacaoRaiz />
                  </AICoachProvider>
                </SonsProvider>
              </PlanosJogosProvider>
            </TemaDaNavegacao>
          </AppStateProvider>
        </RelogioProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
