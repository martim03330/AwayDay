/**
 * Group invite codes, as the server makes them: 10 lowercase letters or digits (`fan_group.invite_code`, checked by
 * `^[a-z0-9]{10}$`). The server trims and lowercases what it gets, so the app does the same before asking.
 */
const INVITE_CODE = /^[a-z0-9]{10}$/;

/**
 * Reads an invite code from what someone typed or pasted: the code alone, or a whole invite link
 * (`awayday://grupos/entrar?code=…`, or the web page's `…/convite/?c=…`). Returns `null` when there is no valid code.
 */
export function parseInviteCode(input: string): string | null {
  const texto = input.trim();
  const doLink = /[?&](?:code|c)=([^&#\s]+)/i.exec(texto);
  const candidato = (doLink ? decodeURIComponent(doLink[1]) : texto).replace(/[\s-]/g, '').toLowerCase();
  return INVITE_CODE.test(candidato) ? candidato : null;
}
