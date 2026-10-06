import { fireEvent, render, screen } from '@testing-library/react-native';

import { ConsentimentoTermos } from '@/components/consentimento-termos';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('ConsentimentoTermos', () => {
  beforeEach(() => mockPush.mockClear());

  it('starts unticked and says it is a checkbox', () => {
    render(<ConsentimentoTermos aceite={false} onMudar={jest.fn()} />);
    const caixa = screen.getByRole('checkbox');
    expect(caixa).not.toBeChecked();
  });

  it('ticks and unticks', () => {
    const onMudar = jest.fn();
    const { rerender } = render(<ConsentimentoTermos aceite={false} onMudar={onMudar} />);
    fireEvent.press(screen.getByRole('checkbox'));
    expect(onMudar).toHaveBeenLastCalledWith(true);
    rerender(<ConsentimentoTermos aceite onMudar={onMudar} />);
    fireEvent.press(screen.getByRole('checkbox'));
    expect(onMudar).toHaveBeenLastCalledWith(false);
  });

  it('opens the terms and the privacy policy', () => {
    render(<ConsentimentoTermos aceite={false} onMudar={jest.fn()} />);
    fireEvent.press(screen.getByText('Ler os termos'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/legal/[documento]', params: { documento: 'termos' } });
    fireEvent.press(screen.getByText('Ler a política de privacidade'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/legal/[documento]',
      params: { documento: 'privacidade' },
    });
  });

  it('shows the error when someone tries without ticking', () => {
    render(<ConsentimentoTermos aceite={false} onMudar={jest.fn()} erro="Tens de aceitar." />);
    expect(screen.getByText('Tens de aceitar.')).toBeOnTheScreen();
  });
});
