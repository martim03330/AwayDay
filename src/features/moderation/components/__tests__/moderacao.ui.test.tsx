import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ActionSheetIOS, Platform } from 'react-native';

import { ModerationRefused } from '@/features/moderation/api';
import { BotaoMais, useModeracao, type Opcao } from '@/features/moderation/components/Moderacao';
import type { BlockedPerson } from '@/features/moderation/types';
import { Button } from '@/ui/button';
import { carregarNoAlerta, espiarAlertas } from '../../../../../jest/alertas';
import { definirUtilizador, UTILIZADORES } from '../../../../../jest/sessao';

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('@/lib/session', () => jest.requireActual('../../../../../jest/sessao').mockSessao);

const mockReportContent = jest.fn();
const mockBlockUser = jest.fn();
const mockUnblockUser = jest.fn();
jest.mock('@/features/moderation/api', () => ({
  ...jest.requireActual('@/features/moderation/api'),
  reportContent: (...args: unknown[]) => mockReportContent(...args),
  blockUser: (...args: unknown[]) => mockBlockUser(...args),
  unblockUser: (...args: unknown[]) => mockUnblockUser(...args),
}));

let mockBloqueados: BlockedPerson[] = [];
const mockUseBlockedPeople = jest.fn();
const mockRefrescar = jest.fn();
jest.mock('@/features/moderation/hooks/useModeration', () => ({
  useBlockedPeople: (signedIn: boolean) => {
    mockUseBlockedPeople(signedIn);
    return { data: mockBloqueados };
  },
  useRefreshAfterModeration: () => mockRefrescar,
}));

type Moderacao = ReturnType<typeof useModeracao>;

/** A screen with the moderation sheet and one button that opens whatever the test asks. */
function Ecra({ abrir }: { abrir: (moderacao: Moderacao) => void }) {
  const moderacao = useModeracao();
  return (
    <>
      {moderacao.elemento}
      <Button label="Abrir" onPress={() => abrir(moderacao)} />
    </>
  );
}

const RUI = { profileId: 'p-rui', nome: 'Rui Costa' };

const mensagemDoRui = (extras?: Opcao[]) => (moderacao: Moderacao) =>
  moderacao.abrirMensagem({ kind: 'message', messageId: 'msg-1', pessoa: RUI, extras });

type FolhaIOS = {
  title?: string;
  options: string[];
  cancelButtonIndex?: number;
  destructiveButtonIndex?: number | number[];
};

const originalOS = Platform.OS;
function usarPlataforma(os: 'ios' | 'android') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

let folha: jest.SpyInstance;
function ultimaFolha(): { opcoes: FolhaIOS; escolher: (indice: number) => void } {
  const chamada = folha.mock.calls[folha.mock.calls.length - 1] as [FolhaIOS, (indice: number) => void] | undefined;
  if (!chamada) throw new Error('No action sheet was shown.');
  return { opcoes: chamada[0], escolher: (indice) => act(() => chamada[1](indice)) };
}

function escolherNaFolha(label: string) {
  const { opcoes, escolher } = ultimaFolha();
  const indice = opcoes.options.indexOf(label);
  if (indice < 0) throw new Error(`No «${label}» in ${JSON.stringify(opcoes.options)}`);
  escolher(indice);
}

beforeEach(() => {
  usarPlataforma('ios');
  definirUtilizador(UTILIZADORES.comConta);
  mockBloqueados = [];
  mockReportContent.mockReset().mockResolvedValue(undefined);
  mockBlockUser.mockReset().mockResolvedValue(undefined);
  mockUnblockUser.mockReset().mockResolvedValue(undefined);
  mockRefrescar.mockReset().mockResolvedValue(undefined);
  mockUseBlockedPeople.mockReset();
  folha = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  usarPlataforma(originalOS as 'ios' | 'android');
});

describe('useModeracao — who asks for the blocked list', () => {
  it('signed in: reads the blocked list', () => {
    render(<Ecra abrir={() => undefined} />);
    expect(mockUseBlockedPeople).toHaveBeenLastCalledWith(true);
  });

  it('no account: does not ask the server for a blocked list', () => {
    definirUtilizador(UTILIZADORES.semConta);
    render(<Ecra abrir={() => undefined} />);
    expect(mockUseBlockedPeople).toHaveBeenLastCalledWith(false);
  });
});

describe("Long-press on someone else's message (iOS action sheet)", () => {
  it('offers report and block, with Cancel last and block in red', () => {
    render(<Ecra abrir={mensagemDoRui()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    const { opcoes } = ultimaFolha();
    expect(opcoes.title).toBe('Mensagem de Rui Costa');
    expect(opcoes.options).toEqual(['Denunciar mensagem', 'Bloquear Rui', 'Cancelar']);
    expect(opcoes.cancelButtonIndex).toBe(2);
    expect(opcoes.destructiveButtonIndex).toEqual([1]);
  });

  it("the group owner's «Apagar» goes first, also in red", () => {
    const apagar = jest.fn();
    render(<Ecra abrir={mensagemDoRui([{ label: 'Apagar', destrutiva: true, onPress: apagar }])} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(ultimaFolha().opcoes.options).toEqual(['Apagar', 'Denunciar mensagem', 'Bloquear Rui', 'Cancelar']);
    expect(ultimaFolha().opcoes.destructiveButtonIndex).toEqual([0, 2]);
    escolherNaFolha('Apagar');
    expect(apagar).toHaveBeenCalled();
  });

  it('Cancel does nothing', () => {
    render(<Ecra abrir={mensagemDoRui()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    escolherNaFolha('Cancelar');
    expect(screen.queryByText('Diz-nos o que se passa.', { exact: false })).toBeNull();
    expect(mockReportContent).not.toHaveBeenCalled();
  });

  it('someone already blocked: offers to unblock instead, not in red, and unblocks', async () => {
    mockBloqueados = [{ profileId: 'p-rui', displayName: 'Rui Costa', blockedAt: '2026-10-01T00:00:00Z' }];
    render(<Ecra abrir={mensagemDoRui()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(ultimaFolha().opcoes.options).toEqual(['Denunciar mensagem', 'Desbloquear Rui', 'Cancelar']);
    expect(ultimaFolha().opcoes.destructiveButtonIndex).toEqual([]);
    escolherNaFolha('Desbloquear Rui');
    await waitFor(() => expect(mockRefrescar).toHaveBeenCalled());
    expect(mockUnblockUser).toHaveBeenCalledWith('p-rui');
  });
});

describe('Reporting', () => {
  async function abrirDenunciaDaMensagem() {
    render(<Ecra abrir={mensagemDoRui()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    escolherNaFolha('Denunciar mensagem');
    return screen.findByText('Denunciar mensagem');
  }

  it('the sheet promises the reporter stays anonymous and lists the reasons', async () => {
    await abrirDenunciaDaMensagem();
    expect(
      screen.getByText('Diz-nos o que se passa. Quem gere a app vê a denúncia; Rui não sabe que foste tu.')
    ).toBeOnTheScreen();
    for (const razao of ['Ofensivo', 'Assédio', 'Spam', 'Perigoso', 'Outra coisa']) {
      expect(screen.getByRole('button', { name: razao })).not.toBeSelected();
    }
    expect(screen.getByLabelText('Queres acrescentar alguma coisa? (opcional)')).toHaveProp('maxLength', 500);
  });

  it('cannot send without a reason', async () => {
    await abrirDenunciaDaMensagem();
    const enviar = screen.getByRole('button', { name: 'Enviar denúncia' });
    expect(enviar).toBeDisabled();
    fireEvent.press(enviar);
    expect(mockReportContent).not.toHaveBeenCalled();
  });

  it('sends the reason and the note, thanks, and offers to block too', async () => {
    let terminar: () => void = () => undefined;
    mockReportContent.mockReturnValue(new Promise<void>((resolve) => (terminar = resolve)));
    await abrirDenunciaDaMensagem();
    fireEvent.press(screen.getByRole('button', { name: 'Assédio' }));
    expect(screen.getByRole('button', { name: 'Assédio' })).toBeSelected();
    fireEvent.changeText(screen.getByLabelText('Queres acrescentar alguma coisa? (opcional)'), 'não é a primeira vez');
    fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));

    // While sending: says so and cannot be sent twice.
    const aEnviar = await screen.findByRole('button', { name: 'A enviar…' });
    expect(aEnviar).toBeDisabled();
    fireEvent.press(aEnviar);
    expect(mockReportContent).toHaveBeenCalledTimes(1);
    expect(mockReportContent).toHaveBeenCalledWith({
      kind: 'message',
      targetId: 'msg-1',
      reason: 'assedio',
      note: 'não é a primeira vez',
    });

    await act(async () => terminar());
    expect(await screen.findByText('Obrigado por avisares')).toBeOnTheScreen();
    expect(screen.getByText(/Rui não fica a saber que foste tu\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bloquear Rui também' })).toBeOnTheScreen();
  });

  it('«Bloquear também» closes the sheet, then asks to confirm the block, and blocks', async () => {
    jest.useFakeTimers();
    const alerta = espiarAlertas();
    await abrirDenunciaDaMensagem();
    fireEvent.press(screen.getByRole('button', { name: 'Spam' }));
    fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Bloquear Rui também' }));
    expect(screen.queryByText('Obrigado por avisares')).toBeNull();
    expect(alerta).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(450));
    expect(alerta).toHaveBeenCalledWith(
      'Bloquear Rui Costa?',
      'Deixas de ver o que Rui escreve nos grupos e no carro, e não te pode pedir amizade nem convidar-te. Não lhe dizemos nada. Podes desfazer nas Definições.',
      expect.any(Array)
    );
    carregarNoAlerta(alerta, 'Bloquear');
    jest.useRealTimers();
    await waitFor(() => expect(alerta).toHaveBeenLastCalledWith('Feito', 'Já não vês o que Rui escreve.'));
    expect(mockBlockUser).toHaveBeenCalledWith('p-rui');
    expect(mockRefrescar).toHaveBeenCalled();
  });

  it('after reporting someone already blocked, does not offer to block again', async () => {
    mockBloqueados = [{ profileId: 'p-rui', displayName: 'Rui Costa', blockedAt: '2026-10-01T00:00:00Z' }];
    await abrirDenunciaDaMensagem();
    fireEvent.press(screen.getByRole('button', { name: 'Ofensivo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    await screen.findByText('Obrigado por avisares');
    expect(screen.queryByRole('button', { name: /também/ })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Obrigado por avisares')).toBeNull();
  });

  it.each([
    [new ModerationRefused('rate_limited'), 'Já enviaste muitas denúncias hoje. Volta a tentar amanhã.'],
    [new ModerationRefused('own_content'), 'Isso é teu: em vez de denunciar, podes apagar.'],
    [new ModerationRefused('not_found'), 'Isto já não está cá. Pode ter sido apagado entretanto.'],
    [new ModerationRefused('no_photo'), 'Essa pessoa já não tem foto.'],
    [new ModerationRefused('not_signed_in'), 'Não deu para enviar. Tenta outra vez.'],
    [new Error('network'), 'Não deu para enviar. Tenta outra vez.'],
  ])('a refusal (%s) is shown as an alert and the sheet stays open', async (erro, texto) => {
    mockReportContent.mockRejectedValue(erro);
    await abrirDenunciaDaMensagem();
    fireEvent.press(screen.getByRole('button', { name: 'Perigoso' }));
    fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(texto);
    expect(screen.getByRole('button', { name: 'Enviar denúncia' })).toBeEnabled();
    expect(screen.queryByText('Obrigado por avisares')).toBeNull();
  });

  it('«Deixa estar» closes and forgets the reason and note', async () => {
    await abrirDenunciaDaMensagem();
    fireEvent.press(screen.getByRole('button', { name: 'Spam' }));
    fireEvent.changeText(screen.getByLabelText('Queres acrescentar alguma coisa? (opcional)'), 'xyz');
    fireEvent.press(screen.getByRole('button', { name: 'Deixa estar' }));
    expect(screen.queryByRole('button', { name: 'Enviar denúncia' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    escolherNaFolha('Denunciar mensagem');
    await screen.findByText('Denunciar mensagem');
    expect(screen.getByRole('button', { name: 'Spam' })).not.toBeSelected();
    expect(screen.getByLabelText('Queres acrescentar alguma coisa? (opcional)')).toHaveProp('value', '');
    expect(screen.getByRole('button', { name: 'Enviar denúncia' })).toBeDisabled();
  });
});

describe('The «⋯» next to a person', () => {
  it('BotaoMais is a button that names the person', () => {
    const onPress = jest.fn();
    render(<BotaoMais nome="Rui Costa" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Mais opções sobre Rui Costa' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('without a photo: report the person and block', () => {
    render(<Ecra abrir={(moderacao) => moderacao.abrirPessoa({ pessoa: RUI })} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(ultimaFolha().opcoes.title).toBe('Rui Costa');
    expect(ultimaFolha().opcoes.options).toEqual(['Denunciar Rui', 'Bloquear Rui', 'Cancelar']);
  });

  it('with a photo: can report the photo, which is sent as a profile photo report', async () => {
    render(<Ecra abrir={(moderacao) => moderacao.abrirPessoa({ pessoa: RUI, temFoto: true })} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(ultimaFolha().opcoes.options).toEqual(['Denunciar Rui', 'Denunciar a foto', 'Bloquear Rui', 'Cancelar']);
    escolherNaFolha('Denunciar a foto');
    expect(await screen.findByText('Denunciar a foto de Rui')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Ofensivo' }));
    fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    await screen.findByText('Obrigado por avisares');
    expect(mockReportContent).toHaveBeenCalledWith({
      kind: 'profile_photo',
      targetId: 'p-rui',
      reason: 'ofensivo',
      note: '',
    });
  });

  it('blocking asks first, and «Deixa estar» does not block', () => {
    const alerta = espiarAlertas();
    render(<Ecra abrir={(moderacao) => moderacao.abrirPessoa({ pessoa: RUI })} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    escolherNaFolha('Bloquear Rui');
    expect(alerta).toHaveBeenCalledWith('Bloquear Rui Costa?', expect.any(String), expect.any(Array));
    carregarNoAlerta(alerta, 'Deixa estar');
    expect(mockBlockUser).not.toHaveBeenCalled();
  });

  it('when blocking fails, says so', async () => {
    const alerta = espiarAlertas();
    mockBlockUser.mockRejectedValue(new Error('network'));
    render(<Ecra abrir={(moderacao) => moderacao.abrirPessoa({ pessoa: RUI })} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    escolherNaFolha('Bloquear Rui');
    carregarNoAlerta(alerta, 'Bloquear');
    await waitFor(() =>
      expect(alerta).toHaveBeenLastCalledWith('Não deu para bloquear', 'Tenta outra vez daqui a pouco.')
    );
  });
});

describe('Reporting a group', () => {
  it('opens straight on the sheet, promises anonymity to everyone, and never offers to block', async () => {
    render(<Ecra abrir={(moderacao) => moderacao.denunciarGrupo('g-1', 'Os do Norte')} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(folha).not.toHaveBeenCalled();
    expect(await screen.findByText('Denunciar «Os do Norte»')).toBeOnTheScreen();
    expect(
      screen.getByText('Diz-nos o que se passa. Quem gere a app vê a denúncia; ninguém sabe que foste tu.')
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Outra coisa' }));
    fireEvent.press(screen.getByRole('button', { name: 'Enviar denúncia' }));
    await screen.findByText('Obrigado por avisares');
    expect(mockReportContent).toHaveBeenCalledWith({ kind: 'group', targetId: 'g-1', reason: 'outro', note: '' });
    expect(screen.queryByRole('button', { name: /Bloquear/ })).toBeNull();
  });
});

describe('Android: the menu is a small sheet in the app', () => {
  beforeEach(() => usarPlataforma('android'));

  /**
   * The option's own button. The dimmed backdrop («Fechar») wraps the whole menu, so a name query by text also finds
   * the backdrop; the option is the one without a label of its own.
   */
  function opcaoDoMenu(label: string) {
    const botao = screen
      .getAllByRole('button', { name: label })
      .find((candidato) => candidato.props.accessibilityLabel === undefined);
    if (!botao) throw new Error(`No «${label}» option in the menu.`);
    return botao;
  }

  it('shows the title and the options as buttons, and Cancel closes it', () => {
    render(<Ecra abrir={mensagemDoRui()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    expect(folha).not.toHaveBeenCalled();
    expect(screen.getByText('Mensagem de Rui Costa')).toBeOnTheScreen();
    expect(opcaoDoMenu('Denunciar mensagem')).toBeOnTheScreen();
    expect(opcaoDoMenu('Bloquear Rui')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeOnTheScreen();
    fireEvent.press(opcaoDoMenu('Cancelar'));
    expect(screen.queryByText('Mensagem de Rui Costa')).toBeNull();
  });

  it('tapping the dimmed backdrop closes it', () => {
    render(<Ecra abrir={mensagemDoRui()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByText('Mensagem de Rui Costa')).toBeNull();
    expect(mockReportContent).not.toHaveBeenCalled();
  });

  it('choosing an option closes the menu and does it', async () => {
    render(<Ecra abrir={mensagemDoRui()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.press(opcaoDoMenu('Denunciar mensagem'));
    expect(screen.queryByText('Mensagem de Rui Costa')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Enviar denúncia' })).toBeOnTheScreen();
  });
});
