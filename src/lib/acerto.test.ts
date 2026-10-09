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

describe('dividirCentimos com pessoas repetidas', () => {
  it('conta cada pessoa uma vez só, e a soma é sempre o total', () => {
    expect(dividirCentimos(1, ['a', 'a'])).toEqual([1]);
    expect(dividirCentimos(1001, ['b', 'a', 'b'])).toEqual([500, 501]);
    expect(soma(dividirCentimos(100, ['a', 'b', 'a', 'c', 'c']))).toBe(100);
  });

  it('trata o mesmo uuid em maiúsculas e minúsculas como a mesma pessoa', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(dividirCentimos(3, [id, id.toUpperCase()])).toEqual([3]);
  });

  it('uma pessoa sozinha fica com tudo', () => {
    expect(dividirCentimos(0, ['a'])).toEqual([0]);
    expect(dividirCentimos(999, ['a'])).toEqual([999]);
  });

  it('recusa NaN e infinito', () => {
    expect(() => dividirCentimos(Number.NaN, ['a'])).toThrow(RangeError);
    expect(() => dividirCentimos(Number.POSITIVE_INFINITY, ['a'])).toThrow(RangeError);
  });
});

describe('dividirCentimos na mesma ordem do servidor', () => {
  // trip_balances: row_number() over (partition by expense order by profile_id), profile_id uuid. Postgres compares
  // uuids byte a byte, which is the order of the lowercase hex text.
  const ids = [
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '0f8fad5b-d9cb-469f-a165-70867728950e',
    '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '9b2f3c1e-0000-4000-8000-000000000000',
  ];
  const ordemDoServidor = [
    '0f8fad5b-d9cb-469f-a165-70867728950e',
    '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    '9b2f3c1e-0000-4000-8000-000000000000',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  ];

  it('dá os cêntimos a mais aos primeiros uuids por ordem de bytes', () => {
    // 1003 / 5 = 200, sobram 3: vão para os três primeiros na ordem do servidor.
    const partes = dividirCentimos(1003, ids);
    const porId = new Map(ids.map((id, indice) => [id, partes[indice]]));
    expect(ordemDoServidor.map((id) => porId.get(id))).toEqual([201, 201, 201, 200, 200]);
  });

  it('não depende das maiúsculas: os dígitos vêm antes das letras, como nos bytes', () => {
    const partes = dividirCentimos(1, ['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11', '9b2f3c1e-0000-4000-8000-000000000000']);
    expect(partes).toEqual([0, 1]);
  });
});

describe('acertarContas, casos limite', () => {
  it('uma pessoa sozinha a zero não paga nada', () => {
    expect(acertarContas([pessoa('a', 'Ana', 0)])).toEqual([]);
  });

  it('uma lista vazia não tem nada para acertar', () => {
    expect(acertarContas([])).toEqual([]);
  });

  it('[1, 1, -2] fecha com duas transferências de um cêntimo', () => {
    expect(
      acertarContas([pessoa('a', 'Ana', 1), pessoa('b', 'Bruno', 1), pessoa('c', 'Carla', -2)])
    ).toEqual([
      { deId: 'c', deNome: 'Carla', paraId: 'a', paraNome: 'Ana', centimos: 1 },
      { deId: 'c', deNome: 'Carla', paraId: 'b', paraNome: 'Bruno', centimos: 1 },
    ]);
  });

  it('junta a mesma pessoa repetida e nunca a manda pagar a si própria', () => {
    const acerto = acertarContas([
      pessoa('a', 'Ana', 500),
      pessoa('a', 'Ana', -300),
      pessoa('b', 'Bruno', -200),
    ]);
    expect(acerto).toEqual([{ deId: 'b', deNome: 'Bruno', paraId: 'a', paraNome: 'Ana', centimos: 200 }]);
    expect(acertarContas([pessoa('a', 'Ana', 500), pessoa('a', 'Ana', -500)])).toEqual([]);
  });

  it('recusa saldos que não são cêntimos inteiros', () => {
    expect(() => acertarContas([pessoa('a', 'Ana', 0.5), pessoa('b', 'Bruno', -0.5)])).toThrow(RangeError);
    expect(() => acertarContas([pessoa('a', 'Ana', Number.NaN), pessoa('b', 'Bruno', 0)])).toThrow(
      RangeError
    );
    expect(() =>
      acertarContas([pessoa('a', 'Ana', Number.POSITIVE_INFINITY), pessoa('b', 'Bruno', Number.NEGATIVE_INFINITY)])
    ).toThrow(RangeError);
  });

  it('aguenta saldos perto do maior inteiro seguro', () => {
    const max = Number.MAX_SAFE_INTEGER;
    expect(acertarContas([pessoa('a', 'Ana', max), pessoa('b', 'Bruno', -max)])).toEqual([
      { deId: 'b', deNome: 'Bruno', paraId: 'a', paraNome: 'Ana', centimos: max },
    ]);
    // Somas intermédias acima do limite não podem dar um falso zero nem uma conta errada.
    const acerto = acertarContas([
      pessoa('a', 'Ana', max),
      pessoa('b', 'Bruno', max - 1),
      pessoa('c', 'Carla', -max),
      pessoa('d', 'Duarte', -(max - 1)),
    ]);
    expect(acerto).toHaveLength(2);
    expect(() => acertarContas([pessoa('a', 'Ana', max), pessoa('b', 'Bruno', 1), pessoa('c', 'Carla', -max)])).toThrow(
      RangeError
    );
    // A mesma pessoa repetida cujo saldo junto passa o limite é recusada, não arredondada.
    expect(() =>
      acertarContas([pessoa('a', 'Ana', max), pessoa('a', 'Ana', max), pessoa('b', 'Bruno', -max), pessoa('c', 'Carla', -max)])
    ).toThrow(RangeError);
  });

  it('com 50 pessoas fecha sempre as contas, sem ninguém a pagar a si próprio', () => {
    let semente = 2026;
    const aleatorio = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente;
    };
    for (let viagem = 0; viagem < 100; viagem += 1) {
      const valores = Array.from({ length: 50 }, () => (aleatorio() % 200001) - 100000);
      valores[valores.length - 1] -= soma(valores);
      const saldos = valores.map((valor, indice) => pessoa(`p${String(indice).padStart(2, '0')}`, `P${indice}`, valor));

      const acerto = acertarContas(saldos);
      expect(acerto.length).toBeLessThanOrEqual(Math.max(saldos.filter((p) => p.saldoCentimos !== 0).length - 1, 0));
      const depois = new Map(saldos.map((p) => [p.profileId, p.saldoCentimos]));
      for (const t of acerto) {
        expect(t.deId).not.toBe(t.paraId);
        expect(t.centimos).toBeGreaterThan(0);
        expect(Number.isSafeInteger(t.centimos)).toBe(true);
        depois.set(t.deId, (depois.get(t.deId) ?? 0) + t.centimos);
        depois.set(t.paraId, (depois.get(t.paraId) ?? 0) - t.centimos);
      }
      for (const restante of depois.values()) expect(restante).toBe(0);
    }
  });

  it('não altera os saldos que recebe', () => {
    const saldos = [pessoa('a', 'Ana', 100), pessoa('b', 'Bruno', -100)];
    acertarContas(saldos);
    expect(saldos.map((p) => p.saldoCentimos)).toEqual([100, -100]);
  });
});
