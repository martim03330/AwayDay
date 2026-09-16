import { describe, expect, it } from 'vitest';

import {
  acertarContas,
  dividirCentimos,
  meuAcerto,
  parteDeCada,
  type SaldoDeViagem,
} from '@/lib/acerto';

const soma = (valores: number[]) => valores.reduce((total, valor) => total + valor, 0);

describe('dividirCentimos', () => {
  it('divide certo quando dá certo', () => {
    expect(dividirCentimos(3000, ['a', 'b', 'c'])).toEqual([1000, 1000, 1000]);
  });

  it('dá os cêntimos que sobram aos primeiros por ordem do identificador', () => {
    expect(dividirCentimos(1001, ['b', 'c'])).toEqual([501, 500]);
    expect(dividirCentimos(1001, ['c', 'b'])).toEqual([500, 501]);
    expect(dividirCentimos(100, ['a', 'b', 'c'])).toEqual([34, 33, 33]);
  });

  it('a soma das partes é sempre o total, dê a divisão o que der', () => {
    const gente = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (let total = 0; total <= 400; total += 1) {
      for (let quantos = 1; quantos <= gente.length; quantos += 1) {
        expect(soma(dividirCentimos(total, gente.slice(0, quantos)))).toBe(total);
      }
    }
  });

  it('a diferença entre a maior e a menor parte nunca passa de um cêntimo', () => {
    const partes = dividirCentimos(1000, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(Math.max(...partes) - Math.min(...partes)).toBe(1);
  });

  it('recusa despesas impossíveis', () => {
    expect(() => dividirCentimos(10.5, ['a'])).toThrow(RangeError);
    expect(() => dividirCentimos(-100, ['a'])).toThrow(RangeError);
    expect(() => dividirCentimos(100, [])).toThrow(RangeError);
  });
});

describe('parteDeCada', () => {
  it('diz a parte de base e quantos pagam mais um cêntimo', () => {
    expect(parteDeCada(3000, 3)).toEqual({ base: 1000, comMaisUmCentimo: 0 });
    expect(parteDeCada(1001, 2)).toEqual({ base: 500, comMaisUmCentimo: 1 });
    expect(parteDeCada(100, 3)).toEqual({ base: 33, comMaisUmCentimo: 1 });
  });

  it('diz o mesmo que a divisão pessoa a pessoa', () => {
    const gente = ['a', 'b', 'c', 'd', 'e'];
    for (let total = 0; total <= 300; total += 1) {
      const partes = dividirCentimos(total, gente);
      const { base, comMaisUmCentimo } = parteDeCada(total, gente.length);
      expect(Math.min(...partes)).toBe(base);
      expect(partes.filter((parte) => parte === base + 1)).toHaveLength(comMaisUmCentimo);
    }
  });

  it('recusa uma despesa sem ninguém', () => {
    expect(() => parteDeCada(100, 0)).toThrow(RangeError);
  });
});

const pessoa = (profileId: string, nome: string, saldoCentimos: number): SaldoDeViagem => ({
  profileId,
  nome,
  saldoCentimos,
});

describe('acertarContas', () => {
  it('não manda pagar nada quando está tudo a zero', () => {
    expect(acertarContas([pessoa('a', 'Ana', 0), pessoa('b', 'Bruno', 0)])).toEqual([]);
  });

  it('fecha um par com uma transferência', () => {
    expect(acertarContas([pessoa('a', 'Ana', 1500), pessoa('b', 'Bruno', -1500)])).toEqual([
      { deId: 'b', deNome: 'Bruno', paraId: 'a', paraNome: 'Ana', centimos: 1500 },
    ]);
  });

  it('divide um devedor por dois credores', () => {
    const acerto = acertarContas([
      pessoa('a', 'Ana', 2000),
      pessoa('b', 'Bruno', 1000),
      pessoa('c', 'Carla', -3000),
    ]);
    expect(acerto).toEqual([
      { deId: 'c', deNome: 'Carla', paraId: 'a', paraNome: 'Ana', centimos: 2000 },
      { deId: 'c', deNome: 'Carla', paraId: 'b', paraNome: 'Bruno', centimos: 1000 },
    ]);
  });

  it('aproveita os pares que se anulam em vez de fazer toda a gente pagar ao maior credor', () => {
    const acerto = acertarContas([
      pessoa('a', 'Ana', 5000),
      pessoa('b', 'Bruno', 1000),
      pessoa('c', 'Carla', -5000),
      pessoa('d', 'Duarte', -1000),
    ]);
    expect(acerto).toHaveLength(2);
    expect(acerto).toContainEqual({
      deId: 'c',
      deNome: 'Carla',
      paraId: 'a',
      paraNome: 'Ana',
      centimos: 5000,
    });
    expect(acerto).toContainEqual({
      deId: 'd',
      deNome: 'Duarte',
      paraId: 'b',
      paraNome: 'Bruno',
      centimos: 1000,
    });
  });

  it('nunca pede mais transferências do que pessoas menos uma, e fecha sempre as contas', () => {
    // Uma viagem inventada de propósito com números feios, para ver se sobra algum cêntimo pelo caminho.
    const nomes = ['Ana', 'Bruno', 'Carla', 'Duarte', 'Eva', 'Filipe', 'Gonçalo'];
    let semente = 7;
    const aleatorio = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente;
    };
    for (let viagem = 0; viagem < 200; viagem += 1) {
      const quantos = 2 + (aleatorio() % (nomes.length - 1));
      const valores = Array.from({ length: quantos }, () => (aleatorio() % 20001) - 10000);
      valores[valores.length - 1] -= soma(valores);
      const saldos = valores.map((valor, indice) => pessoa(`p${indice}`, nomes[indice], valor));

      const acerto = acertarContas(saldos);
      expect(acerto.length).toBeLessThanOrEqual(
        saldos.filter((p) => p.saldoCentimos !== 0).length - 1 || 0
      );

      const depois = new Map(saldos.map((p) => [p.profileId, p.saldoCentimos]));
      for (const t of acerto) {
        expect(t.centimos).toBeGreaterThan(0);
        expect(Number.isSafeInteger(t.centimos)).toBe(true);
        depois.set(t.deId, (depois.get(t.deId) ?? 0) + t.centimos);
        depois.set(t.paraId, (depois.get(t.paraId) ?? 0) - t.centimos);
      }
      for (const restante of depois.values()) expect(restante).toBe(0);
    }
  });

  it('não muda de resposta entre duas contas iguais', () => {
    const saldos = [
      pessoa('a', 'Ana', 700),
      pessoa('b', 'Bruno', 700),
      pessoa('c', 'Carla', -1400),
    ];
    expect(acertarContas(saldos)).toEqual(acertarContas([...saldos].reverse()));
  });

  it('recusa contas que não somam zero', () => {
    expect(() => acertarContas([pessoa('a', 'Ana', 100), pessoa('b', 'Bruno', -50)])).toThrow(
      RangeError
    );
  });
});

describe('meuAcerto', () => {
  it('separa o que tenho a pagar do que tenho a receber', () => {
    const acerto = acertarContas([
      pessoa('a', 'Ana', 2000),
      pessoa('b', 'Bruno', -500),
      pessoa('c', 'Carla', -1500),
    ]);
    expect(meuAcerto(acerto, 'b').aPagar).toHaveLength(1);
    expect(meuAcerto(acerto, 'b').aReceber).toHaveLength(0);
    expect(meuAcerto(acerto, 'a').aReceber).toHaveLength(2);
  });
});
