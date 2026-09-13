import type { Local, Prato, TipoLocal } from '@/mocks/tipos';

type PratoDoMenu = Pick<Prato, 'nome' | 'precoEuros' | 'minutosPreparacao' | 'temperatura'>;

/** Pratos típicos por tipo de local (mock). */
const menuPorTipo: Record<TipoLocal, PratoDoMenu[]> = {
  tasca: [
    { nome: 'Bifana no pão', precoEuros: 3, minutosPreparacao: 5, temperatura: 'quente' },
    { nome: 'Caldo verde', precoEuros: 2.5, minutosPreparacao: 3, temperatura: 'quente' },
    { nome: 'Pica-pau', precoEuros: 8.5, minutosPreparacao: 15, temperatura: 'quente' },
    { nome: 'Tremoços', precoEuros: 1, minutosPreparacao: 1, temperatura: 'fria' },
  ],
  cervejaria: [
    { nome: 'Prego no pão', precoEuros: 4.5, minutosPreparacao: 8, temperatura: 'quente' },
    { nome: 'Sopa do dia', precoEuros: 2.5, minutosPreparacao: 3, temperatura: 'quente' },
    { nome: 'Salada de polvo', precoEuros: 7.5, minutosPreparacao: 5, temperatura: 'fria' },
    { nome: 'Amendoins', precoEuros: 1.5, minutosPreparacao: 1, temperatura: 'fria' },
  ],
  bar: [
    { nome: 'Tosta mista', precoEuros: 3, minutosPreparacao: 6, temperatura: 'quente' },
    { nome: 'Batatas fritas', precoEuros: 2.5, minutosPreparacao: 7, temperatura: 'quente' },
    { nome: 'Tremoços', precoEuros: 1, minutosPreparacao: 1, temperatura: 'fria' },
  ],
  roulotte: [
    { nome: 'Bifana', precoEuros: 3, minutosPreparacao: 4, temperatura: 'quente' },
    { nome: 'Cachorro no pão', precoEuros: 3.5, minutosPreparacao: 5, temperatura: 'quente' },
    { nome: 'Caldo verde em copo', precoEuros: 2, minutosPreparacao: 2, temperatura: 'quente' },
    { nome: 'Farturas', precoEuros: 2, minutosPreparacao: 4, temperatura: 'quente' },
  ],
  churrasqueira: [
    { nome: 'Meio frango no churrasco', precoEuros: 7, minutosPreparacao: 12, temperatura: 'quente' },
    { nome: 'Batata frita', precoEuros: 2.5, minutosPreparacao: 6, temperatura: 'quente' },
    { nome: 'Caldo verde', precoEuros: 2.5, minutosPreparacao: 3, temperatura: 'quente' },
    { nome: 'Salada mista', precoEuros: 3, minutosPreparacao: 4, temperatura: 'fria' },
  ],
};

const PRECO_ESPECIALIDADE: Record<Local['precoMedio'], number> = { 1: 4, 2: 7, 3: 12 };
const ESPECIALIDADE_FRIA = /cerveja|imperial|fino|shots|marisco|tremo|salada/i;

function hash(texto: string) {
  let valor = 0;
  for (const caracter of texto) valor = (valor * 31 + caracter.charCodeAt(0)) >>> 0;
  return valor;
}

/** Menu mock de um local: a especialidade da casa mais os pratos típicos do seu tipo. */
export function gerarPratos(local: Pick<Local, 'id' | 'tipo' | 'especialidade' | 'precoMedio'>): Prato[] {
  const especialidade: Prato = {
    id: `${local.id}-especialidade`,
    nome: local.especialidade,
    precoEuros: PRECO_ESPECIALIDADE[local.precoMedio],
    minutosPreparacao: 10,
    temperatura: ESPECIALIDADE_FRIA.test(local.especialidade) ? 'fria' : 'quente',
    especialidade: true,
    recomendacoes: 40 + (hash(local.id) % 40),
  };

  const outros = menuPorTipo[local.tipo].map((prato, indice) => ({
    ...prato,
    id: `${local.id}-prato-${indice}`,
    especialidade: false,
    recomendacoes: 3 + (hash(`${local.id}-${indice}`) % 45),
  }));

  return [especialidade, ...outros];
}
