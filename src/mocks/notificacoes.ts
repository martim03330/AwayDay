export type TipoNotificacao = 'alteracao-horario' | 'meteorologia' | 'movimento-grupo' | 'novo-carimbo';

export type DefinicaoNotificacao = {
  titulo: string;
  descricao: string;
  /** Exemplo de texto, só para mostrar como fica (nada é enviado). */
  exemplo: { titulo: string; corpo: string; quando: string };
};

export const TIPOS_NOTIFICACAO: readonly TipoNotificacao[] = [
  'alteracao-horario',
  'meteorologia',
  'movimento-grupo',
  'novo-carimbo',
];

export const definicoesNotificacao: Record<TipoNotificacao, DefinicaoNotificacao> = {
  'alteracao-horario': {
    titulo: 'Alteração de horário',
    descricao: 'Quando um jogo que segues muda de dia ou de hora.',
    exemplo: {
      titulo: '⏰ Mudança de horário',
      corpo: 'Benfica x Moreirense passou para as 21:15. Dá tempo para mais uma bifana.',
      quando: 'agora',
    },
  },
  meteorologia: {
    titulo: 'Aviso de meteorologia',
    descricao: '3 horas antes do jogo, se a previsão pedir impermeável.',
    exemplo: {
      titulo: '🌧️ Leva o impermeável',
      corpo: 'Há 80% de probabilidade de chuva no Estádio do Mar às 19:00 e a bancada só é coberta em parte.',
      quando: 'há 1 min',
    },
  },
  'movimento-grupo': {
    titulo: 'Movimento do grupo',
    descricao: 'Quando a malta do teu grupo arranca para o jogo ou chega ao tasco.',
    exemplo: {
      titulo: '👥 A malta já arrancou',
      corpo: 'O Zé e mais 3 fizeram check-in na Tasca das Antas. Só faltas tu.',
      quando: 'há 5 min',
    },
  },
  'novo-carimbo': {
    titulo: 'Novo carimbo',
    descricao: 'Quando registas um estádio novo no passaporte.',
    exemplo: {
      titulo: '🏟️ Carimbo novo!',
      corpo: 'Estádio Cidade de Coimbra no passaporte. Já vais em 5 de 30.',
      quando: 'ontem',
    },
  },
};

export const preferenciasIniciais: Record<TipoNotificacao, boolean> = {
  'alteracao-horario': true,
  meteorologia: true,
  'movimento-grupo': false,
  'novo-carimbo': true,
};
