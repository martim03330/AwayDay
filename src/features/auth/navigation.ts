import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;
// What this function needs from the root stack. `useNavigation()` types its return by the screen it is called from,
// so naming the two methods here keeps the helper usable from any of the modal's screens.
type Navigation = {
  getState: () => { routes: readonly unknown[] } | undefined;
  goBack: () => void;
};

/**
 * Closes the whole account modal, whichever of its screens is open. `root` is the root stack.
 *
 * Signing in from the introduction ends it, and the introduction leaves the root stack: the modal can then
 * be the only screen, with nothing under it to go back to. In that case the modal is replaced by the app.
 */
export function closeAccountFlow(router: Router, root: Navigation) {
  const abaixo = root.getState()?.routes.length ?? 0;
  if (abaixo > 1) root.goBack();
  else router.replace('/');
}
