// Turns Supabase Auth errors into messages for the user (European Portuguese).
// Pure and dependency-free so it can be tested without the app.

const GENERIC = 'Correu mal. Tenta outra vez daqui a nada.';
const NETWORK = 'Sem ligação. Verifica a internet e tenta outra vez.';

// A Map, not an object: codes like "toString" must not match inherited properties.
const MESSAGES: ReadonlyMap<string, string> = new Map([
  ...Object.entries({
    invalid_credentials: 'Email ou palavra-passe errados.',
    email_not_confirmed: 'Ainda falta confirmar o teu email.',
    user_already_exists: 'Já existe uma conta com este email. Experimenta entrar.',
    email_exists: 'Já existe uma conta com este email. Experimenta entrar.',
    weak_password: 'Essa palavra-passe é fácil de adivinhar. Usa pelo menos 8 caracteres, com letras e números.',
    same_password: 'A nova palavra-passe tem de ser diferente da antiga.',
    otp_expired: 'O código expirou ou não está certo. Pede um novo.',
    over_email_send_rate_limit: 'Enviámos um email há pouco. Espera um minuto antes de pedir outro.',
    over_request_rate_limit: 'Demasiadas tentativas seguidas. Espera um bocadinho.',
    email_address_invalid: 'Este email não é aceite. Experimenta outro.',
    email_address_not_authorized: 'Ainda não conseguimos enviar emails para este endereço. Tenta mais tarde.',
    signup_disabled: 'Criar conta está desligado de momento.',
    user_banned: 'Esta conta está bloqueada.',
    user_not_found: 'Não encontrámos esta conta.',
    session_not_found: 'A sessão terminou. Entra outra vez.',
    session_expired: 'A sessão terminou. Entra outra vez.',
    validation_failed: 'Há um campo que não está bem preenchido.',
    captcha_failed: 'Não conseguimos confirmar que não és um robô. Tenta outra vez.',
    // Apple or Google not switched on in Supabase (Authentication, Sign In / Providers).
    provider_disabled: 'Este tipo de entrada ainda não está ligado. Usa o email por agora.',
    oauth_provider_not_supported: 'Este tipo de entrada ainda não está ligado. Usa o email por agora.',
  }),
]);

function readString(error: object, key: 'code' | 'name' | 'message') {
  const value: unknown = Reflect.get(error, key);
  return typeof value === 'string' ? value : null;
}

export function authErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null ? readString(error, 'code') : null;
}

export function authErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return GENERIC;

  const name = readString(error, 'name');
  const message = readString(error, 'message') ?? '';
  if (
    name === 'AuthRetryableFetchError' ||
    name === 'FunctionsFetchError' ||
    /network request failed|failed to fetch/i.test(message)
  ) {
    return NETWORK;
  }

  const code = readString(error, 'code');
  return (code ? MESSAGES.get(code) : undefined) ?? GENERIC;
}

/** Apple's or Google's token was refused (wrong client id in Supabase, a nonce that does not match, an old token). */
const SOCIAL_REFUSED = 'Não conseguimos confirmar essa conta. Tenta outra vez ou usa o email.';

/** Like authErrorMessage, for «Continuar com Apple / Google»: a refused token gets its own message. */
export function socialAuthErrorMessage(error: unknown): string {
  const code = authErrorCode(error);
  if (code === 'validation_failed' || code === 'bad_jwt' || code === 'bad_oauth_callback') return SOCIAL_REFUSED;
  return authErrorMessage(error);
}
