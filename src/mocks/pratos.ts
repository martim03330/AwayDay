import type { Local, Prato, TipoLocal } from '@/mocks/tipos';

type PratoDoMenu = Pick<Prato, 'nome' | 'precoCentimos' | 'minutosPreparacao' | 'temperatura'>;

/** Pratos típicos por tipo de local (mock). */
const menuPorTipo: Record<TipoLocal, PratoDoMenu[]> = {
  tasca: [
    { nome: 'Bifana no pão', precoCentimos: 300, minutosPreparacao: 5, temperatura: 'quente' },
    { nome: 'Caldo verde', precoCentimos: 250, minutosPreparacao: 3, temperatura: 'quente' },
    { nome: 'Pica-pau', precoCentimos: 850, minutosPreparacao: 15, temperatura: 'quente' },
    { nome: 'Tremoços', precoCentimos: 100, minutosPreparacao: 1, temperatura: 'fria' },
  ],
  cervejaria: [
    { nome: 'Prego no pão', precoCentimos: 450, minutosPreparacao: 8, temperatura: 'quente' },
    { nome: 'Sopa do dia', precoCentimos: 250, minutosPreparacao: 3, temperatura: 'quente' },
    { nome: 'Salada de polvo', precoCentimos: 750, minutosPreparacao: 5, temperatura: 'fria' },
    { nome: 'Amendoins', precoCentimos: 150, minutosPreparacao: 1, temperatura: 'fria' },
  ],
  bar: [
    { nome: 'Tosta mista', precoCentimos: 300, minutosPreparacao: 6, temperatura: 'quente' },
    { nome: 'Batatas fritas', precoCentimos: 250, minutosPreparacao: 7, temperatura: 'quente' },
    { nome: 'Tremoços', precoCentimos: 100, minutosPreparacao: 1, temperatura: 'fria' },
  ],
  roulotte: [
    { nome: 'Bifana', precoCentimos: 300, minutosPreparacao: 4, temperatura: 'quente' },
    { nome: 'Cachorro no pão', precoCentimos: 350, minutosPreparacao: 5, temperatura: 'quente' },
    { nome: 'Caldo verde em copo', precoCentimos: 200, minutosPreparacao: 2, temperatura: 'quente' },
    { nome: 'Farturas', precoCentimos: 200, minutosPreparacao: 4, temperatura: 'quente' },
  ],
  churrasqueira: [
    { nome: 'Meio frango no churrasco', precoCentimos: 700, minutosPreparacao: 12, temperatura: 'quente' },
    { nome: 'Batata frita', precoCentimos: 250, minutosPreparacao: 6, temperatura: 'quente' },
    { nome: 'Caldo verde', precoCentimos: 250, minutosPreparacao: 3, temperatura: 'quente' },
    { nome: 'Salada mista', precoCentimos: 300, minutosPreparacao: 4, temperatura: 'fria' },
  ],
  restaurante: [
    { nome: 'Prato do dia', precoCentimos: 950, minutosPreparacao: 15, temperatura: 'quente' },
    { nome: 'Sopa do dia', precoCentimos: 250, minutosPreparacao: 3, temperatura: 'quente' },
    { nome: 'Prego no prato', precoCentimos: 850, minutosPreparacao: 12, temperatura: 'quente' },
  ],
  cafe: [
    { nome: 'Bifana', precoCentimos: 300, minutosPreparacao: 5, temperatura: 'quente' },
    { nome: 'Tosta mista', precoCentimos: 300, minutosPreparacao: 6, temperatura: 'quente' },
    { nome: 'Pastel de nata', precoCentimos: 130, minutosPreparacao: 1, temperatura: 'fria' },
  ],
};

/** Specialty price by price level, in integer cents. */
const PRECO_ESPECIALIDADE: Record<NonNullable<Local['precoMedio']>, number> = { 1: 400, 2: 700, 3: 1200 };
const ESPECIALIDADE_FRIA = /cerveja|imperial|fino|shots|marisco|tremo|salada/i;

function hash(texto: string) {
  let valor = 0;
  for (const caracter of texto) valor = (valor * 31 + caracter.charCodeAt(0)) >>> 0;
  return valor;
}

/** Menu mock de um local: a especialidade da casa mais os pratos típicos do seu tipo. */
export function gerarPratos(local: Pick<Local, 'id' | 'tipo' | 'especialidade' | 'precoMedio'>): Prato[] {
  const nomeEspecialidade = local.especialidade;
  const especialidade: Prato[] = nomeEspecialidade
    ? [
        {
          id: `${local.id}-especialidade`,
          nome: nomeEspecialidade,
          precoCentimos: PRECO_ESPECIALIDADE[local.precoMedio ?? 1],
          minutosPreparacao: 10,
          temperatura: ESPECIALIDADE_FRIA.test(nomeEspecialidade) ? 'fria' : 'quente',
          especialidade: true,
          recomendacoes: 40 + (hash(local.id) % 40),
          moeda: 'EUR',
          fonte: null,
        },
      ]
    : [];

  const outros = menuPorTipo[local.tipo].map((prato, indice) => ({
    ...prato,
    id: `${local.id}-prato-${indice}`,
    especialidade: false,
    recomendacoes: 3 + (hash(`${local.id}-${indice}`) % 45),
    moeda: 'EUR',
    fonte: null,
  }));

  return [...especialidade, ...outros];
}
