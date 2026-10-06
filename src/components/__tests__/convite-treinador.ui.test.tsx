import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ConviteTreinador } from '@/components/convite-treinador';
import { botoesDoAlerta, espiarAlertas } from '../../../jest/alertas';
import { definirUtilizador, UTILIZADORES } from '../../../jest/sessao';

jest.mock('@/lib/session', () => jest.requireActual('../../../jest/sessao').mockSessao);

type Perfil = { nudgesEnabled: boolean } | undefined;
let mockPerfil: Perfil;
let mockAPendente = false;
const mockMutate = jest.fn();
jest.mock('@/features/profile/hooks/useMyProfile', () => ({
  useMyProfile: (userId: string | null) => ({ data: userId ? mockPerfil : undefined }),
  useUpdateMessagePreferences: () => ({ mutate: mockMutate, isPending: mockAPendente }),
}));

// Demo mode lives in the app state. «In demo mode the account is left alone: no reads, no writes» (app-state.tsx).
let mockModoDemo = false;
jest.mock('@/state/app-state', () => ({ useAppState: () => ({ modoDemo: mockModoDemo }) }));

const CHAVE = 'awayday-treinador-recusado-v1';
const TITULO = 'Queres uma dica para cada dia de jogo?';

/** Lets the AsyncStorage read resolve, so the card can decide whether to show. */
async function desenhar() {
  render(<ConviteTreinador />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe('ConviteTreinador', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockMutate.mockReset();
    mockAPendente = false;
    mockPerfil = { nudgesEnabled: false };
    mockModoDemo = false;
    definirUtilizador(UTILIZADORES.comConta);
  });
  afterEach(() => jest.restoreAllMocks());

  it('no account: shows nothing', async () => {
    definirUtilizador(UTILIZADORES.semConta);
    await desenhar();
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it('demo mode (signed in, tips off): shows nothing, so a tap cannot change the real account', async () => {
    mockModoDemo = true;
    await desenhar();
    expect(screen.queryByText(TITULO)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quero dicas' })).toBeNull();
  });

  it('signed in, profile still loading: shows nothing', async () => {
    mockPerfil = undefined;
    await desenhar();
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it('signed in with the tips already on: shows nothing', async () => {
    mockPerfil = { nudgesEnabled: true };
    await desenhar();
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it('signed in with the tips off: asks, and says what goes to which third party', async () => {
    await desenhar();
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
    expect(screen.getByText(/escrita por IA \(Claude, da Anthropic\)/)).toBeOnTheScreen();
    expect(screen.getByText(/Nunca com o teu nome nem o email/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Quero dicas' })).toBeOnTheScreen();
  });

  it('never turns the tips on by itself', async () => {
    await desenhar();
    await screen.findByText(TITULO);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('«Quero dicas» turns the tips on (explicit yes)', async () => {
    await desenhar();
    fireEvent.press(await screen.findByRole('button', { name: 'Quero dicas' }));
    expect(mockMutate).toHaveBeenCalledWith({ nudgesEnabled: true }, expect.anything());
  });

  it('when turning on fails, says so', async () => {
    const alerta = espiarAlertas();
    mockMutate.mockImplementation((_valor: unknown, opcoes: { onError?: () => void }) => opcoes.onError?.());
    await desenhar();
    fireEvent.press(await screen.findByRole('button', { name: 'Quero dicas' }));
    expect(alerta).toHaveBeenCalledWith('Não ficou ligado', 'Verifica a ligação e tenta outra vez.');
    expect(botoesDoAlerta(alerta)).toEqual([]);
  });

  it('while saving, the button says so and cannot be pressed twice', async () => {
    mockAPendente = true;
    await desenhar();
    const botao = await screen.findByRole('button', { name: 'A ligar…' });
    expect(botao).toBeDisabled();
    fireEvent.press(botao);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('«Agora não» hides it and is remembered on this phone', async () => {
    await desenhar();
    fireEvent.press(await screen.findByRole('button', { name: 'Agora não' }));
    expect(screen.queryByText(TITULO)).toBeNull();
    await waitFor(async () => expect(await AsyncStorage.getItem(CHAVE)).toBe('1'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('after «Agora não», it does not come back the next time', async () => {
    await AsyncStorage.setItem(CHAVE, '1');
    await desenhar();
    expect(screen.queryByText(TITULO)).toBeNull();
  });

  it('if the phone storage fails, it still asks (no crash)', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
    await desenhar();
    expect(await screen.findByText(TITULO)).toBeOnTheScreen();
  });
});
