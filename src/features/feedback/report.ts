import { sendFeedback, type AreaFeedback } from '@/features/feedback/api';

// Automatic error reports. Quiet by design: the person never sees them and they never block anything. Each key is
// sent at most once per launch (the feedback RPC also rate-limits per account), and in development they only go to
// the console so the inbox does not fill up with our own mistakes.

const enviados = new Set<string>();

function mensagem(erro: unknown) {
  if (erro instanceof Error) return erro.message || erro.name;
  if (typeof erro === 'string') return erro;
  try {
    return JSON.stringify(erro);
  } catch {
    return String(erro);
  }
}

/** The first lines of a stack trace, enough to find the place without flooding the row. */
export function primeirasLinhas(stack: string | undefined, linhas = 6) {
  if (!stack) return '';
  return stack.split('\n').slice(0, linhas).join('\n');
}

/**
 * Sends `[automático] <contexto>: <mensagem>` as an 'erro' feedback, once per `chave` per launch. Never throws.
 * Resolves to true when it was sent now.
 */
export async function reportErrorOnce(
  chave: string,
  contexto: string,
  erro: unknown,
  opcoes: { area?: AreaFeedback; stack?: string } = {}
): Promise<boolean> {
  if (enviados.has(chave)) return false;
  enviados.add(chave);
  const texto = mensagem(erro);
  if (__DEV__) {
    console.warn(`${contexto}:`, erro);
    return false;
  }
  const corpo = [`[automático] ${contexto}: ${texto}`, primeirasLinhas(opcoes.stack)]
    .filter((parte) => parte.length > 0)
    .join('\n')
    .slice(0, 1000);
  try {
    await sendFeedback({ kind: 'erro', area: opcoes.area ?? 'outro', body: corpo.padEnd(10, '.') });
    return true;
  } catch {
    return false;
  }
}

/** For tests only. */
export function esquecerRelatorios() {
  enviados.clear();
}
