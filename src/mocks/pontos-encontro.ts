import type { PontoEncontro } from '@/mocks/tipos';

/**
 * Pontos de encontro reais, publicados pelos clubes para jogos europeus já disputados.
 * Na demo são associados a jogos futuros; a fonte indica sempre o jogo original.
 */

export const pontoEncontroRomaPorto: PontoEncontro = {
  nome: 'Villa Borghese',
  morada: 'Junto à Piazzale delle Canestre, Roma',
  horario: 'Concentração a partir das 15h00 (hora local). Jogo às 18h45 locais.',
  transporte:
    'Autocarros levam os adeptos diretamente para o estádio. No fim, autocarros até à zona da Piazza dei Cinquecento.',
  nota: 'Segue as orientações das autoridades italianas.',
  origem: 'clube',
  coordenadas: null,
  publicadoPor: 'FC Porto',
  fonte: {
    titulo: 'Notícia no site do FC Porto',
    url: 'https://www.fcporto.pt/pt/noticias/20250219-pt-informacoes-aos-adeptos-que-vao-a-roma-apoiar-o-fc-porto',
    publicadoEm: '19 fev 2025',
    jogoOriginal: 'AS Roma x FC Porto, Liga Europa, 20 fev 2025',
  },
};

export const pontoEncontroJuventusBenfica: PontoEncontro = {
  nome: 'Parco del Valentino',
  morada: 'No final da avenida Corso Vittorio Emanuele II, Turim',
  horario:
    'A partir das 14h00 (hora de Portugal Continental). Saída para o estádio às 17h30 (hora de Portugal Continental).',
  transporte:
    'Autocarros gratuitos no ponto de encontro. Alternativa: autocarro da linha 72 a partir de Bertola Cap, com paragem no Juventus Stadium.',
  nota: null,
  origem: 'clube',
  coordenadas: null,
  publicadoPor: 'SL Benfica',
  fonte: {
    titulo: 'Notícia no site do SL Benfica',
    url: 'https://www.slbenfica.pt/pt-pt/agora/noticias/2025/01/29/futebol-benfica-informacoes-adeptos-jogo-juventus-8-jornada-fase-de-liga-liga-dos-campeoes',
    publicadoEm: '29 jan 2025',
    jogoOriginal: 'Juventus x SL Benfica, Liga dos Campeões, 29 jan 2025',
  },
};

export const pontoEncontroSalzburgoPorto: PontoEncontro = {
  nome: 'Meeting point do FC Porto',
  morada: 'Rudolfskai 16, Salzburgo',
  horario: 'Concentração a partir das 12h00 (hora local). Autocarros para o estádio às 18h00.',
  transporte:
    'Autocarros gratuitos para adeptos do FC Porto; depois do jogo fazem a viagem de regresso à Rudolfskai 16.',
  nota: null,
  origem: 'clube',
  coordenadas: null,
  publicadoPor: 'FC Porto',
  fonte: {
    titulo: 'Notícia no site do FC Porto',
    url: 'https://www.fcporto.pt/pt/noticias/20250924-pt-informacoes-aos-adeptos-que-vao-a-salzburgo-apoiar-o-fc-porto',
    publicadoEm: '24 set 2025',
    jogoOriginal: 'FC Salzburg x FC Porto, Liga Europa, 25 set 2025',
  },
};
