import { useNavigation, useRouter } from 'expo-router';

import { closeAccountFlow } from '@/features/auth/navigation';

/**
 * Returns a function that closes the account modal. It closes straight away, also when it was opened from the
 * introduction: the welcome screen underneath sends a signed-in person on to the profile steps (photo, club, where
 * they leave from). Waiting for the introduction to end — as it used to — left sign-in stuck on «A entrar…», since the
 * introduction now goes on after signing in.
 */
export function useCloseAccountFlow() {
  const router = useRouter();
  const root = useNavigation('/');
  return () => closeAccountFlow(router, root);
}
