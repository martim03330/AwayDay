import type { Missao } from '@/mocks/tipos';

/**
 * Missões do passaporte. Regra: nenhuma envolve trocar objetos pessoais nem contacto físico.
 */
export const missoes: Missao[] = [
  {
    id: 'tres-estadios',
    titulo: 'Visita 3 estádios diferentes',
    descricao: 'Contam todos os estádios do teu passaporte.',
    distintivo: { emoji: '🏟️', nome: 'Turista de bancada' },
    meta: 3,
    progresso: 'estadios-visitados',
  },
  {
    id: 'cinco-tascos',
    titulo: 'Avalia 5 tascos',
    descricao: 'Dá nota na ficha de cada tasco. Sê justo, que o dono também vê a bola.',
    distintivo: { emoji: '🍺', nome: 'Crítico de tasco' },
    meta: 5,
    progresso: 'tascos-avaliados',
  },
  {
    id: 'especialidade-da-casa',
    titulo: 'Prova a especialidade da casa',
    descricao: 'Recomenda a especialidade de um tasco depois de a provares.',
    distintivo: { emoji: '🍢', nome: 'Paladar da casa' },
    meta: 1,
    progresso: 'especialidade-recomendada',
  },
  {
    id: 'jogo-a-chuva',
    titulo: 'Vai a um jogo à chuva',
    descricao: 'Avalia a visita a um jogo com chuva prevista.',
    distintivo: { emoji: '☔', nome: 'Impermeável de ouro' },
    meta: 1,
    progresso: 'jogo-a-chuva',
  },
  {
    id: 'cerveja-com-rival',
    titulo: 'Bebe uma cerveja no mesmo tasco que um adepto rival',
    descricao: 'Faz check-in num tasco onde estejam adeptos de um clube rival. Cada um no seu copo.',
    distintivo: { emoji: '🍻', nome: 'Paz à mesa' },
    meta: 1,
    progresso: 'check-in-com-rivais',
  },
  {
    id: 'foto-com-rival',
    titulo: 'Tira uma foto com um adepto rival',
    descricao:
      'Pede primeiro, cada um com a sua camisola e sem contacto. Confirmas tu: não há verificação.',
    distintivo: { emoji: '📸', nome: 'Selfie diplomática' },
    meta: 1,
    progresso: 'confirmacao-manual',
  },
];
