import type { Coordenadas, Regiao } from '@/mocks/tipos';

/** Localização simulada do utilizador; a demo não usa o GPS. */
export const localizacaoUtilizador: { descricao: string; regiao: Regiao; coordenadas: Coordenadas } = {
  descricao: 'Marquês de Pombal, Lisboa',
  regiao: 'continente',
  coordenadas: { latitude: 38.7253, longitude: -9.15 },
};
