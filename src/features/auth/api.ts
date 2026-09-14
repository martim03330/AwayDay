import { signUpOutcome } from '@/features/auth/outcomes';
import { normalizeCode, normalizeEmail } from '@/features/auth/validation';
import { unregisterThisDevice } from '@/lib/push';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type SignUpInput = { email: string; password: string; displayName: string };
export type SignInInput = { email: string; password: string };
export type CodeInput = { email: string; code: string };
export type ResetPasswordInput = { email: string; code: string; password: string };
export type DeleteAccountInput = { password: string };

/**
 * Creates the account. With email confirmation on, Supabase sends an 8-digit code and returns no
 * session; with it off, the user is signed in straight away. An email that already has a confirmed
 * account comes back as 'already-registered' (see signUpOutcome).
 */
export async function signUp({ email, password, displayName }: SignUpInput) {
  const { data, error } = await client().auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw error;
  return signUpOutcome(data);
}

/** Confirms the email with the code; on success the user is signed in. */
export async function verifySignUpCode({ email, code }: CodeInput) {
  const { error } = await client().auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizeCode(code),
    type: 'email',
  });
  if (error) throw error;
}

export async function resendSignUpCode(email: string) {
  const { error } = await client().auth.resend({ type: 'signup', email: normalizeEmail(email) });
  if (error) throw error;
}

export async function signIn({ email, password }: SignInInput) {
  const { error } = await client().auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw error;
}

/** Signs out on this phone only; other devices stay signed in. */
export async function signOut() {
  // While still signed in: stop sending this account's notifications to this phone.
  await unregisterThisDevice().catch(() => undefined);
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** Sends an 8-digit code to change the password. Same answer whether or not the account exists. */
export async function requestPasswordReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(normalizeEmail(email));
  if (error) throw error;
}

/** Checks the recovery code (which signs the user in) and sets the new password. */
export async function resetPassword({ email, code, password }: ResetPasswordInput) {
  const verification = await client().auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizeCode(code),
    type: 'recovery',
  });
  if (verification.error) throw verification.error;

  const update = await client().auth.updateUser({ password });
  if (update.error) throw update.error;
}

/**
 * Deletes the account through the `delete-account` edge function, then clears the local session. Deleting is
 * permanent, so the password is checked again first: the function only accepts a session that has just signed in.
 */
export async function deleteAccount({ password }: DeleteAccountInput) {
  const { data } = await client().auth.getSession();
  const email = data.session?.user.email;
  if (!email) throw Object.assign(new Error('No signed-in user.'), { code: 'session_not_found' });

  const reauthentication = await client().auth.signInWithPassword({ email, password });
  if (reauthentication.error) throw reauthentication.error;

  const { error } = await client().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  // The user no longer exists, so the server may reject the sign-out; the local session goes anyway.
  await client().auth.signOut({ scope: 'local' });
}
