import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/theme';
import { socialAuthErrorMessage } from '@/features/auth/errors';
import { useSocialAvailability, useSocialSignIn, type SocialProvider } from '@/features/auth/hooks/useSocialSignIn';
import { useEstaEscuro, useTheme } from '@/hooks/use-theme';
import { IDADE_MINIMA } from '@/lib/legal';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

/** Same height as the app's buttons. Apple's button needs an explicit size, or it does not appear. */
const BUTTON_HEIGHT = 54;

type SocialSignInProps = {
  /** After Supabase has the session: the screen closes the account flow, as with email. */
  onSignedIn: () => void;
  /** The message for the screen's error box, or `null` to clear it (a new try, or a closed sheet). */
  onError: (message: string | null) => void;
};

/**
 * «Continuar com Apple» (iOS, when the device has it) and «Continuar com Google» (native builds with the client ids
 * set), with the terms line above and the «ou com email» divider below. Shows nothing when neither is available,
 * so the email form stays as it was.
 */
export function SocialSignIn({ onSignedIn, onError }: SocialSignInProps) {
  const router = useRouter();
  const theme = useTheme();
  const escuro = useEstaEscuro();
  const available = useSocialAvailability();
  const signIn = useSocialSignIn();
  const busy = signIn.isPending || signIn.isSuccess;

  if (!available.apple && !available.google) return null;

  function continuar(provider: SocialProvider) {
    if (busy) return;
    onError(null);
    signIn.mutate(provider, {
      onSuccess: (result) => {
        if (result === 'signed-in') onSignedIn();
        else signIn.reset();
      },
      onError: (error) => onError(socialAuthErrorMessage(error)),
    });
  }

  const abrir = (documento: 'termos' | 'privacidade') =>
    router.push({ pathname: '/legal/[documento]', params: { documento } });

  return (
    <View style={styles.bloco}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.termos}>
        {`Ao continuar, confirmas que tens ${IDADE_MINIMA} anos ou mais e aceitas os `}
        <Text
          accessibilityRole="link"
          onPress={() => abrir('termos')}
          style={[styles.ligacao, { color: theme.accentInk }]}>
          Termos
        </Text>
        {' e a '}
        <Text
          accessibilityRole="link"
          onPress={() => abrir('privacidade')}
          style={[styles.ligacao, { color: theme.accentInk }]}>
          Política de privacidade
        </Text>
        .
      </ThemedText>
      <View
        style={[styles.botoes, busy && styles.ocupado]}
        pointerEvents={busy ? 'none' : 'auto'}
        accessibilityState={{ busy }}>
        {available.apple ? (
          <AppleAuthentication.AppleAuthenticationButton
            testID="continuar-apple"
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              escuro
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={Radius.button}
            style={styles.apple}
            onPress={() => continuar('apple')}
          />
        ) : null}
        {available.google ? (
          <BotaoGoogle escuro={escuro} disabled={busy} onPress={() => continuar('google')} />
        ) : null}
      </View>
      <View style={styles.divisor} accessibilityRole="text" accessibilityLabel="Ou entra com email">
        <View style={[styles.linha, { backgroundColor: theme.border }]} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.divisorTexto}>
          ou com email
        </ThemedText>
        <View style={[styles.linha, { backgroundColor: theme.border }]} />
      </View>
    </View>
  );
}

/**
 * Google's button, after Google's branding rules: the official four-colour «G» on white with a grey outline (light)
 * or on near-black (dark), and «Continuar com Google».
 */
function BotaoGoogle({ escuro, disabled, onPress }: { escuro: boolean; disabled: boolean; onPress: () => void }) {
  const look = escuro
    ? { background: '#131314', pressed: '#2A2A2C', border: '#8E918F', ink: '#E3E3E3' }
    : { background: '#FFFFFF', pressed: '#F2F2F2', border: '#747775', ink: '#1F1F1F' };
  return (
    <Premivel
      testID="continuar-google"
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Continuar com Google"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.google,
        { backgroundColor: pressed ? look.pressed : look.background, borderColor: look.border },
      ]}>
      <LogoGoogle />
      <Text style={[styles.googleTexto, { color: look.ink }]}>Continuar com Google</Text>
    </Premivel>
  );
}

/** Google's «G» mark, as published in Google's sign-in branding kit. */
function LogoGoogle() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.three,
  },
  termos: {
    fontSize: 13,
    lineHeight: 19,
  },
  ligacao: {
    fontWeight: 700,
    textDecorationLine: 'underline',
  },
  botoes: {
    gap: Spacing.two,
  },
  ocupado: {
    opacity: 0.5,
  },
  apple: {
    width: '100%',
    height: BUTTON_HEIGHT,
  },
  google: {
    height: BUTTON_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
  },
  googleTexto: {
    // The system font, like the text inside Apple's button right above it.
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 600,
  },
  divisor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  linha: {
    flex: 1,
    height: StyleSheet.hairlineWidth * 2,
  },
  divisorTexto: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
  },
});
