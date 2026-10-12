import { primeirasLinhas, reportErrorOnce } from '@/features/feedback/report';

// Errors outside the screens: a crash in a timer or an event handler (ErrorUtils) and promises that fail with nobody
// catching them (Hermes' rejection tracker). The error boundary only sees errors while drawing; these go to the same
// automatic reports, once per message per launch. In development React Native already shows them, so nothing changes.

type Handler = (erro: unknown, fatal?: boolean) => void;
type ErrorUtilsGlobal = { getGlobalHandler(): Handler; setGlobalHandler(handler: Handler): void };
type Hermes = {
  enablePromiseRejectionTracker?: (opcoes: {
    allRejections: boolean;
    onUnhandled: (id: number, erro: unknown) => void;
  }) => void;
};

function chave(prefixo: string, erro: unknown) {
  const texto = erro instanceof Error ? erro.message : String(erro);
  return `${prefixo}:${texto.slice(0, 120)}`;
}

let ligado = false;

/** Call once, when the app starts. Safe to call again. */
export function ligarErrosGlobais() {
  if (ligado || __DEV__) return;
  ligado = true;

  const global = globalThis as unknown as { ErrorUtils?: ErrorUtilsGlobal; HermesInternal?: Hermes };

  const errorUtils = global.ErrorUtils;
  if (errorUtils) {
    const anterior = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((erro, fatal) => {
      void reportErrorOnce(chave('global', erro), fatal ? 'Erro fatal fora dos ecrãs' : 'Erro fora dos ecrãs', erro, {
        stack: erro instanceof Error ? primeirasLinhas(erro.stack) : undefined,
      });
      anterior(erro, fatal);
    });
  }

  global.HermesInternal?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, erro) => {
      void reportErrorOnce(chave('promessa', erro), 'Promessa falhada sem tratamento', erro, {
        stack: erro instanceof Error ? primeirasLinhas(erro.stack) : undefined,
      });
    },
  });
}
