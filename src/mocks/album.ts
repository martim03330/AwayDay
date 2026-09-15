import { getDemoFixture } from '@/features/fixtures/store';
import type { FotoMissao } from '@/mocks/tipos';
import { visitasIniciais } from '@/mocks/visitas';

const MINUTO_MS = 60 * 1000;

function minutosDepois(iso: string | undefined, minutos: number) {
  const base = iso ? Date.parse(iso) : Date.now();
  return new Date(base + minutos * MINUTO_MS).toISOString();
}

const jogoNoDragao = getDemoFixture('porto-gil-vicente');
const visitaCampanha = visitasIniciais.find((visita) => visita.id === 'visita-bifanas-campanha');

/**
 * Recordações das duas missões que a demo já traz cumpridas.
 * Não há ficheiros de imagem nos mocks: aparecem ilustradas com as cores do clube da casa.
 */
export const fotosIniciais: FotoMissao[] = [
  {
    id: 'foto-cerveja-com-rival',
    missaoId: 'cerveja-com-rival',
    uri: null,
    tiradaEm: minutosDepois(visitaCampanha?.data, 25),
    jogoId: null,
    estadioId: 'dragao',
    verificada: true,
    exemplo: false,
  },
  {
    id: 'foto-tres-estadios',
    missaoId: 'tres-estadios',
    uri: null,
    tiradaEm: minutosDepois(jogoNoDragao?.inicio, -40),
    jogoId: jogoNoDragao?.id ?? null,
    estadioId: 'dragao',
    verificada: true,
    exemplo: false,
  },
];
