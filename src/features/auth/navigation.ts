import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/** Closes the whole account modal, whichever of its screens is open. */
export function closeAccountFlow(router: Router) {
  if (router.canDismiss()) router.dismissAll();
  router.back();
}
