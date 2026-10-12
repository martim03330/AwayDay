// The root error boundary (ErrorBoundary exported from src/app/_layout.tsx) and the quiet error reports behind it.
// The test lives outside src/app so Expo Router never picks it up as a page.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockReport = jest.fn();
jest.mock('@/features/feedback/report', () => ({
  reportErrorOnce: (...args: unknown[]) => mockReport(...args),
}));

// The layout pulls in every provider; the boundary itself uses none of them.
jest.mock('@/state/app-state', () => ({ AppStateProvider: () => null, useAppState: () => ({}) }));
jest.mock('@/state/planos-jogos', () => ({ PlanosJogosProvider: () => null }));
jest.mock('@/state/ai-coach', () => ({ AICoachProvider: () => null }));
jest.mock('@/state/notificacoes-push', () => ({ NotificacoesPush: () => null }));
jest.mock('@/state/sincronizar-conta', () => ({ SincronizarConta: () => null }));
jest.mock('@/state/juntar-atividade', () => ({ JuntarAtividade: () => null }));
jest.mock('@/state/sons', () => ({ SonsProvider: () => null }));
jest.mock('@/state/relogio', () => ({ RelogioProvider: () => null }));
jest.mock('@/components/ligacao-demo', () => ({ LigacaoDemo: () => null }));
jest.mock('@/components/avisos-jogos-perto', () => ({ AvisosJogosPerto: () => null }));
jest.mock('@/components/banner-de-mensagem', () => ({ BannerDeMensagem: () => null }));
jest.mock('@/features/rides/components/AvisosBoleias', () => ({ AvisosBoleias: () => null }));
jest.mock('@/features/fixtures/components/FixtureCatalogSync', () => ({ FixtureCatalogSync: () => null }));
jest.mock('@/features/places/components/PlaceCatalogSync', () => ({ PlaceCatalogSync: () => null }));
jest.mock('@/features/fixtures/hooks/useFixtureCatalog', () => ({ restoreFixtureCatalog: jest.fn() }));
jest.mock('@/features/places/hooks/usePlaceCatalog', () => ({ restorePlaceCatalog: jest.fn() }));
jest.mock('@/lib/query-client', () => ({ QueryProvider: () => null }));
jest.mock('expo-router', () => {
  const tema = { dark: false, colors: {}, fonts: {} };
  return { DarkTheme: tema, DefaultTheme: tema, Stack: () => null, ThemeProvider: () => null };
});
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));

// eslint-disable-next-line import/first
import { ErrorBoundary } from '@/app/_layout';

function erro(mensagem: string) {
  const e = new Error(mensagem);
  e.stack = `Error: ${mensagem}\n    at Ecra (ecra.tsx:10:5)\n    at Outro (outro.tsx:3:1)`;
  return e;
}

beforeEach(() => {
  mockReport.mockReset().mockResolvedValue(true);
});

describe('A screen that crashed', () => {
  it('shows a calm message and a retry, never the error itself', () => {
    render(<ErrorBoundary error={erro('undefined is not an object')} retry={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Algo correu mal neste ecrã' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar outra vez' })).toBeOnTheScreen();
    expect(screen.queryByText(/undefined is not an object/)).toBeNull();
  });

  it('reports the error with its stack, as an «erro» in «outro», once per error', () => {
    const problema = erro('boom');
    const { rerender } = render(<ErrorBoundary error={problema} retry={jest.fn()} />);
    rerender(<ErrorBoundary error={problema} retry={jest.fn()} />);
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      'Ecrã partiu',
      problema,
      { area: 'outro', stack: problema.stack }
    );
  });

  it('retry re-renders the screen, and a failed report never blocks it', async () => {
    mockReport.mockRejectedValue(new Error('offline'));
    const retry = jest.fn().mockResolvedValue(undefined);
    render(<ErrorBoundary error={erro('boom')} retry={retry} />);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    });
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe('Automatic error reports', () => {
  const mockSend = jest.fn();

  beforeAll(() => {
    jest.unmock('@/features/feedback/report');
  });

  it('send at most once per key per launch, in production only, and never throw', async () => {
    jest.resetModules();
    jest.doMock('@/features/feedback/api', () => ({
      sendFeedback: (...args: unknown[]) => mockSend(...args),
    }));
    mockSend.mockReset().mockRejectedValueOnce(new Error('rate_limited')).mockResolvedValue(undefined);
    const global = globalThis as { __DEV__?: boolean };
    const antes = global.__DEV__;
    global.__DEV__ = false;
    try {
      const { reportErrorOnce } = jest.requireActual<typeof import('@/features/feedback/report')>(
        '@/features/feedback/report'
      );
      await expect(reportErrorOnce('push', 'Registo', new Error('sem rede'))).resolves.toBe(false);
      await expect(reportErrorOnce('push', 'Registo', new Error('sem rede'))).resolves.toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        kind: 'erro',
        area: 'outro',
        body: '[automático] Registo: sem rede',
      });
      await expect(
        reportErrorOnce('ecra', 'Ecrã partiu', new Error('x'), { stack: 'a\nb\nc\nd\ne\nf\ng\nh' })
      ).resolves.toBe(true);
      expect(mockSend).toHaveBeenLastCalledWith(
        expect.objectContaining({ body: '[automático] Ecrã partiu: x\na\nb\nc\nd\ne\nf' })
      );
    } finally {
      global.__DEV__ = antes;
    }
  });
});
