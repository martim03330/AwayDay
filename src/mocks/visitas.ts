import { dataEmLisboa } from '@/lib/datas';
import type { VisitaLocal } from '@/mocks/tipos';

/** Tascos visitados de exemplo: três verificados por check-in e dois registados à mão. */
export const visitasIniciais: VisitaLocal[] = [
  {
    id: 'visita-bifanas-campanha',
    localId: 'bifanas-campanha',
    data: dataEmLisboa(-1, '16:50').toISOString(),
    verificado: true,
    origem: 'check-in',
  },
  {
    id: 'visita-cervejaria-azul-branco',
    localId: 'cervejaria-azul-branco',
    data: dataEmLisboa(-1, '21:05').toISOString(),
    verificado: false,
    origem: 'manual',
  },
  {
    id: 'visita-tasca-terceiro-anel',
    localId: 'tasca-terceiro-anel',
    data: dataEmLisboa(-2, '18:40').toISOString(),
    verificado: true,
    origem: 'check-in',
  },
  {
    id: 'visita-tasca-leao-velho',
    localId: 'tasca-leao-velho',
    data: dataEmLisboa(-9, '19:30').toISOString(),
    verificado: false,
    origem: 'manual',
  },
  {
    id: 'visita-roulotte-sr-ze',
    localId: 'roulotte-sr-ze',
    data: dataEmLisboa(-16, '19:15').toISOString(),
    verificado: true,
    origem: 'check-in',
  },
];
