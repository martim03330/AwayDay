import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CamadaConfetti, useConfetti } from '@/ui/confetti';
import { NumeroAnimado } from '@/ui/numero-animado';

describe('NumeroAnimado', () => {
  it('is read as one element with the final value, also after a change', () => {
    const { rerender } = render(<NumeroAnimado valor={1200} formatar={(n) => `${n} pts`} />);
    expect(screen.getByLabelText('1200 pts')).toBeOnTheScreen();
    rerender(<NumeroAnimado valor={1250} formatar={(n) => `${n} pts`} />);
    expect(screen.getByLabelText('1250 pts')).toBeOnTheScreen();
    expect(screen.queryByLabelText('1200 pts')).toBeNull();
  });

  it('an explicit label wins over the written number', () => {
    render(<NumeroAnimado valor={7} accessibilityLabel="Nível 7" />);
    expect(screen.getByLabelText('Nível 7')).toBeOnTheScreen();
  });
});

describe('confetti', () => {
  function Lancador() {
    const lancar = useConfetti();
    lancar(['#ff0000']);
    return <Text>pronto</Text>;
  }

  it('outside a layer, throwing confetti does nothing and never fails', () => {
    render(<Lancador />);
    expect(screen.getByText('pronto')).toBeOnTheScreen();
  });

  it('the layer shows its screen', () => {
    render(
      <CamadaConfetti>
        <Text>ecrã</Text>
      </CamadaConfetti>
    );
    expect(screen.getByText('ecrã')).toBeOnTheScreen();
  });
});
