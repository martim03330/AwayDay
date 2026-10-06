// Helpers for `Alert.alert` in screen tests: spy on it and press one of its buttons, as a person would.
import { act } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

export type EspiaDeAlerta = jest.SpyInstance<
  void,
  Parameters<typeof Alert.alert>
>;

/** Replaces `Alert.alert` with a spy that shows nothing. Restore with `jest.restoreAllMocks()`. */
export function espiarAlertas(): EspiaDeAlerta {
  return jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
}

/** The buttons of the alert shown on call `chamada` (the last one by default). */
export function botoesDoAlerta(espia: EspiaDeAlerta, chamada = -1): AlertButton[] {
  const chamadas = espia.mock.calls;
  const escolhida = chamadas[chamada < 0 ? chamadas.length + chamada : chamada];
  if (!escolhida) throw new Error('No alert was shown.');
  return escolhida[2] ?? [];
}

/** Presses the button with this text on the last alert. Fails the test when there is no such button. */
export function carregarNoAlerta(espia: EspiaDeAlerta, texto: string) {
  const botao = botoesDoAlerta(espia).find((candidato) => candidato.text === texto);
  if (!botao) throw new Error(`The last alert has no «${texto}» button.`);
  // Pressing usually updates the screen: inside act, as a real press would be.
  act(() => botao.onPress?.());
}
