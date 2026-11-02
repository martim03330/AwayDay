import { describe, expect, it } from 'vitest';

import {
  mensagemDaGestao,
  mensagemDeRecusa,
  textoListaDeEspera,
  textoLugaresLivres,
} from '@/features/casas/mensagens';
import { ClubTripError, type ClubTripErrorReason } from '@/features/casas/types';

const RAZOES: ClubTripErrorReason[] = [
  'wrong_club',
  'bad_member_code',
  'bookings_closed',
  'member_code_required',
  'already_in_car',
  'already_on_club_trip',
  'vehicle_not_empty',
  'other',
];

describe('mensagemDeRecusa', () => {
  it('has a sentence for every reason, never the raw code, never «você»', () => {
    for (const reason of RAZOES) {
      for (const acao of ['inscrever', 'cancelar'] as const) {
        const texto = mensagemDeRecusa(new ClubTripError(reason), acao);
        expect(texto.length).toBeGreaterThan(10);
        expect(texto).not.toContain('_');
        expect(texto.toLowerCase()).not.toContain('você');
      }
    }
  });

  it('uses the fixed texts for the two transport conflicts', () => {
    expect(mensagemDeRecusa(new ClubTripError('already_in_car'), 'inscrever')).toBe(
      'Já tens lugar num carro para este jogo.'
    );
    expect(mensagemDeRecusa(new ClubTripError('already_on_club_trip'), 'inscrever')).toBe(
      'Já estás inscrito noutro transporte para este jogo.'
    );
  });

  it('cancelling after the deadline sends the fan to the Casa', () => {
    expect(mensagemDeRecusa(new ClubTripError('bookings_closed'), 'cancelar')).toContain('fala com a Casa');
  });

  it('anything that is not a ClubTripError reads as a generic retry', () => {
    expect(mensagemDeRecusa(new Error('rede'), 'inscrever')).toBe('Não deu para te inscrever. Tenta outra vez.');
    expect(mensagemDeRecusa(null, 'cancelar')).toBe('Não deu para cancelar. Tenta outra vez.');
  });
});

describe('textoListaDeEspera', () => {
  it('says the place when there is one', () => {
    expect(textoListaDeEspera(1)).toBe('Em lista de espera (1.º)');
    expect(textoListaDeEspera(12)).toBe('Em lista de espera (12.º)');
  });

  it('without a place (or a meaningless 0), only says it is waiting', () => {
    expect(textoListaDeEspera(null)).toBe('Em lista de espera');
    expect(textoListaDeEspera(0)).toBe('Em lista de espera');
  });
});

describe('textoLugaresLivres', () => {
  it('counts in Portuguese, and full is «Cheio»', () => {
    expect(textoLugaresLivres(3)).toBe('3 lugares livres');
    expect(textoLugaresLivres(1)).toBe('1 lugar livre');
    expect(textoLugaresLivres(0)).toBe('Cheio');
    expect(textoLugaresLivres(-2)).toBe('Cheio');
  });
});

describe('mensagemDaGestao', () => {
  it('says what went wrong for the managers’ refusals, in plain Portuguese', () => {
    expect(mensagemDaGestao(new ClubTripError('other', 'vehicle_full'))).toBe(
      'Esse transporte não tem lugar para todos os desta inscrição.'
    );
    expect(mensagemDaGestao(new ClubTripError('vehicle_not_empty'))).toBe(
      'Esse transporte ainda tem pessoas: muda-as primeiro para outro.'
    );
    expect(mensagemDaGestao(new ClubTripError('other', 'invite_expired'))).toBe(
      'Esse código já expirou. Pede um novo a quem gere a Casa.'
    );
    expect(mensagemDaGestao(new ClubTripError('other', 'name_taken'))).toBe(
      'Já há uma Casa com esse nome neste clube.'
    );
  });

  it('falls back to a generic sentence, never the raw code', () => {
    for (const erro of [new ClubTripError('other', 'something_new'), new Error('boom'), null]) {
      const texto = mensagemDaGestao(erro);
      expect(texto).toBe('Não deu. Tenta outra vez daqui a pouco.');
    }
  });
});
