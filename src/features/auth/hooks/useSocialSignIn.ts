import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { signInWithApple, signInWithGoogle } from '@/features/auth/api';
import { useCaptcha } from '@/features/auth/components/CaptchaProvider';
import { isSocialCancel } from '@/features/auth/social';
import { appleIdToken, googleIdToken, isAppleAvailable, isGoogleAvailable } from '@/features/auth/social-providers';

export type SocialProvider = 'apple' | 'google';
/** `cancelled`: the person closed Apple's or Google's sheet. Nothing to show. */
export type SocialSignInResult = 'signed-in' | 'cancelled';

/** Which buttons to show. Both start hidden and appear once the device says it can (no flash of a dead button). */
export function useSocialAvailability() {
  const [available, setAvailable] = useState<Record<SocialProvider, boolean>>({ apple: false, google: false });

  useEffect(() => {
    let mounted = true;
    void Promise.all([isAppleAvailable(), isGoogleAvailable()]).then(([apple, google]) => {
      if (mounted) setAvailable({ apple, google });
    });
    return () => {
      mounted = false;
    };
  }, []);

  return available;
}

/**
 * «Continuar com Apple / Google»: the native sheet, then Supabase with its ID token. The captcha token is asked for
 * after the sheet (it is single-use and short-lived, and the person may take a while in the sheet).
 */
export function useSocialSignIn() {
  const captcha = useCaptcha();
  return useMutation({
    mutationFn: async (provider: SocialProvider): Promise<SocialSignInResult> => {
      try {
        if (provider === 'apple') {
          const apple = await appleIdToken();
          if (!apple) return 'cancelled';
          await signInWithApple({ ...apple, captchaToken: await captcha() });
        } else {
          const idToken = await googleIdToken();
          if (!idToken) return 'cancelled';
          await signInWithGoogle({ idToken, captchaToken: await captcha() });
        }
        return 'signed-in';
      } catch (error) {
        if (isSocialCancel(error)) return 'cancelled';
        throw error;
      }
    },
  });
}
