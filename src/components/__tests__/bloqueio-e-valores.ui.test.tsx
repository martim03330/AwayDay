// The optional app lock (src/components/bloqueio-da-app.tsx) and «Esconder valores» (src/ui/valor.tsx).
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { BloqueioDaApp } from '@/components/bloqueio-da-app';
import { Valor } from '@/ui/valor';
import { definirUtilizador, UTILIZADORES } from '../../../jest/sessao';

jest.mock('@/lib/session', () => jest.requireActual('../../../jest/sessao').mockSessao);

const mockAuthenticate = jest.fn();
let mockBiometria = true;
let mockNivel = 3;
jest.mock('expo-local-authentication', () => ({
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  hasHardwareAsync: () => Promise.resolve(mockBiometria),
  isEnrolledAsync: () => Promise.resolve(mockBiometria),
  supportedAuthenticationTypesAsync: () => Promise.resolve(mockBiometria ? [2] : []),
  getEnrolledLevelAsync: () => Promise.resolve(mockNivel),
  authenticateAsync: (opcoes: unknown) => mockAuthenticate(opcoes),
}));

let mockEstado = { bloqueioAoAbrir: true, modoDemo: false, esconderValores: false };
jest.mock('@/state/app-state', () => ({ useAppState: () => mockEstado }));

beforeEach(() => {
  mockEstado = { bloqueioAoAbrir: true, modoDemo: false, esconderValores: false };
  mockBiometria = true;
  mockNivel = 3;
  mockAuthenticate.mockReset();
  mockAuthenticate.mockResolvedValue({ success: false, error: 'user_cancel' });
  definirUtilizador(UTILIZADORES.comConta);
});

describe('BloqueioDaApp', () => {
  it('covers the app on a cold start and asks for Face ID, with the passcode as fallback', async () => {
    render(<BloqueioDaApp />);
    expect(screen.getByTestId('bloqueio-da-app')).toBeOnTheScreen();
    expect(screen.getByText('AwayDay')).toBeOnTheScreen();
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    expect(mockAuthenticate).toHaveBeenCalledWith(expect.objectContaining({ disableDeviceFallback: false }));
    expect(await screen.findByText('O AwayDay está bloqueado. Entra com Face ID.')).toBeOnTheScreen();
  });

  it('opens once the phone confirms the owner', async () => {
    render(<BloqueioDaApp />);
    // Generous waits: CI machines are slower than a laptop.
    const espera = { timeout: 5000 };
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1), espera);
    // The automatic request must finish first: a tap while it runs is ignored (as on the phone).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeEnabled(), espera);
    mockAuthenticate.mockResolvedValue({ success: true });
    fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(screen.queryByTestId('bloqueio-da-app')).toBeNull(), espera);
    expect(mockAuthenticate).toHaveBeenCalledTimes(2);
  });

  it('falls back to the passcode when there is no biometrics', async () => {
    mockBiometria = false;
    mockNivel = 1;
    render(<BloqueioDaApp />);
    expect(await screen.findByText('O AwayDay está bloqueado. Entra com código do telemóvel.')).toBeOnTheScreen();
  });

  it('never locks when the phone has neither biometrics nor a passcode', async () => {
    mockBiometria = false;
    mockNivel = 0;
    render(<BloqueioDaApp />);
    await waitFor(() => expect(screen.queryByTestId('bloqueio-da-app')).toBeNull());
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it.each([
    ['turned off', () => (mockEstado = { ...mockEstado, bloqueioAoAbrir: false })],
    ['in demo mode', () => (mockEstado = { ...mockEstado, modoDemo: true })],
    ['signed out', () => definirUtilizador(UTILIZADORES.semConta)],
  ])('does not lock when %s', async (_caso, preparar) => {
    preparar();
    render(<BloqueioDaApp />);
    expect(screen.queryByTestId('bloqueio-da-app')).toBeNull();
    await new Promise((resolver) => setTimeout(resolver, 300));
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});

describe('Valor', () => {
  it('shows the amount normally', () => {
    render(<Valor cents={1250} />);
    expect(screen.getByText('12,50 €')).toBeOnTheScreen();
  });

  it('hides it with «Esconder valores», read as «valor escondido»', () => {
    mockEstado = { ...mockEstado, esconderValores: true };
    render(<Valor cents={1250} depois=" cada" />);
    expect(screen.queryByText(/12,50/)).toBeNull();
    expect(screen.getByText('•••• € cada')).toBeOnTheScreen();
    expect(screen.getByLabelText('valor escondido cada')).toBeOnTheScreen();
  });
});
