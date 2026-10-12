import { createContext, use, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { Radius, Spacing } from '@/constants/theme';
import {
  CAPTCHA_BASE_URL,
  CAPTCHA_TIMEOUT_MS,
  CaptchaFailed,
  captchaPage,
  readCaptchaMessage,
} from '@/features/auth/captcha-turnstile';
import { useEstaEscuro, useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/ui/themed-text';

/** Public by design (it is in every page that shows the widget); the secret key lives only in Supabase. */
const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type Pedido = {
  resolve: (token: string) => void;
  reject: (erro: Error) => void;
  prazo: ReturnType<typeof setTimeout>;
};

/** A fresh captcha token for the next auth request, or `undefined` when the app has no captcha configured. */
type PedirCodigo = () => Promise<string | undefined>;

const CaptchaContext = createContext<PedirCodigo>(() => Promise.resolve(undefined));

/** For the auth actions: call it right before each request to Supabase Auth. */
export function useCaptcha() {
  return use(CaptchaContext);
}

/**
 * Cloudflare Turnstile for the account screens. Supabase Auth asks for a token on sign-up, sign-in, password
 * recovery and resending the code; this keeps one hidden WebView ready and gets a new single-use token for each
 * request. Usually nobody sees anything; when Cloudflare wants a tick, the widget shows over the screen.
 */
export function CaptchaProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const escuro = useEstaEscuro();
  const webview = useRef<WebView>(null);
  const pedido = useRef<Pedido | null>(null);
  const [visivel, setVisivel] = useState(false);

  function terminar(resultado: { token: string } | { erro: string }) {
    const atual = pedido.current;
    if (!atual) return;
    pedido.current = null;
    clearTimeout(atual.prazo);
    setVisivel(false);
    if ('token' in resultado) atual.resolve(resultado.token);
    else atual.reject(new CaptchaFailed(resultado.erro));
  }

  function pedirCodigo(): Promise<string | undefined> {
    if (!SITE_KEY) return Promise.resolve(undefined);
    // Only one at a time: an older request that never finished is given up.
    if (pedido.current) terminar({ erro: 'substituido' });
    return new Promise<string>((resolve, reject) => {
      const prazo = setTimeout(() => terminar({ erro: 'tempo' }), CAPTCHA_TIMEOUT_MS);
      pedido.current = { resolve, reject, prazo };
      webview.current?.injectJavaScript('window.pedir && window.pedir(); true;');
    });
  }

  function aoReceber(evento: WebViewMessageEvent) {
    const mensagem = readCaptchaMessage(evento.nativeEvent.data);
    if (!mensagem) return;
    if (mensagem.tipo === 'token') terminar({ token: mensagem.token });
    else if (mensagem.tipo === 'erro') terminar({ erro: mensagem.codigo });
    else if (mensagem.tipo === 'mostrar') setVisivel(true);
    else if (mensagem.tipo === 'esconder') setVisivel(false);
    // A request made before the page was ready: ask again now that it is.
    else if (mensagem.tipo === 'pronto' && pedido.current) {
      webview.current?.injectJavaScript('window.pedir && window.pedir(); true;');
    }
  }

  return (
    <CaptchaContext value={pedirCodigo}>
      <View style={styles.flex}>
        {children}
        {SITE_KEY ? (
          // Always mounted (the same WebView keeps the widget); only shown when Cloudflare asks for a tick.
          <View
            pointerEvents={visivel ? 'auto' : 'none'}
            style={[styles.camada, visivel ? styles.aVista : styles.escondida]}
            accessibilityElementsHidden={!visivel}
            importantForAccessibility={visivel ? 'auto' : 'no-hide-descendants'}>
            <View style={[styles.cartao, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">Só para confirmar que és tu</ThemedText>
              <WebView
                ref={webview}
                source={{
                  html: captchaPage(SITE_KEY, escuro),
                  baseUrl: CAPTCHA_BASE_URL,
                }}
                originWhitelist={['https://*']}
                onMessage={aoReceber}
                javaScriptEnabled
                scrollEnabled={false}
                style={styles.webview}
              />
            </View>
          </View>
        ) : null}
      </View>
    </CaptchaContext>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  camada: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aVista: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  escondida: {
    opacity: 0,
  },
  cartao: {
    width: 320,
    padding: Spacing.three,
    gap: Spacing.two,
    borderRadius: Radius.card,
    alignItems: 'center',
  },
  webview: {
    width: 300,
    height: 70,
    backgroundColor: 'transparent',
  },
});
