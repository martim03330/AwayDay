import { getDemoFixture } from '@/features/fixtures/store';
import type { AvaliacaoVisita, Nota } from '@/mocks/tipos';

type AvaliacaoMock = {
  jogoId: string;
  estadio: Nota;
  ambiente: Nota;
  acessos: Nota;
  comentario: string;
};

const HORA_MS = 60 * 60 * 1000;

const avaliacoesMock: AvaliacaoMock[] = [
  {
    jogoId: 'benfica-famalicao',
    estadio: 5,
    ambiente: 4,
    acessos: 4,
    comentario: 'Casa cheia e bifana antes do jogo. Assim sim.',
  },
  {
    jogoId: 'benfica-arouca',
    estadio: 4,
    ambiente: 5,
    acessos: 3,
    comentario: 'Ambiente incrível na segunda parte. A saída pelo metro demorou 40 minutos.',
  },
  {
    jogoId: 'porto-gil-vicente',
    estadio: 5,
    ambiente: 4,
    acessos: 4,
    comentario: 'Choveu o jogo todo, mas a bancada é toda coberta.',
  },
];

/** Avaliações de exemplo: duas visitas à Luz e uma ao Dragão. */
export const avaliacoesIniciais: AvaliacaoVisita[] = avaliacoesMock.flatMap((mock) => {
  const jogo = getDemoFixture(mock.jogoId);
  if (!jogo) return [];
  return [
    {
      ...mock,
      id: `avaliacao-${mock.jogoId}`,
      estadioId: jogo.estadioId,
      dataVisita: jogo.inicio,
      atualizadaEm: new Date(Date.parse(jogo.inicio) + 3 * HORA_MS).toISOString(),
    },
  ];
});
