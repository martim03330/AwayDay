import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { BotaoAlternar } from '@/ui/botao-alternar';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { CampoTexto } from '@/ui/campo-texto';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { BolhaDeConversa, CaixaDeEscrita } from '@/ui/conversa';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { Segmentado } from '@/ui/segmentado';
import { CampoCodigo } from '@/features/auth/components/AuthForm';
import { Expansor } from '@/ui/expansor';
import { MenuDaMensagem } from '@/ui/menu-da-mensagem';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/** Apple asks for 44 pt touch targets; this is what a press area really covers (size plus slop). */
const ALVO_MINIMO = 44;

function alturaComFolga(elemento: ReturnType<typeof screen.getByRole>) {
  // The host view of a Pressable carries the style already resolved for «not pressed».
  const plano = StyleSheet.flatten(elemento.props.style as StyleProp<ViewStyle>);
  const slop = elemento.props.hitSlop as number | { top?: number; bottom?: number } | undefined;
  const folga = typeof slop === 'number' ? slop * 2 : (slop?.top ?? 0) + (slop?.bottom ?? 0);
  const minimo = typeof plano?.minHeight === 'number' ? plano.minHeight : 0;
  const altura = typeof plano?.height === 'number' ? plano.height : 0;
  return Math.max(minimo, altura) + folga;
}

describe('Button', () => {
  it('is a button with its label, and presses', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Guardar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('when disabled, says so and does not press', () => {
    const onPress = jest.fn();
    render(<Button label="Guardar" onPress={onPress} disabled />);
    const botao = screen.getByRole('button', { name: 'Guardar' });
    expect(botao).toBeDisabled();
    fireEvent.press(botao);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('tells the screen reader which answer is the current one (Sim / Não)', () => {
    render(
      <>
        <Button label="Sim" onPress={jest.fn()} selected />
        <Button label="Não" onPress={jest.fn()} selected={false} />
      </>
    );
    expect(screen.getByRole('button', { name: 'Sim' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Não' })).not.toBeSelected();
  });

  it.each(['primary', 'secondary', 'highlight', 'danger'] as const)(
    'variant %s renders with a touch target of at least 44 pt',
    (variant) => {
      render(<Button label="Ir" onPress={jest.fn()} variant={variant} icon={icons.carro} />);
      expect(alturaComFolga(screen.getByRole('button', { name: 'Ir' }))).toBeGreaterThanOrEqual(ALVO_MINIMO);
    }
  );
});

describe('Campo', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  it('the field is named by its label (and the label is not read twice)', () => {
    render(<Campo label="Email" value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    // The visible label is hidden from the screen reader: the input already says it.
    expect(screen.getByText('Email', { includeHiddenElements: true })).not.toBeVisible();
  });

  it('types', () => {
    const onChangeText = jest.fn();
    render(<Campo label="Nome" value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByLabelText('Nome'), 'Rui');
    expect(onChangeText).toHaveBeenCalledWith('Rui');
  });

  it('puts the error in the field name, shows it, and hides the help', () => {
    render(
      <Campo
        label="Email"
        value="x"
        onChangeText={jest.fn()}
        ajuda="O que usas para entrar."
        erro="Este email não parece certo."
      />
    );
    expect(screen.getByLabelText('Email. Erro: Este email não parece certo.')).toBeOnTheScreen();
    expect(screen.getByText('Este email não parece certo.', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('O que usas para entrar.')).toBeNull();
  });

  it('shows the help when there is no error', () => {
    render(<Campo label="Email" value="" onChangeText={jest.fn()} ajuda="O que usas para entrar." />);
    expect(screen.getByText('O que usas para entrar.')).toBeOnTheScreen();
  });

  it('on iOS, announces the error when it appears and again when it changes', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    anunciar.mockClear();
    const { rerender } = render(<Campo label="Email" value="" onChangeText={jest.fn()} />);
    expect(anunciar).not.toHaveBeenCalled();
    rerender(<Campo label="Email" value="" onChangeText={jest.fn()} erro="Falta o email." />);
    expect(anunciar).toHaveBeenLastCalledWith('Email: Falta o email.');
    rerender(<Campo label="Email" value="a" onChangeText={jest.fn()} erro="Este email não parece certo." />);
    expect(anunciar).toHaveBeenLastCalledWith('Email: Este email não parece certo.');
    expect(anunciar).toHaveBeenCalledTimes(2);
  });

  it('on Android, leaves the error to the live region (no manual announcement)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    anunciar.mockClear();
    render(<Campo label="Email" value="" onChangeText={jest.fn()} erro="Falta o email." />);
    expect(anunciar).not.toHaveBeenCalled();
    expect(
      screen.getByText('Falta o email.', { includeHiddenElements: true }).props.accessibilityLiveRegion
    ).toBe('polite');
  });

  it('a password starts hidden, and the toggle shows and hides it', () => {
    render(<Campo label="Palavra-passe" value="segredo" onChangeText={jest.fn()} secureTextEntry />);
    expect(screen.getByLabelText('Palavra-passe')).toHaveProp('secureTextEntry', true);
    fireEvent.press(screen.getByRole('button', { name: 'Mostrar palavra-passe' }));
    expect(screen.getByLabelText('Palavra-passe')).toHaveProp('secureTextEntry', false);
    fireEvent.press(screen.getByRole('button', { name: 'Esconder palavra-passe' }));
    expect(screen.getByLabelText('Palavra-passe')).toHaveProp('secureTextEntry', true);
  });

  it('with «next» on the keyboard, keeps the keyboard open and calls onSubmitEditing', () => {
    const seguinte = jest.fn();
    render(
      <Campo label="Nome" value="" onChangeText={jest.fn()} returnKeyType="next" onSubmitEditing={seguinte} />
    );
    const campo = screen.getByLabelText('Nome');
    expect(campo).toHaveProp('submitBehavior', 'submit');
    fireEvent(campo, 'submitEditing');
    expect(seguinte).toHaveBeenCalled();
  });
});

describe('CampoTexto', () => {
  it('is named by its label, hints the limit and counts characters', () => {
    render(<CampoTexto label="Nota" value="olá" onChangeText={jest.fn()} maxLength={200} />);
    const campo = screen.getByLabelText('Nota');
    expect(campo).toHaveProp('accessibilityHint', 'Até 200 caracteres.');
    expect(campo).toHaveProp('maxLength', 200);
    expect(screen.getByLabelText('3 de 200 caracteres')).toBeOnTheScreen();
    expect(screen.getByText('3/200')).toBeOnTheScreen();
  });
});

describe('Chip', () => {
  it('says whether it is selected', () => {
    const { rerender } = render(<Chip label="Lisboa" selected={false} onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Lisboa' })).not.toBeSelected();
    rerender(<Chip label="Lisboa" selected onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Lisboa' })).toBeSelected();
  });

  it('uses the given label for the screen reader when the text alone is not enough', () => {
    const onPress = jest.fn();
    render(<Chip label="Recomendo" selected={false} onPress={onPress} accessibilityLabel="Recomendo o prego" />);
    fireEvent.press(screen.getByRole('button', { name: 'Recomendo o prego' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('has a touch target of at least 44 pt', () => {
    render(<Chip label="Porto" selected={false} onPress={jest.fn()} />);
    expect(alturaComFolga(screen.getByRole('button', { name: 'Porto' }))).toBeGreaterThanOrEqual(ALVO_MINIMO);
  });
});

describe('Segmentado', () => {
  const opcoes = [
    { valor: 'lista', label: 'Lista' },
    { valor: 'contas', label: 'Acertar contas' },
  ] as const;

  it('is a tab list with the current tab selected', () => {
    render(<Segmentado opcoes={opcoes} valor="lista" onChange={jest.fn()} />);
    // The container is not focusable itself, so query it through the tree.
    expect(screen.root).toHaveProp('accessibilityRole', 'tablist');
    expect(screen.getByRole('tab', { name: 'Lista' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Acertar contas' })).not.toBeSelected();
  });

  it('changes tab', () => {
    const onChange = jest.fn();
    render(<Segmentado opcoes={opcoes} valor="lista" onChange={onChange} />);
    fireEvent.press(screen.getByRole('tab', { name: 'Acertar contas' }));
    expect(onChange).toHaveBeenCalledWith('contas');
  });

  it('each tab has a touch target of at least 44 pt', () => {
    render(<Segmentado opcoes={opcoes} valor="lista" onChange={jest.fn()} />);
    for (const tab of screen.getAllByRole('tab')) {
      expect(alturaComFolga(tab)).toBeGreaterThanOrEqual(ALVO_MINIMO);
    }
  });
});

describe('EmptyState', () => {
  it('shows a heading and the message, with no button when there is no action', () => {
    render(<EmptyState icon={icons.naoEncontrado} title="Nada por aqui" message="Volta mais tarde." />);
    expect(screen.getByRole('header', { name: 'Nada por aqui' })).toBeOnTheScreen();
    expect(screen.getByText('Volta mais tarde.')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the action as a button', () => {
    const onPress = jest.fn();
    render(
      <EmptyState icon={icons.perfil} title="Sem amigos" message="Convida alguém." action={{ label: 'Convidar', onPress }} />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Convidar' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('LinkTexto', () => {
  it('is a button and presses', () => {
    const onPress = jest.fn();
    render(<LinkTexto label="Agora não" neutro onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Agora não' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('when disabled, says so and does not press', () => {
    const onPress = jest.fn();
    render(<LinkTexto label="Apagar" perigo disabled onPress={onPress} />);
    const botao = screen.getByRole('button', { name: 'Apagar' });
    expect(botao).toBeDisabled();
    fireEvent.press(botao);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('has a touch target of at least 44 pt', () => {
    render(<LinkTexto label="Ver mais" onPress={jest.fn()} />);
    expect(alturaComFolga(screen.getByRole('button', { name: 'Ver mais' }))).toBeGreaterThanOrEqual(ALVO_MINIMO);
  });
});

describe('BotaoAlternar', () => {
  const props = {
    label: { ativo: 'Estou cá', inativo: 'Fazer check-in' },
    icon: { ativo: icons.checkInFeito, inativo: icons.checkIn },
  };

  it('says its state in the name and as selected', () => {
    const onPress = jest.fn();
    const { rerender } = render(<BotaoAlternar ativo={false} onPress={onPress} {...props} />);
    const antes = screen.getByRole('button', { name: 'Fazer check-in' });
    expect(antes).not.toBeSelected();
    fireEvent.press(antes);
    expect(onPress).toHaveBeenCalledTimes(1);
    rerender(<BotaoAlternar ativo onPress={onPress} {...props} />);
    expect(screen.getByRole('button', { name: 'Estou cá' })).toBeSelected();
  });
});

describe('Etiqueta and Card', () => {
  it('a tag is read as one element with its label', () => {
    render(<Etiqueta label="Zona de subida" tone="positivo" />);
    expect(screen.getByLabelText('Zona de subida')).toBeOnTheScreen();
  });

  it('a card with an action is one button with its label', () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress} accessibilityLabel="Abrir o jogo">
        <Etiqueta label="Hoje" tone="destaque" />
      </Card>
    );
    fireEvent.press(screen.getByRole('button', { name: 'Abrir o jogo' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('a card without an action is not a button', () => {
    render(
      <Card accessibilityLabel="Resumo">
        <Etiqueta label="Hoje" tone="destaque" />
      </Card>
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('MensagemErro', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is an alert, and is announced on iOS', () => {
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    anunciar.mockClear();
    render(<MensagemErro>Não deu para enviar.</MensagemErro>);
    expect(screen.getByRole('alert')).toHaveTextContent('Não deu para enviar.');
    if (Platform.OS === 'ios') expect(anunciar).toHaveBeenCalledWith('Não deu para enviar.');
  });
});

describe('Conversa', () => {
  const base = { nome: 'Rui Costa', texto: 'Bora!', criadaEm: '2026-10-06T18:00:00Z', mostrarQuem: true };

  it('your own message: long-press opens the menu, and no name on top', async () => {
    const onLongPress = jest.fn();
    render(<BolhaDeConversa {...base} minha onLongPress={onLongPress} />);
    expect(screen.queryByText('Rui Costa')).toBeNull();
    const bolha = screen.getByHintText('Toca sem largar para reagir, responder e mais opções.');
    fireEvent(bolha, 'longPress');
    // Opens once the bubble is measured (or, here, after the short wait for a measure that never comes).
    await waitFor(() => expect(onLongPress).toHaveBeenCalledTimes(1));
  });

  it("someone else's message shows who wrote it, and tapping the name opens their profile", () => {
    const onAbrirPessoa = jest.fn();
    render(<BolhaDeConversa {...base} minha={false} onLongPress={jest.fn()} onAbrirPessoa={onAbrirPessoa} />);
    fireEvent.press(screen.getByText('Rui Costa'));
    expect(onAbrirPessoa).toHaveBeenCalled();
  });

  it('a reply shows the quote, an edited message says so, and reactions can be tapped', () => {
    const onReagir = jest.fn();
    render(
      <BolhaDeConversa
        {...base}
        minha={false}
        citacao={{ id: 'm1', displayName: 'Zé', body: 'Quem vem?' }}
        editada
        reacoes={[{ emoji: '👍', count: 2, mine: true }]}
        onReagir={onReagir}
      />
    );
    expect(screen.getByText('Quem vem?')).toBeOnTheScreen();
    expect(screen.getByText(/^editada · /)).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('👍 2, a tua'));
    expect(onReagir).toHaveBeenCalledWith('👍');
  });

  it('mentions show apart, and a message that mentions you is marked', () => {
    render(
      <BolhaDeConversa
        {...base}
        minha={false}
        texto="@Ana vens? @todos"
        nomesMencionaveis={['Ana']}
        mencionaMe
      />
    );
    expect(screen.getByText('@Ana')).toBeOnTheScreen();
    expect(screen.getByText('@todos')).toBeOnTheScreen();
  });

  it('typing @ offers @todos and the people; choosing one writes the name', () => {
    const onChange = jest.fn();
    render(
      <CaixaDeEscrita
        valor="olá @an"
        onChange={onChange}
        onEnviar={jest.fn()}
        aEnviar={false}
        placeholder="Escreve"
        accessibilityLabel="Mensagem"
        mencionaveis={[
          { profileId: 'a', nome: 'Ana' },
          { profileId: 'b', nome: 'Rui' },
        ]}
      />
    );
    expect(screen.queryByLabelText('Mencionar Rui')).toBeNull();
    fireEvent.press(screen.getByLabelText('Mencionar Ana'));
    expect(onChange).toHaveBeenCalledWith('olá @Ana ');
  });

  it('a quote of a message that is gone says it is unavailable', () => {
    render(<BolhaDeConversa {...base} minha citacao={{ id: 'm1', displayName: 'Zé', body: null }} />);
    expect(screen.getByText('Mensagem indisponível')).toBeOnTheScreen();
  });

  it('with nothing to do on long-press, promises nothing', () => {
    render(<BolhaDeConversa {...base} minha />);
    expect(screen.queryByHintText(/Toca sem largar/)).toBeNull();
  });

  it('the send button is disabled while the box is empty or only spaces', () => {
    const onEnviar = jest.fn();
    const { rerender } = render(
      <CaixaDeEscrita valor="   " onChange={jest.fn()} onEnviar={onEnviar} aEnviar={false} placeholder="Escreve" accessibilityLabel="Mensagem" />
    );
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    rerender(
      <CaixaDeEscrita valor="Olá" onChange={jest.fn()} onEnviar={onEnviar} aEnviar={false} placeholder="Escreve" accessibilityLabel="Mensagem" />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
    expect(onEnviar).toHaveBeenCalledTimes(1);
    rerender(
      <CaixaDeEscrita valor="Olá" onChange={jest.fn()} onEnviar={onEnviar} aEnviar placeholder="Escreve" accessibilityLabel="Mensagem" />
    );
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.getByLabelText('Mensagem')).toHaveProp('maxLength', 500);
  });
});

describe('MenuDaMensagem', () => {
  it('reacting closes the menu; the same emoji again is offered as taking it away', () => {
    const onReagir = jest.fn();
    const onFechar = jest.fn();
    render(
      <MenuDaMensagem texto="Bora!" minhaReacao="⚽" onReagir={onReagir} acoes={[]} onFechar={onFechar} />
    );
    expect(screen.getByLabelText('Tirar ⚽')).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText('Reagir com 👍'));
    expect(onReagir).toHaveBeenCalledWith('👍');
    expect(onFechar).toHaveBeenCalled();
  });

  it('an action closes the menu and runs', () => {
    const onPress = jest.fn();
    const onFechar = jest.fn();
    render(
      <MenuDaMensagem
        texto="Bora!"
        minhaReacao={null}
        acoes={[{ label: 'Responder', icon: 'responder', onPress }]}
        onFechar={onFechar}
      />
    );
    fireEvent.press(screen.getByText('Responder'));
    expect(onFechar).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalled();
  });

  it('stays closed without a message', () => {
    render(<MenuDaMensagem texto={null} minhaReacao={null} acoes={[]} onFechar={jest.fn()} />);
    expect(screen.queryByText('Bora!')).toBeNull();
  });
});

describe('CampoCodigo', () => {
  it('keeps only digits, at most the code length, and confirms on its own when complete', () => {
    const onChangeText = jest.fn();
    const onCompleto = jest.fn();
    render(
      <CampoCodigo label="Código" value="" onChangeText={onChangeText} digitos={8} onCompleto={onCompleto} />
    );
    fireEvent.changeText(screen.getByLabelText('Código'), '1234 5678 9');
    expect(onChangeText).toHaveBeenCalledWith('12345678');
    expect(onCompleto).toHaveBeenCalledWith('12345678');
  });

  it('does not confirm while incomplete', () => {
    const onCompleto = jest.fn();
    render(<CampoCodigo label="Código" value="" onChangeText={jest.fn()} digitos={8} onCompleto={onCompleto} />);
    fireEvent.changeText(screen.getByLabelText('Código'), '1234');
    expect(onCompleto).not.toHaveBeenCalled();
  });
});

describe('Expansor', () => {
  it('shows the title and the count, says whether it is open, and toggles', () => {
    const onPress = jest.fn();
    render(<Expansor titulo="Outros parques" contagem={16} aberto={false} onPress={onPress} />);
    const faixa = screen.getByRole('button', { name: 'Outros parques, 16' });
    expect(faixa).not.toBeExpanded();
    fireEvent.press(faixa);
    expect(onPress).toHaveBeenCalled();
  });
});
