import { describe, expect, it } from 'vitest';

import {
  compararCentimos,
  eCentimos,
  formatarCentimos,
  formatarPreco,
  lerPrecoEmCentimos,
  PRECO_MAXIMO_CENTIMOS,
  somarCentimos,
} from './money';

/** Intl uses a non-breaking space before "€"; compare with plain spaces. */
function comEspacosNormais(texto: string) {
  return texto.replace(/\s/g, ' ');
}

describe('lerPrecoEmCentimos', () => {
  it.each([
    ['3', 300],
    ['3,5', 350],
    ['3,50', 350],
    ['3.50', 350],
    ['0,05', 5],
    ['0,5', 50],
    ['0,07', 7],
    ['0,29', 29],
    ['1,15', 115],
    ['0', 0],
    ['03,20', 320],
    [' 2,10 ', 210],
    ['2,10 €', 210],
    ['2,10€', 210],
    ['9999,99', PRECO_MAXIMO_CENTIMOS],
  ])('lê "%s" como %i cêntimos', (texto, esperado) => {
    const centimos = lerPrecoEmCentimos(texto);
    expect(centimos).toBe(esperado);
    expect(Number.isInteger(centimos)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'abc',
    '-1',
    '-0,50',
    '3,505',
    '3,',
    ',50',
    '.50',
    '10000',
    '1.234,50',
    '1 234,50',
    '3,50,1',
    '1e3',
    'NaN',
    'Infinity',
    '€3,50',
  ])('recusa "%s"', (texto) => {
    expect(lerPrecoEmCentimos(texto)).toBeNull();
  });

  it('não sofre com os erros de vírgula flutuante de parseFloat', () => {
    // parseFloat('0,07'.replace(',', '.')) * 100 === 7.000000000000001
    for (let centimos = 0; centimos < 1000; centimos += 1) {
      const texto = `${Math.trunc(centimos / 100)},${String(centimos % 100).padStart(2, '0')}`;
      expect(lerPrecoEmCentimos(texto)).toBe(centimos);
    }
  });
});

describe('somarCentimos', () => {
  it('soma sem erros de vírgula flutuante (o equivalente a 0,10 € + 0,20 €)', () => {
    expect(somarCentimos(10, 20)).toBe(30);
  });

  it('a soma de nada é zero', () => {
    expect(somarCentimos()).toBe(0);
  });

  it('aceita valores negativos inteiros (descontos, acertos)', () => {
    expect(somarCentimos(500, -150)).toBe(350);
  });

  it('recusa valores que não são cêntimos inteiros', () => {
    expect(() => somarCentimos(350, 1.5)).toThrow(RangeError);
    expect(() => somarCentimos(Number.NaN)).toThrow(RangeError);
    expect(() => somarCentimos(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('recusa totais fora do intervalo de inteiros seguros', () => {
    expect(() => somarCentimos(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});

describe('formatarCentimos', () => {
  it.each([
    [350, '3,50 €'],
    [5, '0,05 €'],
    [1, '0,01 €'],
    [0, '0,00 €'],
    [100, '1,00 €'],
    [199, '1,99 €'],
  ])('formata %i cêntimos como "%s"', (centimos, esperado) => {
    expect(comEspacosNormais(formatarCentimos(centimos))).toBe(esperado);
  });

  it('volta exatamente ao mesmo valor ao ler o que formatou', () => {
    for (let centimos = 0; centimos <= 10_000; centimos += 7) {
      expect(lerPrecoEmCentimos(comEspacosNormais(formatarCentimos(centimos)))).toBe(centimos);
    }
  });

  it('recusa valores que não são cêntimos inteiros', () => {
    expect(() => formatarCentimos(3.5)).toThrow(RangeError);
  });
});

describe('formatarPreco', () => {
  it('em euros, igual a formatarCentimos', () => {
    for (const centimos of [0, 1, 5, 199, 350, 99_999]) {
      expect(formatarPreco(centimos, 'EUR')).toBe(formatarCentimos(centimos));
    }
  });

  it.each([
    [650, 'GBP', '6,50 £'],
    [4500, 'NOK', '45,00 NOK'],
    [12_900, 'CZK', '129,00 CZK'],
    [199_000, 'HUF', '1990,00 HUF'],
    [5, 'DKK', '0,05 DKK'],
  ])('formata %i unidades mínimas em %s como "%s"', (centimos, moeda, esperado) => {
    expect(comEspacosNormais(formatarPreco(centimos, moeda))).toBe(esperado);
  });

  it('recusa valores que não são unidades inteiras', () => {
    expect(() => formatarPreco(3.5, 'GBP')).toThrow(RangeError);
  });

  it('recusa códigos de moeda mal formados', () => {
    expect(() => formatarPreco(350, 'eur')).toThrow(RangeError);
    expect(() => formatarPreco(350, 'EURO')).toThrow(RangeError);
  });
});

describe('compararCentimos', () => {
  it('ordena do mais barato para o mais caro', () => {
    expect([850, 100, 250, 100].sort(compararCentimos)).toEqual([100, 100, 250, 850]);
  });

  it('dá zero para valores iguais', () => {
    expect(compararCentimos(350, 350)).toBe(0);
  });

  it('recusa valores que não são cêntimos inteiros', () => {
    expect(() => compararCentimos(3.5, 350)).toThrow(RangeError);
  });
});

describe('eCentimos', () => {
  it.each([0, 350, -150, Number.MAX_SAFE_INTEGER])('%s é um valor em cêntimos', (valor) => {
    expect(eCentimos(valor)).toBe(true);
  });

  it.each([3.5, Number.NaN, Number.POSITIVE_INFINITY, '350', null, undefined])(
    '%s não é um valor em cêntimos',
    (valor) => {
      expect(eCentimos(valor)).toBe(false);
    }
  );
});
