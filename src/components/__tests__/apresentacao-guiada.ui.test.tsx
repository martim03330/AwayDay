import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApresentacaoGuiada } from '@/components/apresentacao-guiada';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

describe('ApresentacaoGuiada', () => {
  it('goes through one box per tab and ends on «Começar»', () => {
    const onFim = jest.fn();
    render(<ApresentacaoGuiada onFim={onFim} />);
    expect(screen.getByText('1 de 5')).toBeOnTheScreen();
    expect(screen.getByText('Jogos')).toBeOnTheScreen();
    for (let passo = 0; passo < 4; passo += 1) fireEvent.press(screen.getByText('Seguinte'));
    expect(screen.getByText('5 de 5')).toBeOnTheScreen();
    expect(onFim).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Começar'));
    expect(onFim).toHaveBeenCalledTimes(1);
  });

  it('can be skipped at any step', () => {
    const onFim = jest.fn();
    render(<ApresentacaoGuiada onFim={onFim} />);
    fireEvent.press(screen.getByLabelText('Saltar a apresentação'));
    expect(onFim).toHaveBeenCalledTimes(1);
  });
});
