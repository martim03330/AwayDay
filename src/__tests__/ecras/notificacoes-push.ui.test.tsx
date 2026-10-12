// Push taps (src/state/notificacoes-push.tsx): the tap that launched a closed app opens the right screen once the
// navigation is ready, and a pending «Ligar avisos» from the introduction asks for permission on the first sign-in.
import { render, waitFor } from '@testing-library/react-native';

import { NotificacoesPush } from '@/state/notificacoes-push';
import { definirUtilizador, UTILIZADORES } from '../../../jest/sessao';

jest.mock('@/lib/session', () => jest.requireActual('../../../jest/sessao').mockSessao);

const mockPush = jest.fn();
let mockNavegacaoPronta = true;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRootNavigationState: () => (mockNavegacaoPronta ? { key: 'raiz' } : undefined),
}));

type Resposta = {
  actionIdentifier: string;
  notification: { request: { identifier: string; content: { data: Record<string, unknown> } } };
};
let mockUltima: Resposta | null = null;
const mockLimpar = jest.fn();
let mockOuvinte: ((resposta: Resposta) => void) | null = null;
jest.mock('expo-notifications', () => ({
  getLastNotificationResponse: () => mockUltima,
  clearLastNotificationResponse: () => mockLimpar(),
  addNotificationResponseReceivedListener: (ouvinte: (resposta: Resposta) => void) => {
    mockOuvinte = ouvinte;
    return { remove: jest.fn() };
  },
}));

const mockEnable = jest.fn();
const mockRegister = jest.fn();
const mockEsquecer = jest.fn();
let mockPedirAoEntrar = false;
let mockPermissao = 'granted';
jest.mock('@/lib/push', () => ({
  enablePushOnThisDevice: () => mockEnable(),
  registerThisDevice: () => mockRegister(),
  forgetPendingDeviceToken: () => mockEsquecer(),
  takePushAskOnSignIn: () => Promise.resolve(mockPedirAoEntrar),
  pushPermission: () => Promise.resolve(mockPermissao),
}));
jest.mock('@/features/feedback/report', () => ({ reportErrorOnce: jest.fn() }));
jest.mock('@/features/profile/hooks/useMyProfile', () => ({
  useMyProfile: (userId: string | null) => ({ data: userId ? { isAdmin: false } : undefined }),
}));
jest.mock('@/state/app-state', () => ({ useAppState: () => ({ onboardingConcluido: true }) }));
jest.mock('@/mocks/jogos', () => ({ obterJogo: (id: string) => (id === 'j1' ? { id } : undefined) }));

function resposta(id: string, data: Record<string, unknown>): Resposta {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { request: { identifier: id, content: { data } } },
  };
}

beforeEach(() => {
  definirUtilizador(UTILIZADORES.semConta);
  mockPush.mockReset();
  mockLimpar.mockReset();
  mockEnable.mockReset().mockResolvedValue('granted');
  mockRegister.mockReset().mockResolvedValue(undefined);
  mockEsquecer.mockReset().mockResolvedValue(undefined);
  mockUltima = null;
  mockOuvinte = null;
  mockNavegacaoPronta = true;
  mockPedirAoEntrar = false;
  mockPermissao = 'granted';
});

describe('Cold start', () => {
  it('the tap that opened the app opens its game, once, and is cleared', () => {
    mockUltima = resposta('n1', { type: 'weather', fixtureId: 'j1' });
    const { rerender } = render(<NotificacoesPush />);
    rerender(<NotificacoesPush />);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/jogos/[jogoId]', params: { jogoId: 'j1' } });
    expect(mockLimpar).toHaveBeenCalled();
    // The listener may report the same tap: it is not opened twice.
    mockOuvinte?.(resposta('n1', { type: 'weather', fixtureId: 'j1' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('waits for the navigation before opening anything', () => {
    mockNavegacaoPronta = false;
    mockUltima = resposta('n2', { type: 'recap' });
    const { rerender } = render(<NotificacoesPush />);
    expect(mockPush).not.toHaveBeenCalled();
    mockNavegacaoPronta = true;
    rerender(<NotificacoesPush />);
    expect(mockPush).toHaveBeenCalledWith('/perfil/retrospetiva');
  });

  it('a local game reminder (jogoId) opens the game', () => {
    mockUltima = resposta('n3', { type: 'o-meu-jogo', jogoId: 'j1' });
    render(<NotificacoesPush />);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/jogos/[jogoId]', params: { jogoId: 'j1' } });
  });
});

describe('Signing in', () => {
  it('asks for permission when «Ligar avisos» was chosen without an account', async () => {
    mockPedirAoEntrar = true;
    definirUtilizador(UTILIZADORES.comConta);
    render(<NotificacoesPush />);
    await waitFor(() => expect(mockEnable).toHaveBeenCalledTimes(1));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('asks a phone that was never asked (otherwise iOS does not list the app under Notifications)', async () => {
    mockPermissao = 'undetermined';
    definirUtilizador(UTILIZADORES.comConta);
    render(<NotificacoesPush />);
    await waitFor(() => expect(mockEnable).toHaveBeenCalledTimes(1));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('without a session, forgets a token whose removal failed at the last sign-out', async () => {
    definirUtilizador(UTILIZADORES.semConta);
    render(<NotificacoesPush />);
    await waitFor(() => expect(mockEsquecer).toHaveBeenCalledTimes(1));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('a phone that already answered is only registered, without asking', async () => {
    mockPermissao = 'denied';
    definirUtilizador(UTILIZADORES.comConta);
    render(<NotificacoesPush />);
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockEnable).not.toHaveBeenCalled();
  });
});
