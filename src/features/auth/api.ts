import { signUpOutcome } from '@/features/auth/outcomes';
import { normalizeCode, normalizeEmail } from '@/features/auth/validation';
import { unregisterThisDevice } from '@/lib/push';
import { supabase } from '@/lib/supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

/** `termsVersion`: the terms and privacy policy the person accepted (and, with them, the minimum age). */
/** `captchaToken`: from Cloudflare Turnstile (see CaptchaProvider); Supabase Auth refuses these requests without it. */
type Captcha = { captchaToken?: string };
export type SignUpInput = { email: string; password: string; displayName: string; termsVersion: string } & Captcha;
export type SignInInput = { email: string; password: string } & Captcha;
export type CodeInput = { email: string; code: string };
export type ResetPasswordInput = { email: string; code: string; password: string };
export type DeleteAccountInput = { password: string } & Captcha;

/**
 * Creates the account. With email confirmation on, Supabase sends an 8-digit code and returns no
 * session; with it off, the user is signed in straight away. An email that already has a confirmed
 * account comes back as 'already-registered' (see signUpOutcome).
 */
export async function signUp({ email, password, displayName, termsVersion, captchaToken }: SignUpInput) {
  const { data, error } = await client().auth.signUp({
    email: normalizeEmail(email),
    password,
    // The accepted version and when are kept with the account, as proof of consent.
    options: {
      captchaToken,
      data: {
        display_name: displayName.trim(),
        terms_version: termsVersion,
        terms_accepted_at: new Date().toISOString(),
      },
    },
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

export async function resendSignUpCode(email: string, captchaToken?: string) {
  const { error } = await client().auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
    options: { captchaToken },
  });
  if (error) throw error;
}

export async function signIn({ email, password, captchaToken }: SignInInput) {
  const { error } = await client().auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
    options: { captchaToken },
  });
  if (error) throw error;
}

/**
 * Whether a name can be used (the server refuses swear words and slurs). Asked before signing up, so the form can say
 * «escolhe outro nome» instead of failing. If the server cannot be reached, says yes: sign-up then decides.
 */
export async function isNameAllowed(name: string) {
  const { data, error } = await client().rpc('name_allowed', {
    p_name: name.trim(),
  });
  return error ? true : data;
}

/** Signs out on this phone only; other devices stay signed in. */
export async function signOut() {
  // While still signed in: stop sending this account's notifications to this phone.
  await unregisterThisDevice().catch(() => undefined);
  const { error } = await client().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** The email asked about has no account: the screen says so instead of waiting for a code that never comes. */
export class NoAccountForEmail extends Error {
  constructor() {
    super('no_account');
    this.name = 'NoAccountForEmail';
  }
}

/**
 * Sends an 8-digit code to change the password. Checks first that the email has an account (`email_has_account`,
 * limited per network address); if that check cannot be made, sends anyway, as before.
 */
export async function requestPasswordReset(email: string, captchaToken?: string) {
  const normalizado = normalizeEmail(email);
  const conta = await client().rpc('email_has_account', {
    p_email: normalizado,
  });
  if (!conta.error && conta.data === false) throw new NoAccountForEmail();
  const { error } = await client().auth.resetPasswordForEmail(normalizado, {
    captchaToken,
  });
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
export async function deleteAccount({ password, captchaToken }: DeleteAccountInput) {
  const { data } = await client().auth.getSession();
  const email = data.session?.user.email;
  if (!email)
    throw Object.assign(new Error('No signed-in user.'), {
      code: 'session_not_found',
    });

  const reauthentication = await client().auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (reauthentication.error) throw reauthentication.error;

  const { error } = await client().functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
  // The user no longer exists, so the server may reject the sign-out; the local session goes anyway.
  await client().auth.signOut({ scope: 'local' });
}
