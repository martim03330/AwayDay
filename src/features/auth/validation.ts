// Form rules for sign-up and sign-in. They mirror the Supabase Auth settings in supabase/config.toml
// (minimum_password_length, password_requirements, otp_length), so errors show up before a request.
// Messages are shown to the user, so they are in European Portuguese.

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignores anything after 72 bytes, so Supabase refuses longer passwords. */
export const PASSWORD_MAX_LENGTH = 72;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 40;
export const CODE_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Keeps only the digits, so a code pasted as "123 456" still works. */
export function normalizeCode(code: string) {
  return code.replace(/\D/g, '');
}

export function emailError(email: string): string | null {
  const value = normalizeEmail(email);
  if (!value) return 'Falta o email.';
  if (!EMAIL_PATTERN.test(value)) return 'Este email não parece bem escrito.';
  return null;
}

export function passwordError(password: string): string | null {
  if (!password) return 'Falta a palavra-passe.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A palavra-passe precisa de pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A palavra-passe pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  // Supabase's "letters_digits" rule only counts a to z (without accents) as letters.
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'A palavra-passe precisa de letras e números.';
  }
  return null;
}

export function displayNameError(name: string): string | null {
  const length = name.trim().length;
  if (length === 0) return 'Diz-nos como te chamamos.';
  if (length < DISPLAY_NAME_MIN_LENGTH) return 'O nome precisa de pelo menos 2 letras.';
  if (length > DISPLAY_NAME_MAX_LENGTH) return 'O nome pode ter no máximo 40 caracteres.';
  return null;
}

export function codeError(code: string): string | null {
  return normalizeCode(code).length === CODE_LENGTH ? null : 'O código tem 8 algarismos.';
}
