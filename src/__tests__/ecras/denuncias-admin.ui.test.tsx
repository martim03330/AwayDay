// The admins' report review (src/app/(tabs)/perfil/denuncias.tsx), for each kind of person who can reach it.
// The test lives outside src/app so Expo Router never picks it up as a page.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import DenunciasScreen from '@/app/(tabs)/perfil/denuncias';
import type { PendingReport } from '@/features/moderation/types';
import { carregarNoAlerta, espiarAlertas } from '../../../jest/alertas';
import { definirUtilizador, UTILIZADORES } from '../../../jest/sessao';

jest.mock('@/lib/session', () => jest.requireActual('../../../jest/sessao').mockSessao);

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});

type Perfil = { data?: { isAdmin: boolean }; isLoading: boolean };
let mockPerfil: Perfil;
jest.mock('@/features/profile/hooks/useMyProfile', () => ({
  useMyProfile: (userId: string | null) => (userId ? mockPerfil : { data: undefined, isLoading: false }),
}));

let mockDenuncias: { data?: PendingReport[]; isLoading: boolean };
const mockUsePendingReports = jest.fn();
const mockRefrescar = jest.fn();
jest.mock('@/features/moderation/hooks/useModeration', () => ({
  usePendingReports: (isAdmin: boolean) => {
    mockUsePendingReports(isAdmin);
    return isAdmin ? mockDenuncias : { data: undefined, isLoading: false };
  },
  useRefreshAfterModeration: () => mockRefrescar,
}));

const mockResolveReport = jest.fn();
jest.mock('@/features/moderation/api', () => ({
  resolveReport: (...args: unknown[]) => mockResolveReport(...args),
}));

function denuncia(mudancas: Partial<PendingReport> = {}): PendingReport {
  return {
    reportId: 'r1',
    kind: 'message',
    targetId: 't1',
    reportedProfileId: 'p-rui',
    reportedName: 'Rui Costa',
    reasons: ['ofensivo'],
    notes: [],
    reports: 1,
    content: 'mensagem feia',
    photoUrl: null,
    contentGone: false,
    hidden: false,
    context: 'Grupo «Os do Norte»',
    lastReportedAt: '2026-10-05T20:00:00Z',
    ...mudancas,
  };
}

beforeEach(() => {
  definirUtilizador(UTILIZADORES.admin);
  mockPerfil = { data: { isAdmin: true }, isLoading: false };
  mockDenuncias = { data: [], isLoading: false };
  mockUsePendingReports.mockReset();
  mockRefrescar.mockReset().mockResolvedValue(undefined);
  mockResolveReport.mockReset().mockResolvedValue(undefined);
  mockBack.mockReset();
});
afterEach(() => jest.restoreAllMocks());

describe('Who can see the reports', () => {
  it('no account: «only for admins», and the reports are never asked for', () => {
    definirUtilizador(UTILIZADORES.semConta);
    render(<DenunciasScreen />);
    expect(screen.getByRole('header', { name: 'Só para administradores' })).toBeOnTheScreen();
    expect(mockUsePendingReports).not.toHaveBeenCalledWith(true);
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('signed in, not an admin: «only for admins», and the reports are never asked for', () => {
    definirUtilizador(UTILIZADORES.comConta);
    mockPerfil = { data: { isAdmin: false }, isLoading: false };
    render(<DenunciasScreen />);
    expect(screen.getByRole('header', { name: 'Só para administradores' })).toBeOnTheScreen();
    expect(mockUsePendingReports).not.toHaveBeenCalledWith(true);
  });

  it('while the profile loads, shows neither the reports nor the refusal', () => {
    mockPerfil = { data: undefined, isLoading: true };
    render(<DenunciasScreen />);
    expect(screen.queryByText('Só para administradores')).toBeNull();
    expect(screen.queryByText(/Esconde o que passa das marcas/)).toBeNull();
  });

  it('admin with nothing to review: «Tudo em ordem»', () => {
    render(<DenunciasScreen />);
    expect(mockUsePendingReports).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('header', { name: 'Tudo em ordem' })).toBeOnTheScreen();
  });
});

describe('Admin reviewing', () => {
  it('shows what was reported, by whom it was written, why — and never who reported it', () => {
    mockDenuncias = {
      isLoading: false,
      data: [denuncia({ reasons: ['ofensivo', 'assedio'], notes: ['não é a primeira vez'], reports: 3 })],
    };
    render(<DenunciasScreen />);
    expect(screen.getByText('Mensagem num grupo')).toBeOnTheScreen();
    expect(screen.getByText('«mensagem feia»')).toBeOnTheScreen();
    expect(screen.getByText(/^De Rui Costa · Grupo «Os do Norte» · /)).toBeOnTheScreen();
    expect(screen.getByText('Motivo: Ofensivo, Assédio')).toBeOnTheScreen();
    expect(screen.getByText('«não é a primeira vez»')).toBeOnTheScreen();
    expect(screen.getByLabelText('3 denúncias')).toBeOnTheScreen();
    expect(screen.queryByText(/denunciado por|reporter/i)).toBeNull();
  });

  it('hiding a message asks first; «Deixa estar» does nothing', () => {
    const alerta = espiarAlertas();
    mockDenuncias = { isLoading: false, data: [denuncia()] };
    render(<DenunciasScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Esconder a mensagem' }));
    expect(alerta).toHaveBeenCalledWith(
      'Esconder para toda a gente?',
      'A mensagem sai da conversa de todos, incluindo de quem a escreveu.',
      expect.any(Array)
    );
    carregarNoAlerta(alerta, 'Deixa estar');
    expect(mockResolveReport).not.toHaveBeenCalled();
  });

  it('confirming hides it and refreshes', async () => {
    const alerta = espiarAlertas();
    mockDenuncias = { isLoading: false, data: [denuncia()] };
    render(<DenunciasScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Esconder a mensagem' }));
    carregarNoAlerta(alerta, 'Esconder a mensagem');
    await waitFor(() => expect(mockRefrescar).toHaveBeenCalled());
    expect(mockResolveReport).toHaveBeenCalledWith('r1', 'esconder');
  });

  it('a reported photo: shows it with a description, and taking it down asks first', async () => {
    const alerta = espiarAlertas();
    mockDenuncias = {
      isLoading: false,
      data: [denuncia({ kind: 'profile_photo', content: 'p-rui/foto.jpg', photoUrl: 'https://exemplo/foto.jpg' })],
    };
    render(<DenunciasScreen />);
    expect(screen.getByLabelText('Foto de perfil de Rui Costa')).toBeOnTheScreen();
    // The storage path is not shown as text.
    expect(screen.queryByText('p-rui/foto.jpg')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Remover a foto' }));
    expect(alerta).toHaveBeenCalledWith('Remover a foto?', 'A pessoa fica na app, só sem foto.', expect.any(Array));
    carregarNoAlerta(alerta, 'Remover a foto');
    await waitFor(() => expect(mockResolveReport).toHaveBeenCalledWith('r1', 'tirar_foto'));
  });

  it('a name or a group: «Já tratei» closes without asking', async () => {
    const alerta = espiarAlertas();
    mockDenuncias = { isLoading: false, data: [denuncia({ kind: 'group', content: 'Nome feio', reportedName: null })] };
    render(<DenunciasScreen />);
    expect(screen.getByText(/Nomes ainda se mudam à mão/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Já tratei' }));
    expect(alerta).not.toHaveBeenCalled();
    await waitFor(() => expect(mockResolveReport).toHaveBeenCalledWith('r1', 'resolver'));
  });

  it('something already gone or hidden only needs closing', async () => {
    mockDenuncias = {
      isLoading: false,
      data: [denuncia({ reportId: 'r1', contentGone: true }), denuncia({ reportId: 'r2', hidden: true })],
    };
    render(<DenunciasScreen />);
    expect(screen.getByText(/Já foi apagado \(ou mudado\) entretanto/)).toBeOnTheScreen();
    expect(screen.getByText('Esta mensagem já está escondida.')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Esconder a mensagem' })).toBeNull();
  });

  it('reject works, and while one is being handled every button waits', async () => {
    let terminar: () => void = () => undefined;
    mockResolveReport.mockReturnValue(new Promise<void>((resolve) => (terminar = resolve)));
    mockDenuncias = { isLoading: false, data: [denuncia({ reportId: 'r1' }), denuncia({ reportId: 'r2' })] };
    render(<DenunciasScreen />);
    fireEvent.press(screen.getAllByRole('button', { name: 'Rejeitar' })[0]!);
    expect(mockResolveReport).toHaveBeenCalledWith('r1', 'rejeitar');
    await waitFor(() => {
      for (const botao of screen.getAllByRole('button')) expect(botao).toBeDisabled();
    });
    await act(async () => terminar());
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Rejeitar' })[1]).toBeEnabled());
  });

  it('when the server fails, says so and lets the admin try again', async () => {
    const alerta = espiarAlertas();
    mockResolveReport.mockRejectedValue(new Error('network'));
    mockDenuncias = { isLoading: false, data: [denuncia()] };
    render(<DenunciasScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Rejeitar' }));
    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith('Não foi possível', 'Verifica a ligação e tenta outra vez.')
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeEnabled());
  });
});
