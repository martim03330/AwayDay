import { isRunningInExpoGo } from 'expo';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import { appleDisplayName, randomNonce, sha256Hex } from '@/features/auth/social';

// The native side of «Continuar com Apple» and «Continuar com Google»: each returns an ID token for Supabase, or
// `null` when the person closed the sheet (that is not an error, the screen says nothing).

/** Public OAuth client ids (not secrets: they go inside every app build). Without both, Google is hidden. */
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

export type AppleSignInResult = { identityToken: string; rawNonce: string; fullName: string | null };

/** Sign in with Apple exists on iOS only (the system says whether this device has it). */
export async function isAppleAvailable() {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Apple's sheet. Apple gets the SHA-256 of a fresh nonce and puts it inside the token; Supabase gets the raw nonce
 * and checks it, so a token taken from elsewhere cannot be replayed. The name only comes on the first sign-in.
 */
export async function appleIdToken(): Promise<AppleSignInResult | null> {
  const rawNonce = randomNonce();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: sha256Hex(rawNonce),
    });
    if (!credential.identityToken) throw new Error('Apple gave no identity token.');
    return { identityToken: credential.identityToken, rawNonce, fullName: appleDisplayName(credential.fullName) };
  } catch (error) {
    if (isCode(error, 'ERR_REQUEST_CANCELED')) return null;
    throw error;
  }
}

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let google: Promise<GoogleModule | null> | null = null;

/**
 * The Google module, loaded only when it can work: iOS, a native build (it is not in Expo Go, where importing it
 * would throw) and both client ids set. Loaded once, then configured; `null` hides the button.
 */
function loadGoogle(): Promise<GoogleModule | null> {
  if (Platform.OS !== 'ios' || !GOOGLE_IOS_CLIENT_ID || !GOOGLE_WEB_CLIENT_ID || isRunningInExpoGo()) {
    return Promise.resolve(null);
  }
  google ??= import('@react-native-google-signin/google-signin')
    .then((module) => {
      module.GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID, webClientId: GOOGLE_WEB_CLIENT_ID });
      return module;
    })
    .catch(() => null);
  return google;
}

export async function isGoogleAvailable() {
  return (await loadGoogle()) !== null;
}

/** Google's sheet. Returns the ID token (its audience is the web client id, which Supabase knows). */
export async function googleIdToken(): Promise<string | null> {
  const module = await loadGoogle();
  if (!module) throw new Error('Google sign-in is not available.');
  const { GoogleSignin, isSuccessResponse, statusCodes } = module;
  try {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    const token = response.data.idToken;
    // Only the token is needed: leaving Google's own session lets the next sign-in pick an account again.
    await GoogleSignin.signOut().catch(() => undefined);
    if (!token) throw new Error('Google gave no ID token.');
    return token;
  } catch (error) {
    if (isCode(error, statusCodes.SIGN_IN_CANCELLED) || isCode(error, statusCodes.IN_PROGRESS)) return null;
    throw error;
  }
}

function isCode(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && String(Reflect.get(error, 'code')) === code;
}
