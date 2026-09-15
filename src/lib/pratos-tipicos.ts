import type { TipoLocal } from '@/mocks/tipos';

/**
 * What a place of this kind usually serves in each country: a hint for fans who do not know the place (or the country)
 * when nobody has added a dish from its menu yet. General knowledge, never the place's own menu, and shown as such
 * ("Costuma haver"). Countries use the names in the venue table.
 */

type Tipicos = { cafe: readonly string[]; bar: readonly string[]; comida: readonly string[] };

const POR_PAIS: Readonly<Record<string, Tipicos>> = {
  Portugal: {
    cafe: ['Tosta mista', 'Bifana'],
    bar: ['Bifana', 'Prego no pão'],
    comida: ['Bifana', 'Prego no pão'],
  },
  Inglaterra: {
    cafe: ['Sandes de bacon', 'Tosta de queijo'],
    bar: ['Fish and chips', 'Tarte de carne (pie)'],
    comida: ['Fish and chips', 'Hambúrguer'],
  },
  Escócia: {
    cafe: ['Sandes de bacon', 'Tosta de queijo'],
    bar: ['Fish and chips', 'Tarte de carne (pie)'],
    comida: ['Fish and chips', 'Hambúrguer'],
  },
  Espanha: {
    cafe: ['Bocadillo (sandes)', 'Tortilha'],
    bar: ['Bocadillo (sandes)', 'Tapas de tortilha'],
    comida: ['Bocadillo (sandes)', 'Menú del día'],
  },
  Itália: {
    cafe: ['Panino (sandes)', 'Tramezzino (sandes)'],
    bar: ['Panino (sandes)', 'Fatia de pizza'],
    comida: ['Pizza margherita', 'Panino (sandes)'],
  },
  França: {
    cafe: ['Croque-monsieur (tosta mista)', 'Sandes de fiambre'],
    bar: ['Croque-monsieur (tosta mista)', 'Sandes de fiambre'],
    comida: ['Croque-monsieur (tosta mista)', 'Hambúrguer'],
  },
  'Países Baixos': {
    cafe: ['Tosti (tosta mista)', 'Broodje kroket (sandes de croquete)'],
    bar: ['Bitterballen (croquetes)', 'Tosti (tosta mista)'],
    comida: ['Batatas fritas', 'Frikandel (salsicha)'],
  },
  Áustria: {
    cafe: ['Sandes de Leberkäse', 'Tosta mista'],
    bar: ['Salsicha com pão', 'Sandes de Leberkäse'],
    comida: ['Salsicha com pão', 'Schnitzel'],
  },
  Noruega: {
    cafe: ['Sandes aberta', 'Waffle'],
    bar: ['Cachorro-quente (pølse)', 'Hambúrguer'],
    comida: ['Cachorro-quente (pølse)', 'Hambúrguer'],
  },
  Dinamarca: {
    cafe: ['Smørrebrød (sandes aberta)', 'Pastel de massa folhada'],
    bar: ['Cachorro-quente (pølse)', 'Hambúrguer'],
    comida: ['Cachorro-quente (pølse)', 'Smørrebrød (sandes aberta)'],
  },
  Hungria: {
    cafe: ['Lángos (pão frito)', 'Sandes'],
    bar: ['Lángos (pão frito)', 'Salsicha com pão'],
    comida: ['Lángos (pão frito)', 'Sopa goulash'],
  },
  Chéquia: {
    cafe: ['Sandes', 'Pastel (koláč)'],
    bar: ['Salsicha com pão (klobása)', 'Queijo frito'],
    comida: ['Salsicha com pão (klobása)', 'Sopa goulash'],
  },
  Polónia: {
    cafe: ['Zapiekanka (tosta aberta)', 'Pastel'],
    bar: ['Zapiekanka (tosta aberta)', 'Salsicha grelhada'],
    comida: ['Pierogi (pastéis cozidos)', 'Zapiekanka (tosta aberta)'],
  },
  Chipre: {
    cafe: ['Tosta de halloumi', 'Sandes'],
    bar: ['Souvlaki no pão', 'Tosta de halloumi'],
    comida: ['Souvlaki no pão', 'Gyros no pão'],
  },
};

const GENERICOS: Tipicos = {
  cafe: ['Sandes', 'Tosta mista'],
  bar: ['Sandes', 'Hambúrguer'],
  comida: ['Hambúrguer', 'Sandes'],
};

function grupoDoTipo(tipo: TipoLocal): keyof Tipicos {
  if (tipo === 'cafe') return 'cafe';
  if (tipo === 'bar' || tipo === 'cervejaria') return 'bar';
  return 'comida';
}

/** Up to two quick, cheap things this kind of place usually has in that country. */
export function pratosTipicos(pais: string, tipo: TipoLocal): readonly string[] {
  // Portuguese places keep their own classics.
  if (pais === 'Portugal') {
    if (tipo === 'churrasqueira') return ['Frango assado', 'Bifana'];
    if (tipo === 'roulotte') return ['Bifana', 'Cachorro-quente'];
    if (tipo === 'tasca') return ['Bifana', 'Pica-pau'];
  }
  return (POR_PAIS[pais] ?? GENERICOS)[grupoDoTipo(tipo)];
}
