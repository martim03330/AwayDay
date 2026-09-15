import { describe, expect, it } from 'vitest';

import { filtrarPorTempoAPe, MAX_MINUTOS_A_PE, valeACaminhada } from '@/lib/locais';
import type { Local } from '@/mocks/tipos';

function local(id: string, minutos: number, extra: Partial<Local> = {}): Local {
  return {
    id,
    nome: id,
    tipo: 'tasca',
    estadioId: 'estadio',
    distanciaMetros: minutos * 80,
    minutosAPe: minutos,
    coordenadas: { latitude: 0, longitude: 0 },
    homeFanHeavy: false,
    clubesAqui: [],
    pratos: [],
    cervejometro: null,
    petiscometro: null,
    pessoasAqui: null,
    especialidade: null,
    horario: null,
    precoMedio: null,
    notas: [],
    confirmacao: 'sugerido',
    deAdepto: false,
    notaDeAdepto: null,
    rapidoEBarato: false,
    pontuacaoSugestao: 0,
    votos: { sim: 0, nao: 0 },
    referencia: null,
    wcNoTasco: { sim: 0, nao: 0 },
    foto: null,
    ...extra,
  };
}

describe('valeACaminhada', () => {
  it('keeps the far ones fans confirmed or suggested themselves', () => {
    const longe = valeACaminhada([
      local('perto', 10, { deAdepto: true }),
      local('automatico-longe', 30),
      local('confirmado-longe', 30, { confirmacao: 'confirmado' }),
      local('de-adepto-longe', 40, { deAdepto: true }),
    ]);
    expect(longe.map((item) => item.id)).toEqual(['confirmado-longe', 'de-adepto-longe']);
  });

  it('starts exactly where the normal list stops', () => {
    expect(valeACaminhada([local('limite', MAX_MINUTOS_A_PE, { deAdepto: true })])).toHaveLength(1);
    expect(filtrarPorTempoAPe([local('limite', MAX_MINUTOS_A_PE)]).perto).toHaveLength(0);
  });

  it('puts the nearest first', () => {
    const longe = valeACaminhada([
      local('mais-longe', 40, { deAdepto: true }),
      local('menos-longe', 25, { deAdepto: true }),
    ]);
    expect(longe.map((item) => item.id)).toEqual(['menos-longe', 'mais-longe']);
  });
});
