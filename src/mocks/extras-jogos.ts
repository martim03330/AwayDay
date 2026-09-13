import { pontoEncontroJuventusBenfica, pontoEncontroRomaPorto, pontoEncontroSalzburgoPorto } from '@/mocks/pontos-encontro';
import type { Jogo } from '@/mocks/tipos';

/**
 * Demo-only data for each fixture, joined by id with the catalogue from Supabase:
 * the weather is still simulated and the official meeting points still come from mocks.
 */
export const extrasJogos: Record<string, Pick<Jogo, 'meteorologia' | 'pontoEncontro'>> = {
  'benfica-famalicao': { meteorologia: { condicao: 'limpo', temperatura: 24, probabilidadeChuva: 0, ventoKmh: 11 }, pontoEncontro: null },
  'benfica-arouca': { meteorologia: { condicao: 'limpo', temperatura: 22, probabilidadeChuva: 5, ventoKmh: 10 }, pontoEncontro: null },
  'academica-varzim': { meteorologia: { condicao: 'sol', temperatura: 26, probabilidadeChuva: 0, ventoKmh: 8 }, pontoEncontro: null },
  'porto-gil-vicente': { meteorologia: { condicao: 'aguaceiros', temperatura: 19, probabilidadeChuva: 65, ventoKmh: 20 }, pontoEncontro: null },
  'estoril-casa-pia': { meteorologia: { condicao: 'sol', temperatura: 24, probabilidadeChuva: 5, ventoKmh: 14 }, pontoEncontro: null },
  'benfica-moreirense': { meteorologia: { condicao: 'limpo', temperatura: 21, probabilidadeChuva: 10, ventoKmh: 12 }, pontoEncontro: null },
  'belenenses-amora': { meteorologia: { condicao: 'nublado', temperatura: 21, probabilidadeChuva: 25, ventoKmh: 14 }, pontoEncontro: null },
  'maritimo-chaves': { meteorologia: { condicao: 'sol', temperatura: 25, probabilidadeChuva: 5, ventoKmh: 12 }, pontoEncontro: null },
  'arouca-gil-vicente': { meteorologia: { condicao: 'nublado', temperatura: 19, probabilidadeChuva: 30, ventoKmh: 10 }, pontoEncontro: null },
  'vitoria-rio-ave': { meteorologia: { condicao: 'aguaceiros', temperatura: 18, probabilidadeChuva: 60, ventoKmh: 18 }, pontoEncontro: null },
  'porto-braga': { meteorologia: { condicao: 'chuva', temperatura: 12, probabilidadeChuva: 85, ventoKmh: 25 }, pontoEncontro: null },
  'roma-porto': { meteorologia: { condicao: 'sol', temperatura: 25, probabilidadeChuva: 5, ventoKmh: 9 }, pontoEncontro: pontoEncontroRomaPorto },
  'leixoes-uniao-leiria': { meteorologia: { condicao: 'chuva', temperatura: 16, probabilidadeChuva: 80, ventoKmh: 28 }, pontoEncontro: null },
  'sporting-famalicao': { meteorologia: { condicao: 'limpo', temperatura: 27, probabilidadeChuva: 0, ventoKmh: 9 }, pontoEncontro: null },
  'academico-viseu-feirense': { meteorologia: { condicao: 'aguaceiros', temperatura: 15, probabilidadeChuva: 50, ventoKmh: 15 }, pontoEncontro: null },
  'tondela-nacional': { meteorologia: { condicao: 'nublado', temperatura: 16, probabilidadeChuva: 20, ventoKmh: 8 }, pontoEncontro: null },
  'sporting-arsenal': { meteorologia: { condicao: 'limpo', temperatura: 21, probabilidadeChuva: 5, ventoKmh: 10 }, pontoEncontro: null },
  'avs-estrela': { meteorologia: { condicao: 'aguaceiros', temperatura: 17, probabilidadeChuva: 55, ventoKmh: 16 }, pontoEncontro: null },
  'sp-covilha-caldas': { meteorologia: { condicao: 'chuva', temperatura: 12, probabilidadeChuva: 90, ventoKmh: 22 }, pontoEncontro: null },
  'juventus-benfica': { meteorologia: { condicao: 'nublado', temperatura: 18, probabilidadeChuva: 40, ventoKmh: 8 }, pontoEncontro: pontoEncontroJuventusBenfica },
  'amora-academica': { meteorologia: { condicao: 'nublado', temperatura: 20, probabilidadeChuva: 15, ventoKmh: 11 }, pontoEncontro: null },
  'braga-benfica': { meteorologia: { condicao: 'nublado', temperatura: 18, probabilidadeChuva: 35, ventoKmh: 15 }, pontoEncontro: null },
  'varzim-belenenses': { meteorologia: { condicao: 'aguaceiros', temperatura: 17, probabilidadeChuva: 45, ventoKmh: 24 }, pontoEncontro: null },
  'moreirense-vitoria': { meteorologia: { condicao: 'sol', temperatura: 23, probabilidadeChuva: 5, ventoKmh: 11 }, pontoEncontro: null },
  'casa-pia-sporting': { meteorologia: { condicao: 'limpo', temperatura: 20, probabilidadeChuva: 0, ventoKmh: 13 }, pontoEncontro: null },
  'famalicao-porto': { meteorologia: { condicao: 'chuva', temperatura: 15, probabilidadeChuva: 80, ventoKmh: 22 }, pontoEncontro: null },
  'salzburgo-porto': { meteorologia: { condicao: 'aguaceiros', temperatura: 13, probabilidadeChuva: 60, ventoKmh: 12 }, pontoEncontro: pontoEncontroSalzburgoPorto },
};
