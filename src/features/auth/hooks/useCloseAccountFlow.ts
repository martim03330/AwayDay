import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { closeAccountFlow } from '@/features/auth/navigation';

/**
 * Returns a function that closes the account modal as soon as the app behind it can take over.
 * `appReady` is false while the introduction is still ending, right after signing in from it: closing
 * before that would land on a screen that is about to disappear.
 */
export function useCloseAccountFlow(appReady: boolean) {
  const router = useRouter();
  const root = useNavigation('/');
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (requested && appReady) closeAccountFlow(router, root);
  }, [requested, appReady, router, root]);

  return () => setRequested(true);
}
