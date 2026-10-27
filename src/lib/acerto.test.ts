import { describe, expect, it } from 'vitest';

import {
  acertarContas,
  dividirCentimos,
  meuAcerto,
  ordemDosCentimosQueSobram,
  parteDeCada,
  type SaldoDeViagem,
} from '@/lib/acerto';
import { md5 } from '@/lib/md5';

const soma = (valores: number[]) => valores.reduce((total, valor) => total + valor, 0);

// Ids as the server makes them (uuids), so the order of the leftover cents is the one Postgres would give.
const DESPESA = '3f1c2a9e-0000-4000-8000-0000000000a1';
const OUTRA_DESPESA = '7b2d4c10-0000-4000-8000-0000000000b2';
const RUI = 'e5000000-0000-4000-8000-000000000001';
const TIAGO = 'e5000000-0000-4000-8000-000000000002';
const ANA = 'e5000000-0000-4000-8000-000000000003';
const ZE = 'e5000000-0000-4000-8000-000000000004';
const OITO = Array.from({ length: 8 }, (_, i) => `e5000000-0000-4000-8000-00000000001${i}`);

describe('dividirCentimos', () => {
  it('divide certo quando dá certo', () => {
    expect(dividirCentimos(3000, [RUI, TIAGO, ANA], DESPESA)).toEqual([1000, 1000, 1000]);
  });

  it('dá os cêntimos que sobram pela ordem de md5(despesa || pessoa), como o servidor', () => {
    expect(ordemDosCentimosQueSobram(DESPESA, [ZE, ANA, TIAGO, RUI])).toEqual(
      [ZE, ANA, TIAGO, RUI].sort((a, b) => (md5(DESPESA + a) < md5(DESPESA + b) ? -1 : 1))
    );
    // 136,30 € a quatro: dois pagam 34,08 € e dois 34,07 €, os primeiros dessa ordem.
    const ordem = ordemDosCentimosQueSobram(DESPESA, [RUI, TIAGO, ANA, ZE]);
    const partes = dividirCentimos(13630, [RUI, TIAGO, ANA, ZE], DESPESA);
    const porPessoa = new Map([RUI, TIAGO, ANA, ZE].map((pessoa, i) => [pessoa, partes[i]]));
    expect(ordem.map((pessoa) => porPessoa.get(pessoa))).toEqual([3408, 3408, 3407, 3407]);
  });

  it('a ordem não depende da ordem da lista nem de maiúsculas', () => {
    const a = dividirCentimos(1001, [RUI, TIAGO, ANA], DESPESA);
    const b = dividirCentimos(1001, [ANA, RUI, TIAGO], DESPESA);
    expect(b).toEqual([a[2], a[0], a[1]]);
    expect(dividirCentimos(1001, [RUI.toUpperCase(), TIAGO, ANA], DESPESA.toUpperCase())).toEqual(a);
  });

  it('os cêntimos que sobram não calham sempre à mesma pessoa', () => {
    // 50 rodadas de 10,01 € a oito: um cêntimo a mais em cada. Com a ordem por id ia tudo para o mesmo.
    const extras = new Map<string, number>();
    for (let i = 0; i < 50; i += 1) {
      const despesa = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const partes = dividirCentimos(1001, OITO, despesa);
      partes.forEach((parte, j) => {
        if (parte === 126) extras.set(OITO[j], (extras.get(OITO[j]) ?? 0) + 1);
      });
      expect(partes.filter((parte) => parte === 126)).toHaveLength(1);
    }
    expect(extras.size).toBeGreaterThanOrEqual(5);
    expect(Math.max(...extras.values())).toBeLessThan(25);
  });

  it('despesas diferentes podem dar o cêntimo a pessoas diferentes', () => {
    const umaVez = dividirCentimos(1001, OITO, DESPESA).indexOf(126);
    const outraVez = dividirCentimos(1001, OITO, OUTRA_DESPESA).indexOf(126);
    expect(umaVez).not.toBe(-1);
    expect(outraVez).not.toBe(-1);
    // Fixed ids, so this is a fixed fact about them rather than luck.
    expect(umaVez).not.toBe(outraVez);
  });

  it('a mesma despesa dá sempre o mesmo resultado', () => {
    expect(dividirCentimos(13630, [RUI, TIAGO, ANA, ZE], DESPESA)).toEqual(
      dividirCentimos(13630, [RUI, TIAGO, ANA, ZE], DESPESA)
    );
  });

  it('a soma das partes é sempre o total, dê a divisão o que der', () => {
    for (let total = 0; total <= 400; total += 1) {
      for (let quantos = 1; quantos <= OITO.length; quantos += 1) {
        const partes = dividirCentimos(total, OITO.slice(0, quantos), DESPESA);
        expect(soma(partes)).toBe(total);
        expect(Math.max(...partes) - Math.min(...partes)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a diferença entre a maior e a menor parte nunca passa de um cêntimo', () => {
    const partes = dividirCentimos(1000, OITO.slice(0, 7), DESPESA);
    expect(Math.max(...partes) - Math.min(...partes)).toBe(1);
  });

  it('quem está repetido entra uma vez só', () => {
    expect(dividirCentimos(301, [RUI, RUI, TIAGO], DESPESA)).toHaveLength(2);
    expect(soma(dividirCentimos(301, [RUI, RUI, TIAGO], DESPESA))).toBe(301);
  });

  it('recusa despesas impossíveis', () => {
    expect(() => dividirCentimos(10.5, [RUI], DESPESA)).toThrow(RangeError);
    expect(() => dividirCentimos(-100, [RUI], DESPESA)).toThrow(RangeError);
    expect(() => dividirCentimos(100, [], DESPESA)).toThrow(RangeError);
  });
});

describe('parteDeCada', () => {
  it('diz a parte de base e quantos pagam mais um cêntimo', () => {
    expect(parteDeCada(3000, 3)).toEqual({ base: 1000, comMaisUmCentimo: 0 });
    expect(parteDeCada(1001, 2)).toEqual({ base: 500, comMaisUmCentimo: 1 });
    expect(parteDeCada(100, 3)).toEqual({ base: 33, comMaisUmCentimo: 1 });
  });

  it('diz o mesmo que a divisão pessoa a pessoa', () => {
    const gente = OITO.slice(0, 5);
    for (let total = 0; total <= 300; total += 1) {
      const partes = dividirCentimos(total, gente, DESPESA);
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
    expect(dividirCentimos(1, [RUI, RUI], DESPESA)).toEqual([1]);
    expect(dividirCentimos(1001, [TIAGO, RUI, TIAGO], DESPESA)).toHaveLength(2);
    expect(soma(dividirCentimos(1001, [TIAGO, RUI, TIAGO], DESPESA))).toBe(1001);
    expect(soma(dividirCentimos(100, [RUI, TIAGO, RUI, ANA, ANA], DESPESA))).toBe(100);
  });

  it('trata o mesmo uuid em maiúsculas e minúsculas como a mesma pessoa', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    expect(dividirCentimos(3, [id, id.toUpperCase()], DESPESA)).toEqual([3]);
  });

  it('uma pessoa sozinha fica com tudo', () => {
    expect(dividirCentimos(0, [RUI], DESPESA)).toEqual([0]);
    expect(dividirCentimos(999, [RUI], DESPESA)).toEqual([999]);
  });

  it('recusa NaN e infinito', () => {
    expect(() => dividirCentimos(Number.NaN, [RUI], DESPESA)).toThrow(RangeError);
    expect(() => dividirCentimos(Number.POSITIVE_INFINITY, [RUI], DESPESA)).toThrow(RangeError);
  });
});

describe('dividirCentimos na mesma ordem do servidor', () => {
  // trip_balances: row_number() over (partition by e.id order by md5(e.id::text || sh.profile_id::text) collate "C",
  // sh.profile_id). The expected order below is what Postgres gave for these ids on the project's database.
  const ids = [
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '0f8fad5b-d9cb-469f-a165-70867728950e',
    '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '9b2f3c1e-0000-4000-8000-000000000000',
  ];
  const ordemDoServidor = [
    '0f8fad5b-d9cb-469f-a165-70867728950e',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '9b2f3c1e-0000-4000-8000-000000000000',
    '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  ];

  it('ordena como o Postgres', () => {
    expect(ordemDosCentimosQueSobram(DESPESA, ids)).toEqual(ordemDoServidor);
  });

  it('dá os cêntimos a mais aos primeiros nessa ordem', () => {
    // 1003 / 5 = 200, sobram 3: vão para os três primeiros na ordem do servidor.
    const partes = dividirCentimos(1003, ids, DESPESA);
    const porId = new Map(ids.map((id, indice) => [id, partes[indice]]));
    expect(ordemDoServidor.map((id) => porId.get(id))).toEqual([201, 201, 201, 200, 200]);
  });

  it('não depende das maiúsculas, como o texto de um uuid no Postgres', () => {
    expect(ordemDosCentimosQueSobram(DESPESA.toUpperCase(), ids.map((id) => id.toUpperCase()))).toEqual(
      ordemDoServidor.map((id) => id.toUpperCase())
    );
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
