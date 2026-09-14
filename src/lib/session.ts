import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session };

let state: SessionState = supabase ? { status: 'loading' } : { status: 'signed-out' };
const listeners = new Set<() => void>();

function setState(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

if (supabase) {
  // Fires once with the stored session (or none), then on every sign-in, sign-out and token refresh.
  // The callback must not call Supabase directly, or it can deadlock the auth client.
  supabase.auth.onAuthStateChange((_event, session) => {
    setState(session ? { status: 'signed-in', session } : { status: 'signed-out' });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

/** Current auth session. Shared by every feature that needs to know who is signed in. */
export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** The signed-in user's id, or `null`. */
export function useUserId() {
  const current = useSession();
  return current.status === 'signed-in' ? current.session.user.id : null;
}
