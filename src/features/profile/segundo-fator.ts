import { supabase } from '@/lib/supabase';

// The second factor for admins: a code from an authenticator app (TOTP, Supabase Auth MFA). The server only treats an
// admin as admin in a session verified with it (is_admin() reads the JWT's aal2).

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export type EstadoSegundoFator =
  /** Never turned on: show how to set it up. */
  | { fase: 'por-ativar' }
  /** Turned on, but this session only used the password: ask for today's code. */
  | { fase: 'por-confirmar'; factorId: string }
  /** This session already passed the second factor. */
  | { fase: 'confirmado' };

export async function estadoDoSegundoFator(): Promise<EstadoSegundoFator> {
  const [nivel, fatores] = await Promise.all([
    client().auth.mfa.getAuthenticatorAssuranceLevel(),
    client().auth.mfa.listFactors(),
  ]);
  if (nivel.error) throw nivel.error;
  if (fatores.error) throw fatores.error;
  if (nivel.data.currentLevel === 'aal2') return { fase: 'confirmado' };
  const verificado = fatores.data.totp.find((fator) => fator.status === 'verified');
  return verificado ? { fase: 'por-confirmar', factorId: verificado.id } : { fase: 'por-ativar' };
}

export type NovoSegundoFator = { factorId: string; segredo: string; uri: string };

/** Starts the setup: the secret to type (or the otpauth link to open) in the authenticator app. */
export async function comecarSegundoFator(): Promise<NovoSegundoFator> {
  // A setup left halfway leaves an unverified factor behind; it would block a new one with the same name.
  const fatores = await client().auth.mfa.listFactors();
  if (fatores.error) throw fatores.error;
  for (const fator of fatores.data.all) {
    if (fator.factor_type === 'totp' && fator.status !== 'verified') {
      await client().auth.mfa.unenroll({ factorId: fator.id });
    }
  }
  const { data, error } = await client().auth.mfa.enroll({ factorType: 'totp', friendlyName: 'AwayDay admin' });
  if (error) throw error;
  return { factorId: data.id, segredo: data.totp.secret, uri: data.totp.uri };
}

/** Checks a 6-digit code: finishes the setup, or confirms this session. The session becomes aal2. */
export async function confirmarCodigo(factorId: string, codigo: string) {
  const { error } = await client().auth.mfa.challengeAndVerify({ factorId, code: codigo.trim() });
  if (error) throw error;
}

export { lerCodigo } from '@/lib/codigo-otp';
