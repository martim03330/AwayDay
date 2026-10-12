// Cloudflare Turnstile inside a WebView: the page it loads and the messages it sends back. Pure, so it is tested
// without a phone. The component that shows it lives in components/CaptchaProvider.tsx.

/** The page's address as far as Turnstile can tell: the hostname registered for the widget in Cloudflare. */
export const CAPTCHA_BASE_URL = 'https://martim03330.github.io/';

/** How long to wait for a token before giving up (Turnstile usually answers in 1–3 s). */
export const CAPTCHA_TIMEOUT_MS = 30_000;

/** The captcha could not give a token: shown as «Não conseguimos confirmar que não és um robô» (see errors.ts). */
export class CaptchaFailed extends Error {
  readonly code = 'captcha_failed';
  constructor(motivo: string) {
    super(motivo);
    this.name = 'CaptchaFailed';
  }
}

export type CaptchaMessage =
  | { tipo: 'pronto' }
  | { tipo: 'token'; token: string }
  | { tipo: 'erro'; codigo: string }
  | { tipo: 'mostrar' }
  | { tipo: 'esconder' };

/** Reads a message from the page; anything else (or malformed) is `null`. */
export function readCaptchaMessage(raw: string): CaptchaMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const tipo = 'tipo' in value ? value.tipo : undefined;
  if (tipo === 'pronto' || tipo === 'mostrar' || tipo === 'esconder') return { tipo };
  if (tipo === 'token' && 'token' in value && typeof value.token === 'string' && value.token.length > 0) {
    return { tipo, token: value.token };
  }
  if (tipo === 'erro') {
    const codigo = 'codigo' in value ? String(value.codigo) : 'desconhecido';
    return { tipo, codigo };
  }
  return null;
}

/** A value as a JavaScript literal that is also safe inside <script> (no `</script>` can close it early). */
function emScript(valor: string) {
  return JSON.stringify(valor).replace(/</g, '\\u003c');
}

/**
 * The page: one Turnstile widget that only runs when asked (`window.pedir()`), invisible unless Cloudflare needs the
 * person to tick a box (then it says `mostrar`, and `esconder` when done). Every token is single-use, so each
 * request resets the widget first.
 */
export function captchaPage(siteKey: string, escuro: boolean) {
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=pronto" async defer></script>
<style>html,body{margin:0;height:100%;background:transparent}body{display:flex;align-items:center;justify-content:center}</style>
</head>
<body>
<div id="w"></div>
<script>
  var id = null;
  var pendente = false;
  function enviar(m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  function pronto() {
    id = turnstile.render('#w', {
      sitekey: ${emScript(siteKey)},
      execution: 'execute',
      appearance: 'interaction-only',
      theme: ${emScript(escuro ? 'dark' : 'light')},
      language: 'pt',
      callback: function (t) { enviar({ tipo: 'token', token: t }); },
      'error-callback': function (c) { enviar({ tipo: 'erro', codigo: String(c) }); return true; },
      'before-interactive-callback': function () { enviar({ tipo: 'mostrar' }); },
      'after-interactive-callback': function () { enviar({ tipo: 'esconder' }); }
    });
    enviar({ tipo: 'pronto' });
    if (pendente) window.pedir();
  }
  window.pedir = function () {
    if (id === null) { pendente = true; return; }
    pendente = false;
    turnstile.reset(id);
    turnstile.execute(id);
  };
</script>
</body>
</html>`;
}
