import type { useRouter } from 'expo-router';

import { avisarConviteRepetido } from '@/features/groups/convite-repetido';
import { botoesDoAlerta, carregarNoAlerta, espiarAlertas } from '../../../../jest/alertas';

type Router = ReturnType<typeof useRouter>;

function routerFalso() {
  const push = jest.fn();
  // Only `push` is used; the rest of the router never runs here.
  return { router: { push } as unknown as Router, push };
}

const GRUPO = { id: 'g-1', name: 'Os do Norte' };

describe('avisarConviteRepetido', () => {
  afterEach(() => jest.restoreAllMocks());

  it('says the game already has an invite in that group, with the group name', () => {
    const alerta = espiarAlertas();
    avisarConviteRepetido(routerFalso().router, GRUPO, 'plano-9');
    expect(alerta).toHaveBeenCalledWith(
      'Calma, que este jogo já está convocado',
      'A malta do «Os do Norte» já tem convite para este jogo. Dois convites para o mesmo jogo é como dois árbitros em campo: só dá confusão.',
      expect.any(Array)
    );
  });

  it('knowing the existing invite: «Deixa estar» (cancel) and «Ver o convite»', () => {
    const alerta = espiarAlertas();
    avisarConviteRepetido(routerFalso().router, GRUPO, 'plano-9');
    expect(botoesDoAlerta(alerta).map((botao) => [botao.text, botao.style])).toEqual([
      ['Deixa estar', 'cancel'],
      ['Ver o convite', undefined],
    ]);
  });

  it('«Ver o convite» closes what was open first, then opens the existing invite', () => {
    const alerta = espiarAlertas();
    const { router, push } = routerFalso();
    const ordem: string[] = [];
    const depoisDeAbrir = jest.fn(() => ordem.push('fechar'));
    push.mockImplementation(() => ordem.push('abrir'));
    avisarConviteRepetido(router, GRUPO, 'plano-9', depoisDeAbrir);
    carregarNoAlerta(alerta, 'Ver o convite');
    expect(push).toHaveBeenCalledWith({
      pathname: '/grupos/[grupoId]/plano/[planoId]',
      params: { grupoId: 'g-1', planoId: 'plano-9' },
    });
    expect(ordem).toEqual(['fechar', 'abrir']);
  });

  it('«Deixa estar» goes nowhere', () => {
    const alerta = espiarAlertas();
    const { router, push } = routerFalso();
    const depoisDeAbrir = jest.fn();
    avisarConviteRepetido(router, GRUPO, 'plano-9', depoisDeAbrir);
    carregarNoAlerta(alerta, 'Deixa estar');
    expect(push).not.toHaveBeenCalled();
    expect(depoisDeAbrir).not.toHaveBeenCalled();
  });

  it('not knowing which invite: only «Deixa estar»', () => {
    const alerta = espiarAlertas();
    avisarConviteRepetido(routerFalso().router, GRUPO, null);
    expect(botoesDoAlerta(alerta).map((botao) => botao.text)).toEqual(['Deixa estar']);
  });

  it('without a callback, «Ver o convite» still opens the invite', () => {
    const alerta = espiarAlertas();
    const { router, push } = routerFalso();
    avisarConviteRepetido(router, GRUPO, 'plano-9');
    carregarNoAlerta(alerta, 'Ver o convite');
    expect(push).toHaveBeenCalledTimes(1);
  });
});
