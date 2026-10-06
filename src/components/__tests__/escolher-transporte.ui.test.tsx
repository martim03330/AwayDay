import { fireEvent, render, screen } from '@testing-library/react-native';

import { EscolherTransporte, OPCOES_TRANSPORTE } from '@/components/escolher-transporte';

const NOME = (indice: number) => {
  const opcao = OPCOES_TRANSPORTE[indice];
  if (!opcao) throw new Error('No such option.');
  return `${opcao.titulo}. ${opcao.detalhe}`;
};

describe('EscolherTransporte', () => {
  it('is a radio group with three options, none checked at first', () => {
    render(<EscolherTransporte valor={null} onChange={jest.fn()} />);
    expect(screen.root).toHaveProp('accessibilityRole', 'radiogroup');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) expect(radio).not.toBeChecked();
  });

  it('each option is read with its title and what it changes', () => {
    render(<EscolherTransporte valor={null} onChange={jest.fn()} />);
    for (let indice = 0; indice < OPCOES_TRANSPORTE.length; indice += 1) {
      expect(screen.getByRole('radio', { name: NOME(indice) })).toBeOnTheScreen();
    }
  });

  it.each([
    ['driver', 0],
    ['passenger', 1],
    ['public_transport', 2],
  ] as const)('with %s chosen, only that one is checked', (valor, indice) => {
    render(<EscolherTransporte valor={valor} onChange={jest.fn()} />);
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio, outro) => {
      if (outro === indice) expect(radio).toBeChecked();
      else expect(radio).not.toBeChecked();
    });
  });

  it('pressing an option sends its value (also pressing the one already chosen)', () => {
    const onChange = jest.fn();
    render(<EscolherTransporte valor="driver" onChange={onChange} />);
    fireEvent.press(screen.getByRole('radio', { name: NOME(2) }));
    expect(onChange).toHaveBeenLastCalledWith('public_transport');
    fireEvent.press(screen.getByRole('radio', { name: NOME(0) }));
    expect(onChange).toHaveBeenLastCalledWith('driver');
  });

  it('the texts are European Portuguese (no «você»)', () => {
    for (const opcao of OPCOES_TRANSPORTE) {
      expect(`${opcao.titulo} ${opcao.detalhe}`).not.toMatch(/\bvocê\b/i);
    }
  });
});
