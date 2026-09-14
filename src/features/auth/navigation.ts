import type { useNavigation, useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;
type Navigation = ReturnType<typeof useNavigation>;

/**
 * Closes the whole account modal, whichever of its screens is open. `root` is the root stack.
 *
 * Signing in from the introduction ends it, and the introduction leaves the root stack: the modal can then
 * be the only screen, with nothing under it to go back to. In that case the modal is replaced by the app.
 */
export function closeAccountFlow(router: Router, root: Navigation) {
  if (root.getState().routes.length > 1) root.goBack();
  else router.replace('/');
}
