// Turns Supabase Auth errors into messages for the user (European Portuguese).
// Pure and dependency-free so it can be tested without the app.

const GENERIC = 'Correu mal. Tenta outra vez daqui a nada.';
const NETWORK = 'Sem ligação. Verifica a internet e tenta outra vez.';

// A Map, not an object: codes like "toString" must not match inherited properties.
const MESSAGES: ReadonlyMap<string, string> = new Map([
  ...Object.entries({
    invalid_credentials: 'Email ou password errados.',
    email_not_confirmed: 'Ainda falta confirmar o teu email.',
    user_already_exists: 'Já existe uma conta com este email. Experimenta entrar.',
    email_exists: 'Já existe uma conta com este email. Experimenta entrar.',
    weak_password: 'Essa password é fácil de adivinhar. Usa pelo menos 8 caracteres, com letras e números.',
    same_password: 'A nova password tem de ser diferente da antiga.',
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
