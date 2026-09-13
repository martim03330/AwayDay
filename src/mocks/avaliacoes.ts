import { dataEmLisboa } from '@/lib/datas';
import type { Avaliacao } from '@/mocks/tipos';

/** Avaliações de exemplo, para o histórico do perfil ter conteúdo desde o arranque. */
export const avaliacoesIniciais: Avaliacao[] = [
  {
    jogoId: 'benfica-arouca',
    estadio: 4,
    ambiente: 5,
    acessos: 3,
    comentario: 'Ambiente incrível na segunda parte. A saída pelo metro demorou 40 minutos.',
    criadaEm: dataEmLisboa(-2, '23:15').toISOString(),
  },
  {
    jogoId: 'porto-gil-vicente',
    estadio: 5,
    ambiente: 4,
    acessos: 4,
    comentario: 'Choveu o jogo todo, mas a bancada é toda coberta.',
    criadaEm: dataEmLisboa(-1, '20:40').toISOString(),
  },
];
