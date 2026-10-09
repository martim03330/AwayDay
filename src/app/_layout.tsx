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
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { LigacaoDemo } from '@/components/ligacao-demo';
import { Colors, ColorsEscuro, fontFamily, Radius, Spacing } from '@/constants/theme';
import { reportErrorOnce } from '@/features/feedback/report';
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
      {/* Privacidade, termos e contactos: em modal, de qualquer sítio. */}
      <Stack.Screen name="legal" options={{ presentation: 'modal' }} />
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

/**
 * A screen that crashed while drawing. Expo Router shows this in place of the layout, so it lives **outside** every
 * provider (app state, theme, queries): plain React Native only, colours from the system scheme. The error goes to
 * the feedback inbox once per distinct error, in the background; the person only sees a calm message and a retry.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const escuro = useColorScheme() === 'dark';
  const paleta = escuro ? ColorsEscuro : Colors;
  const [aTentar, setATentar] = useState(false);
  const mensagem = error.message || error.name;

  useEffect(() => {
    // Keyed on the message and the top of the stack: the same crash twice in a launch is reported once.
    const chave = `ecra:${mensagem}:${(error.stack ?? '').split('\n')[1] ?? ''}`;
    reportErrorOnce(chave, 'Ecrã partiu', error, { area: 'outro', stack: error.stack }).catch(
      () => undefined
    );
  }, [error, mensagem]);

  return (
    <View style={[estilosErro.ecra, { backgroundColor: paleta.background }]}>
      <Text accessibilityRole="header" style={[estilosErro.titulo, { color: paleta.text }]}>
        Algo correu mal neste ecrã
      </Text>
      <Text style={[estilosErro.texto, { color: paleta.textSecondary }]}>
        Já nos chegou o aviso. Tenta outra vez; se voltar a acontecer, sai e volta a entrar.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tentar outra vez"
        accessibilityState={{ disabled: aTentar }}
        disabled={aTentar}
        onPress={() => {
          setATentar(true);
          void retry().finally(() => setATentar(false));
        }}
        style={({ pressed }) => [
          estilosErro.botao,
          { backgroundColor: pressed ? paleta.accentPressed : paleta.accent },
        ]}>
        <Text style={[estilosErro.botaoTexto, { color: paleta.accentText }]}>Tentar outra vez</Text>
      </Pressable>
    </View>
  );
}

const estilosErro = StyleSheet.create({
  ecra: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  titulo: {
    fontFamily: fontFamily('body', 800),
    fontSize: 22,
    textAlign: 'center',
  },
  texto: {
    fontFamily: fontFamily('body', 500),
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  botao: {
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  botaoTexto: {
    fontFamily: fontFamily('body', 700),
    fontSize: 16,
  },
});
