/**
 * O acerto das contas da viagem: quem paga a quem, no fim.
 *
 * Duas coisas vivem aqui, ambas só com aritmética de inteiros (cêntimos, como manda a casa):
 *
 * 1. `dividirCentimos` — a divisão de uma despesa pelas pessoas que entram nela. É por igual; quando não dá certo,
 *    os cêntimos que sobram vão um a um para os primeiros por ordem do identificador. É exatamente a mesma regra
 *    que o servidor aplica em `trip_balances`, para o que a app mostra antes de gravar ser o que fica gravado.
 * 2. `acertarContas` — a lista de transferências que fecha os saldos.
 *
 * Sobre o «menor número de transferências»: encontrar o mínimo absoluto é um problema sem solução rápida conhecida
 * (é preciso descobrir todos os grupos de pessoas cujos saldos se anulam entre si). O que fazemos é o que resolve os
 * casos reais de uma viagem: primeiro fecham-se os pares que se anulam exatamente — duas pessoas, uma transferência
 * — e só depois se vai ao maior devedor com o maior credor. Nunca sai daqui mais do que uma transferência por
 * pessoa menos uma, e em quase todas as viagens sai o mínimo mesmo.
 */

export type SaldoDeViagem = {
  profileId: string;
  nome: string;
  /** Positivo: pôs mais dinheiro do que lhe cabia. Negativo: deve. */
  saldoCentimos: number;
};

export type Transferencia = {
  deId: string;
  deNome: string;
  paraId: string;
  paraNome: string;
  centimos: number;
};

function exigirCentimos(valor: number) {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`Esperava um número inteiro de cêntimos e recebi ${valor}.`);
  }
  return valor;
}

/**
 * The order the server uses for the leftover cents: `row_number() over (partition by expense order by profile_id)`
 * in `trip_balances`, where `profile_id` is a uuid. Postgres compares uuids byte by byte, which for the canonical
 * text form is the same as comparing the lowercase hex strings character by character.
 */
function compararIds(a: string, b: string) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Quanto cabe a cada pessoa numa despesa. Devolve uma parte por pessoa distinta, pela ordem em que cada uma aparece
 * pela primeira vez (alguém repetido na lista entra uma vez só, como no servidor), e a soma das partes é sempre
 * exatamente o total: ninguém paga um cêntimo a mais por acaso, nem falta um no fim.
 */
export function dividirCentimos(totalCentimos: number, participantes: string[]): number[] {
  exigirCentimos(totalCentimos);
  if (totalCentimos < 0) throw new RangeError('Uma despesa não pode ser negativa.');

  // One share per person: the server keeps one trip_expense_share row per (expense, profile).
  const vistos = new Set<string>();
  const pessoas = participantes.filter((pessoa) => {
    const chave = pessoa.toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  if (pessoas.length === 0) throw new RangeError('Uma despesa tem de ter alguém a pagá-la.');

  const base = Math.floor(totalCentimos / pessoas.length);
  const resto = totalCentimos - base * pessoas.length;
  // Os cêntimos a mais seguem a ordem do identificador — a mesma que o servidor usa, e que não muda de dia para dia.
  const ordenados = [...pessoas].sort(compararIds);
  const comMais = new Set(ordenados.slice(0, resto));

  return pessoas.map((pessoa) => (comMais.has(pessoa) ? base + 1 : base));
}

/**
 * Quanto fica cada um a pagar numa despesa dividida por `quantos`: a parte de base e quantos pagam mais um
 * cêntimo. Serve para mostrar a divisão quando só se sabe quantas pessoas entraram, não quem.
 */
export function parteDeCada(totalCentimos: number, quantos: number) {
  exigirCentimos(totalCentimos);
  if (totalCentimos < 0) throw new RangeError('Uma despesa não pode ser negativa.');
  if (!Number.isSafeInteger(quantos) || quantos < 1) {
    throw new RangeError('Uma despesa tem de ter alguém a pagá-la.');
  }
  const base = Math.floor(totalCentimos / quantos);
  return { base, comMaisUmCentimo: totalCentimos - base * quantos };
}

/**
 * Quem paga a quem. Os saldos têm de somar zero — é o que acontece quando vêm do servidor, onde cada despesa é
 * dividida por inteiro. Pessoas com saldo zero não aparecem em lado nenhum. A mesma pessoa repetida na lista conta
 * uma vez só, com a soma dos seus saldos (e o primeiro nome que aparecer), para nunca ninguém pagar a si próprio.
 */
export function acertarContas(saldosRecebidos: SaldoDeViagem[]): Transferencia[] {
  const porPessoa = new Map<string, SaldoDeViagem>();
  // BigInt only for the check: balances near the safe-integer limit must not overflow while adding up.
  let total = BigInt(0);
  for (const pessoa of saldosRecebidos) {
    total += BigInt(exigirCentimos(pessoa.saldoCentimos));
    const chave = pessoa.profileId.toLowerCase();
    const antes = porPessoa.get(chave);
    porPessoa.set(
      chave,
      antes
        ? { ...antes, saldoCentimos: exigirCentimos(antes.saldoCentimos + pessoa.saldoCentimos) }
        : { ...pessoa }
    );
  }
  if (total !== BigInt(0)) {
    throw new RangeError(`Os saldos têm de somar zero e somam ${total}.`);
  }
  const saldos = [...porPessoa.values()];

  // Ordem fixa: maiores primeiro, e o identificador desempata. Sem isto, a mesma viagem dava listas diferentes.
  const ordem = (a: SaldoDeViagem, b: SaldoDeViagem) =>
    Math.abs(b.saldoCentimos) - Math.abs(a.saldoCentimos) || compararIds(a.profileId, b.profileId);

  const devem = saldos
    .filter((p) => p.saldoCentimos < 0)
    .sort(ordem);
  const receber = saldos
    .filter((p) => p.saldoCentimos > 0)
    .sort(ordem);

  const transferencias: Transferencia[] = [];
  const pagar = (quem: SaldoDeViagem, aQuem: SaldoDeViagem, centimos: number) => {
    transferencias.push({
      deId: quem.profileId,
      deNome: quem.nome,
      paraId: aQuem.profileId,
      paraNome: aQuem.nome,
      centimos,
    });
    quem.saldoCentimos += centimos;
    aQuem.saldoCentimos -= centimos;
  };

  // 1. Os pares que se anulam: uma transferência fecha os dois, e nenhum deles volta a aparecer.
  for (const devedor of devem) {
    if (devedor.saldoCentimos === 0) continue;
    const certinho = receber.find((credor) => credor.saldoCentimos === -devedor.saldoCentimos);
    if (certinho) pagar(devedor, certinho, -devedor.saldoCentimos);
  }

  // 2. O resto: o maior devedor paga ao maior credor, e repete-se até estar tudo a zero.
  const porFechar = devem.filter((p) => p.saldoCentimos !== 0);
  const aReceber = receber.filter((p) => p.saldoCentimos !== 0);
  let i = 0;
  let j = 0;
  while (i < porFechar.length && j < aReceber.length) {
    const devedor = porFechar[i];
    const credor = aReceber[j];
    const quanto = Math.min(-devedor.saldoCentimos, credor.saldoCentimos);
    pagar(devedor, credor, quanto);
    if (devedor.saldoCentimos === 0) i += 1;
    if (credor.saldoCentimos === 0) j += 1;
  }

  return transferencias;
}

/** O que esta pessoa tem a fazer: pagar a alguém, receber de alguém, ou nada. */
export function meuAcerto(transferencias: Transferencia[], profileId: string) {
  return {
    aPagar: transferencias.filter((t) => t.deId === profileId),
    aReceber: transferencias.filter((t) => t.paraId === profileId),
  };
}
