import { useMutation } from '@tanstack/react-query';

import { useCaptcha } from '@/features/auth/components/CaptchaProvider';

import {
  deleteAccount,
  requestPasswordReset,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  verifySignUpCode,
  type DeleteAccountInput,
  type SignInInput,
  type SignUpInput,
} from '@/features/auth/api';

// One mutation per auth action: screens read `isPending` and `error` from them. The ones Supabase protects with the
// captcha get a fresh token right before the request (none when the app has no captcha configured).

export function useSignUp() {
  const captcha = useCaptcha();
  return useMutation({
    mutationFn: async (input: SignUpInput) => signUp({ ...input, captchaToken: await captcha() }),
  });
}

export function useVerifySignUpCode() {
  return useMutation({ mutationFn: verifySignUpCode });
}

export function useResendSignUpCode() {
  const captcha = useCaptcha();
  return useMutation({
    mutationFn: async (email: string) => resendSignUpCode(email, await captcha()),
  });
}

export function useSignIn() {
  const captcha = useCaptcha();
  return useMutation({
    mutationFn: async (input: SignInInput) => signIn({ ...input, captchaToken: await captcha() }),
  });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}

export function useRequestPasswordReset() {
  const captcha = useCaptcha();
  return useMutation({
    mutationFn: async (email: string) => requestPasswordReset(email, await captcha()),
  });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword });
}

export function useDeleteAccount() {
  const captcha = useCaptcha();
  return useMutation({
    mutationFn: async (input: DeleteAccountInput) => deleteAccount({ ...input, captchaToken: await captcha() }),
  });
}
