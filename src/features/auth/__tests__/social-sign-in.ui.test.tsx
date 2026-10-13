import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SocialSignIn } from '@/features/auth/components/SocialSignIn';

// The native side is mocked: whether each provider is available, and what its sheet returns.
const mockProviders = {
  isAppleAvailable: jest.fn<Promise<boolean>, []>(),
  isGoogleAvailable: jest.fn<Promise<boolean>, []>(),
  appleIdToken: jest.fn(),
  googleIdToken: jest.fn(),
};
jest.mock('@/features/auth/social-providers', () => ({
  isAppleAvailable: () => mockProviders.isAppleAvailable(),
  isGoogleAvailable: () => mockProviders.isGoogleAvailable(),
  appleIdToken: () => mockProviders.appleIdToken(),
  googleIdToken: () => mockProviders.googleIdToken(),
}));

const mockSignInWithApple = jest.fn();
const mockSignInWithGoogle = jest.fn();
jest.mock('@/features/auth/api', () => ({
  signInWithApple: (input: unknown) => mockSignInWithApple(input),
  signInWithGoogle: (input: unknown) => mockSignInWithGoogle(input),
}));

// Apple's button is a native view: a plain pressable stands in for it.
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
    AppleAuthenticationButton: ({ onPress, testID }: { onPress: () => void; testID?: string }) => (
      <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel="Continuar com Apple" />
    ),
  };
});

// No captcha in tests (the provider's WebView is native): every request goes without a token.
jest.mock('@/features/auth/components/CaptchaProvider', () => ({ useCaptcha: () => () => Promise.resolve(undefined) }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

// No garbage-collection timers: they kept Jest running after the tests.
function renderizar(onSignedIn = jest.fn(), onError = jest.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity } } })}>
      <SocialSignIn onSignedIn={onSignedIn} onError={onError} />
    </QueryClientProvider>
  );
  return { onSignedIn, onError };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockProviders.isAppleAvailable.mockResolvedValue(true);
  mockProviders.isGoogleAvailable.mockResolvedValue(true);
});

describe('SocialSignIn', () => {
  it('shows both buttons, the terms and the divider when both are available', async () => {
    renderizar();
    expect(await screen.findByTestId('continuar-apple')).toBeOnTheScreen();
    expect(screen.getByTestId('continuar-google')).toBeOnTheScreen();
    expect(screen.getByText('Continuar com Google')).toBeOnTheScreen();
    expect(screen.getByText('ou com email')).toBeOnTheScreen();
    expect(screen.getByText(/Ao continuar, confirmas que tens 18 anos ou mais e aceitas os/)).toBeOnTheScreen();
  });

  it('hides Google when it is not available (Expo Go, no client ids)', async () => {
    mockProviders.isGoogleAvailable.mockResolvedValue(false);
    renderizar();
    expect(await screen.findByTestId('continuar-apple')).toBeOnTheScreen();
    expect(screen.queryByTestId('continuar-google')).toBeNull();
  });

  it('hides Apple when it is not available (Android)', async () => {
    mockProviders.isAppleAvailable.mockResolvedValue(false);
    renderizar();
    expect(await screen.findByTestId('continuar-google')).toBeOnTheScreen();
    expect(screen.queryByTestId('continuar-apple')).toBeNull();
  });

  it('shows nothing at all when neither is available: the email form stays as it was', async () => {
    mockProviders.isAppleAvailable.mockResolvedValue(false);
    mockProviders.isGoogleAvailable.mockResolvedValue(false);
    renderizar();
    await waitFor(() => expect(mockProviders.isGoogleAvailable).toHaveBeenCalled());
    expect(screen.queryByText('ou com email')).toBeNull();
    expect(screen.queryByTestId('continuar-apple')).toBeNull();
  });

  it('closing Apple’s sheet shows no error and does not sign in', async () => {
    mockProviders.appleIdToken.mockResolvedValue(null);
    const { onSignedIn, onError } = renderizar();
    fireEvent.press(await screen.findByTestId('continuar-apple'));
    await waitFor(() => expect(mockProviders.appleIdToken).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('continuar-google')).toBeEnabled());
    expect(onError).not.toHaveBeenCalledWith(expect.any(String));
    expect(mockSignInWithApple).not.toHaveBeenCalled();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('a cancel thrown by Google is not an error either', async () => {
    mockProviders.googleIdToken.mockRejectedValue(Object.assign(new Error('cancelled'), { code: 'SIGN_IN_CANCELLED' }));
    const { onSignedIn, onError } = renderizar();
    fireEvent.press(await screen.findByTestId('continuar-google'));
    await waitFor(() => expect(mockProviders.googleIdToken).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('continuar-google')).toBeEnabled());
    expect(onError).not.toHaveBeenCalledWith(expect.any(String));
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('signs in with Apple’s token and nonce, then hands over to the screen', async () => {
    mockProviders.appleIdToken.mockResolvedValue({ identityToken: 'jwt', rawNonce: 'n', fullName: 'Maria Silva' });
    mockSignInWithApple.mockResolvedValue(undefined);
    const { onSignedIn } = renderizar();
    fireEvent.press(await screen.findByTestId('continuar-apple'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(mockSignInWithApple).toHaveBeenCalledWith({
      identityToken: 'jwt',
      rawNonce: 'n',
      fullName: 'Maria Silva',
      captchaToken: undefined,
    });
  });

  it('a provider not switched on in Supabase says so in Portuguese', async () => {
    mockProviders.googleIdToken.mockResolvedValue('google-jwt');
    mockSignInWithGoogle.mockRejectedValue(Object.assign(new Error('off'), { code: 'provider_disabled' }));
    const { onError, onSignedIn } = renderizar();
    fireEvent.press(await screen.findByTestId('continuar-google'));
    await waitFor(() =>
      expect(onError).toHaveBeenLastCalledWith('Este tipo de entrada ainda não está ligado. Usa o email por agora.')
    );
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('opens the terms and the privacy policy', async () => {
    renderizar();
    fireEvent.press(await screen.findByText('Termos'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/legal/[documento]', params: { documento: 'termos' } });
    fireEvent.press(screen.getByText('Política de privacidade'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/legal/[documento]',
      params: { documento: 'privacidade' },
    });
  });
});
