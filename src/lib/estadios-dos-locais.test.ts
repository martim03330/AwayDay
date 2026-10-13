import { describe, expect, it, vi } from 'vitest';

vi.mock('@/mocks/estadios', () => ({ estadiosNacionais: [] }));
vi.mock('@/mocks/locais', () => ({ locaisDoEstadio: () => [] }));

const { ordenarParaEscolha } = await import('@/lib/estadios-dos-locais');

const estadios = [
  { id: 'dragao', clubeId: 'porto' },
  { id: 'luz', clubeId: 'benfica' },
  { id: 'alvalade', clubeId: 'sporting' },
  { id: 'braga', clubeId: 'braga' },
  { id: 'bessa', clubeId: 'boavista' },
];
const comTascos = new Set(['dragao', 'alvalade', 'luz']);
const temLocais = (id: string) => comTascos.has(id);
const ids = (lista: { id: string }[]) => lista.map((estadio) => estadio.id);

describe('ordenarParaEscolha', () => {
  it('puts the fan\'s club first, then stadiums with tascos, then the rest', () => {
    const { meus, outros } = ordenarParaEscolha(estadios, ['braga'], temLocais);
    expect(ids(meus)).toEqual(['braga']);
    expect(ids(outros)).toEqual(['dragao', 'luz', 'alvalade', 'bessa']);
  });

  it('keeps the fan\'s clubs in their own order and never repeats a stadium', () => {
    const { meus, outros } = ordenarParaEscolha(estadios, ['sporting', 'porto'], temLocais);
    expect(ids(meus)).toEqual(['alvalade', 'dragao']);
    expect(ids(outros)).toEqual(['luz', 'braga', 'bessa']);
  });

  it('without a club, nothing is «yours»', () => {
    const { meus, outros } = ordenarParaEscolha(estadios, [], temLocais);
    expect(meus).toEqual([]);
    expect(outros).toHaveLength(5);
  });

  it('a club without a stadium in the list is ignored', () => {
    expect(ordenarParaEscolha(estadios, ['estrela'], temLocais).meus).toEqual([]);
  });
});
