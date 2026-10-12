import { describe, expect, it } from 'vitest';

import { partesDoNumero } from '@/ui/numero-animado-partes';

const chaves = (texto: string) => partesDoNumero(texto).map((parte) => parte.chave);

describe('partesDoNumero', () => {
  it('a plain number: one piece per digit, keyed from the right', () => {
    expect(partesDoNumero('42')).toEqual([
      { chave: 'd1', texto: '4', digito: true },
      { chave: 'd0', texto: '2', digito: true },
    ]);
  });

  it('99 → 100 keeps the units and tens on the same keys, only adds the hundreds', () => {
    expect(chaves('99')).toEqual(['d1', 'd0']);
    expect(chaves('100')).toEqual(['d2', 'd1', 'd0']);
  });

  it('group separators (pt-PT narrow space) stay still and are not digits', () => {
    const partes = partesDoNumero('12 345 pts');
    expect(partes.map((parte) => parte.texto).join('')).toBe('12 345 pts');
    expect(partes.filter((parte) => parte.digito).map((parte) => parte.texto)).toEqual(['1', '2', '3', '4', '5']);
    expect(partes.find((parte) => parte.texto === ' ')).toEqual({ chave: 's3', texto: ' ', digito: false });
    expect(partes.at(-1)).toEqual({ chave: 'depois', texto: ' pts', digito: false });
  });

  it('a suffix keeps its key when it changes (singular → plural), so only the digit rolls', () => {
    expect(chaves('1 estádio')).toEqual(['d0', 'depois']);
    expect(chaves('2 estádios')).toEqual(['d0', 'depois']);
  });

  it('ordinals and prefixes', () => {
    expect(partesDoNumero('12.º')).toEqual([
      { chave: 'd1', texto: '1', digito: true },
      { chave: 'd0', texto: '2', digito: true },
      { chave: 'depois', texto: '.º', digito: false },
    ]);
    expect(chaves('Nível 7')).toEqual(['antes', 'd0']);
  });

  it('text without digits is one still piece; empty text has none', () => {
    expect(partesDoNumero('Nenhum')).toEqual([{ chave: 'texto', texto: 'Nenhum', digito: false }]);
    expect(partesDoNumero('')).toEqual([]);
  });

  it('the pieces always put the text back together', () => {
    for (const texto of ['0', '1 200 pts', '64 642', '3 lugares livres', '-5', '1,5 km']) {
      expect(partesDoNumero(texto).map((parte) => parte.texto).join('')).toBe(texto);
    }
  });
});
