import type { Missao } from '@/mocks/tipos';

/**
 * Missões do passaporte. Regra: nenhuma envolve trocar objetos pessoais nem contacto físico.
 * Todas fecham com uma foto tirada na hora, que fica no álbum de recordações.
 */
export const missoes: Missao[] = [
  {
    id: 'tres-estadios',
    titulo: 'Visita 3 estádios diferentes',
    descricao: 'Contam todos os estádios do teu passaporte.',
    distintivo: { icon: 'estadio', nome: 'Turista de bancada' },
    meta: 3,
    progresso: 'estadios-visitados',
    dicaFoto: 'Um dos estádios, por fora ou da bancada.',
    fotoComOutraPessoa: false,
  },
  {
    id: 'cinco-tascos',
    titulo: 'Avalia 5 tascos',
    descricao: 'Dá nota na ficha de cada tasco. Sê justo, que o dono também vê a bola.',
    distintivo: { icon: 'tasco', nome: 'Crítico de tasco' },
    meta: 5,
    progresso: 'tascos-avaliados',
    dicaFoto: 'A mesa do quinto tasco, com o petisco à vista.',
    fotoComOutraPessoa: false,
  },
  {
    id: 'especialidade-da-casa',
    titulo: 'Prova a especialidade da casa',
    descricao: 'Recomenda a especialidade de um tasco depois de a provares.',
    distintivo: { icon: 'especialidade', nome: 'Paladar da casa' },
    meta: 1,
    progresso: 'especialidade-recomendada',
    dicaFoto: 'A especialidade, antes da primeira dentada.',
    fotoComOutraPessoa: false,
  },
  {
    id: 'jogo-a-chuva',
    titulo: 'Vai a um jogo à chuva',
    descricao: 'Avalia a visita a um jogo com chuva prevista.',
    distintivo: { icon: 'cobertura', nome: 'Impermeável de ouro' },
    meta: 1,
    progresso: 'jogo-a-chuva',
    dicaFoto: 'A bancada à chuva. O guarda-chuva pode aparecer.',
    fotoComOutraPessoa: false,
  },
  {
    id: 'cerveja-com-rival',
    titulo: 'Bebe uma cerveja no mesmo tasco que um adepto rival',
    descricao:
      'Faz check-in num tasco onde estejam adeptos de um clube rival. Cada um no seu copo.',
    distintivo: { icon: 'brinde', nome: 'Paz à mesa' },
    meta: 1,
    progresso: 'check-in-com-rivais',
    dicaFoto: 'O balcão ou a mesa, cada um com o seu copo. Se aparecer alguém, pede primeiro.',
    fotoComOutraPessoa: false,
  },
  {
    id: 'foto-com-rival',
    titulo: 'Tira uma foto com um adepto rival',
    descricao:
      'Pede primeiro. Cada um com a sua camisola, lado a lado e sem contacto. A foto é a prova.',
    distintivo: { icon: 'camara', nome: 'Selfie diplomática' },
    meta: 1,
    progresso: 'so-foto',
    dicaFoto: 'Tu e o adepto rival, cada um com a sua camisola, sem contacto.',
    fotoComOutraPessoa: true,
  },
  {
    id: 'foto-do-tasco',
    titulo: 'Fotografa o teu tasco',
    descricao:
      'Envia uma foto de um tasco na ficha dele. Quando for aprovada, ajuda quem vai escolher onde comer antes do jogo.',
    distintivo: { icon: 'tasco', nome: 'Repórter de tasco' },
    meta: 1,
    progresso: 'fotos-tasco-aprovadas',
    dicaFoto: 'A fachada ou o balcão do tasco, sem pessoas reconhecíveis em destaque.',
    fotoComOutraPessoa: false,
  },
];

export function obterMissao(id: string) {
  return missoes.find((missao) => missao.id === id);
}
