import { useNavigation, useRouter } from 'expo-router';

import { closeAccountFlow } from '@/features/auth/navigation';
import { takePendingInvite } from '@/features/auth/pending-invite';

/** Name of the root route under the account modal, before it closes. */
function routeBelowModal(root: { getState: () => { routes: readonly unknown[] } | undefined }): string | null {
  const routes = root.getState()?.routes ?? [];
  const below = routes.length > 1 ? routes[routes.length - 2] : undefined;
  return below && typeof below === 'object' && 'name' in below && typeof below.name === 'string'
    ? below.name
    : null;
}

/**
 * Returns a function that closes the account modal. It closes straight away, also when it was opened from the
 * introduction: the welcome screen underneath sends a signed-in person on to the profile steps (photo, club, where
 * they leave from). Waiting for the introduction to end — as it used to — left sign-in stuck on «A entrar…», since the
 * introduction now goes on after signing in.
 *
 * When a group invite was opened without an account, it then goes back to that invite. If the invite screen is right
 * under the modal, closing is enough; otherwise it is opened again with the kept code.
 */
export function useCloseAccountFlow() {
  const router = useRouter();
  const root = useNavigation('/');
  return () => {
    const below = routeBelowModal(root);
    closeAccountFlow(router, root);
    void takePendingInvite().then((code) => {
      if (!code || below === 'grupos') return;
      router.push({ pathname: '/grupos/entrar', params: { code } });
    });
  };
}
