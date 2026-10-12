import { describe, expect, it } from 'vitest';

import { CaptchaFailed, captchaPage, readCaptchaMessage } from '@/features/auth/captcha-turnstile';
import { authErrorMessage } from '@/features/auth/errors';

describe('readCaptchaMessage', () => {
  it('reads the messages the page sends', () => {
    expect(readCaptchaMessage('{"tipo":"pronto"}')).toEqual({ tipo: 'pronto' });
    expect(readCaptchaMessage('{"tipo":"token","token":"abc.123"}')).toEqual({ tipo: 'token', token: 'abc.123' });
    expect(readCaptchaMessage('{"tipo":"erro","codigo":110200}')).toEqual({ tipo: 'erro', codigo: '110200' });
    expect(readCaptchaMessage('{"tipo":"mostrar"}')).toEqual({ tipo: 'mostrar' });
    expect(readCaptchaMessage('{"tipo":"esconder"}')).toEqual({ tipo: 'esconder' });
  });

  it('ignores anything else', () => {
    expect(readCaptchaMessage('not json')).toBeNull();
    expect(readCaptchaMessage('null')).toBeNull();
    expect(readCaptchaMessage('"token"')).toBeNull();
    expect(readCaptchaMessage('{"tipo":"token","token":""}')).toBeNull();
    expect(readCaptchaMessage('{"tipo":"token","token":42}')).toBeNull();
    expect(readCaptchaMessage('{"tipo":"outro"}')).toBeNull();
    expect(readCaptchaMessage('{}')).toBeNull();
  });

  it('gives an unknown error a code', () => {
    expect(readCaptchaMessage('{"tipo":"erro"}')).toEqual({ tipo: 'erro', codigo: 'desconhecido' });
  });
});

describe('captchaPage', () => {
  it('loads Turnstile with the site key, only when asked, and in the right theme', () => {
    const page = captchaPage('0x4AAAAAAFUx6RQG9lmmztaZ', true);
    expect(page).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
    expect(page).toContain('sitekey: "0x4AAAAAAFUx6RQG9lmmztaZ"');
    expect(page).toContain("execution: 'execute'");
    expect(page).toContain("appearance: 'interaction-only'");
    expect(page).toContain('theme: "dark"');
    expect(captchaPage('k', false)).toContain('theme: "light"');
  });

  it('cannot be broken out of by a strange site key', () => {
    const page = captchaPage('"};alert(1);//</script><script>alert(2)', false);
    expect(page).not.toContain('sitekey: ""};alert(1)');
    expect(page).toContain('sitekey: "\\"};alert(1);//\\u003c/script>\\u003cscript>alert(2)"');
    // The only </script> left are the page's own two.
    expect(page.match(/<\/script>/g)).toHaveLength(2);
  });
});

describe('CaptchaFailed', () => {
  it('shows the robot message', () => {
    expect(authErrorMessage(new CaptchaFailed('tempo'))).toBe(
      'Não conseguimos confirmar que não és um robô. Tenta outra vez.'
    );
  });

  it('is also what Supabase Auth says when it refuses the token', () => {
    expect(authErrorMessage({ code: 'captcha_failed', message: 'captcha protection: request disallowed' })).toBe(
      'Não conseguimos confirmar que não és um robô. Tenta outra vez.'
    );
  });
});
