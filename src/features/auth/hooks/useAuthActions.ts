import { useMutation } from '@tanstack/react-query';

import {
  deleteAccount,
  requestPasswordReset,
  resendSignUpCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  verifySignUpCode,
} from '@/features/auth/api';

// One mutation per auth action: screens read `isPending` and `error` from them.

export function useSignUp() {
  return useMutation({ mutationFn: signUp });
}

export function useVerifySignUpCode() {
  return useMutation({ mutationFn: verifySignUpCode });
}

export function useResendSignUpCode() {
  return useMutation({ mutationFn: resendSignUpCode });
}

export function useSignIn() {
  return useMutation({ mutationFn: signIn });
}

export function useSignOut() {
  return useMutation({ mutationFn: signOut });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset });
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount });
}
