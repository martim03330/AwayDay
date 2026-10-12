import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const enviar = vi.fn();
vi.mock('@/features/feedback/report', () => ({
  reportErrorOnce: (...args: unknown[]) => {
    enviar(...args);
    return Promise.resolve(true);
  },
  primeirasLinhas: (stack?: string) => stack ?? '',
}));

type Handler = (erro: unknown, fatal?: boolean) => void;
const global = globalThis as unknown as {
  __DEV__?: boolean;
  ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(handler: Handler): void };
  HermesInternal?: { enablePromiseRejectionTracker?: (opcoes: { onUnhandled: (id: number, e: unknown) => void }) => void };
};

describe('ligarErrosGlobais', () => {
  let handler: Handler;
  const anterior = vi.fn();
  let onUnhandled: ((id: number, e: unknown) => void) | undefined;

  beforeEach(() => {
    vi.resetModules();
    enviar.mockClear();
    anterior.mockClear();
    global.__DEV__ = false;
    handler = anterior;
    global.ErrorUtils = { getGlobalHandler: () => handler, setGlobalHandler: (novo) => (handler = novo) };
    global.HermesInternal = { enablePromiseRejectionTracker: (opcoes) => (onUnhandled = opcoes.onUnhandled) };
  });

  afterEach(() => {
    delete global.ErrorUtils;
    delete global.HermesInternal;
    global.__DEV__ = true;
  });

  it('reports errors outside the screens and still lets React Native handle them', async () => {
    const { ligarErrosGlobais } = await import('@/features/feedback/erros-globais');
    ligarErrosGlobais();
    const erro = new Error('timer partiu');
    handler(erro, true);
    expect(enviar).toHaveBeenCalledWith('global:timer partiu', 'Erro fatal fora dos ecrãs', erro, expect.anything());
    expect(anterior).toHaveBeenCalledWith(erro, true);
  });

  it('reports promises that failed with nobody catching them', async () => {
    const { ligarErrosGlobais } = await import('@/features/feedback/erros-globais');
    ligarErrosGlobais();
    onUnhandled?.(1, new Error('pedido falhou'));
    expect(enviar).toHaveBeenCalledWith(
      'promessa:pedido falhou',
      'Promessa falhada sem tratamento',
      expect.any(Error),
      expect.anything()
    );
  });

  it('changes nothing in development', async () => {
    global.__DEV__ = true;
    const { ligarErrosGlobais } = await import('@/features/feedback/erros-globais');
    ligarErrosGlobais();
    expect(handler).toBe(anterior);
  });
});
