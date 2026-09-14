import type { Session, User } from '@supabase/supabase-js';

export type SignUpOutcome = 'signed-in' | 'needs-confirmation' | 'already-registered';

/**
 * What a sign-up answer means. With email confirmation on, Supabase does not return an error for an
 * email that already has a confirmed account: it answers with a user without identities and sends no
 * email. Without this check the app would wait for a code that never arrives.
 */
export function signUpOutcome(data: {
  user: Pick<User, 'identities'> | null;
  session: Session | null;
}): SignUpOutcome {
  if (data.session) return 'signed-in';
  // Only an explicit empty list counts: if identities were missing we would rather ask for the code
  // than wrongly tell someone new that they already have an account.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return 'already-registered';
  }
  return 'needs-confirmation';
}
