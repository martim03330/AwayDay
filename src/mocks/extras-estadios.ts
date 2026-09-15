import type { Venue } from '@/mocks/tipos';

/**
 * Demo-only data for each venue, joined by id with the catalogue from Supabase:
 * shade, shelter and transport options are illustrative and there are no photos yet.
 */
export const extrasEstadios: Record<string, Pick<Venue, 'photoUrl' | 'hasShade' | 'hasShelter' | 'transportes'>> = {
  'luz': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'metro', descricao: 'Linha Azul até Colégio Militar/Luz', minutos: 25, precoEuros: 1.85 },
      { modo: 'autocarro', descricao: 'Carris até à paragem Estádio da Luz', minutos: 35, precoEuros: 2.1 },
      { modo: 'tvde', descricao: 'TVDE a partir do Marquês de Pombal', minutos: 15, precoEuros: 9.5 },
    ],
  },
  'dragao': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'metro', descricao: 'Metro do Porto até Estádio do Dragão', minutos: 20, precoEuros: 1.4 },
      { modo: 'comboio', descricao: 'CP até Campanhã e 10 min a pé', minutos: 25, precoEuros: 1.65 },
      { modo: 'tvde', descricao: 'TVDE a partir dos Aliados', minutos: 12, precoEuros: 8 },
    ],
  },
  'alvalade': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'metro', descricao: 'Linha Verde ou Amarela até Campo Grande', minutos: 20, precoEuros: 1.85 },
      { modo: 'autocarro', descricao: 'Carris até Campo Grande', minutos: 30, precoEuros: 2.1 },
      { modo: 'tvde', descricao: 'TVDE a partir da Baixa', minutos: 15, precoEuros: 9 },
    ],
  },
  'municipal-braga': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'autocarro', descricao: 'TUB até ao Estádio Municipal', minutos: 25, precoEuros: 1.7 },
      { modo: 'a-pe', descricao: 'Do centro, a subir o Monte Castro', minutos: 40, precoEuros: 0 },
      { modo: 'tvde', descricao: 'TVDE a partir da Avenida Central', minutos: 10, precoEuros: 6.5 },
    ],
  },
  'afonso-henriques': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'a-pe', descricao: 'A partir do Largo do Toural', minutos: 15, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Autocarro urbano até ao estádio', minutos: 15, precoEuros: 1.4 },
      { modo: 'tvde', descricao: 'TVDE a partir da estação', minutos: 8, precoEuros: 5 },
    ],
  },
  '22-de-junho': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'comboio', descricao: 'CP desde o Porto e 15 min a pé', minutos: 50, precoEuros: 3.25 },
      { modo: 'a-pe', descricao: 'A partir do centro da cidade', minutos: 15, precoEuros: 0 },
      { modo: 'tvde', descricao: 'TVDE a partir da estação', minutos: 8, precoEuros: 5 },
    ],
  },
  'cidade-de-barcelos': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: true,
    transportes: [
      { modo: 'comboio', descricao: 'CP desde o Porto até Barcelos', minutos: 60, precoEuros: 3.6 },
      { modo: 'autocarro', descricao: 'Autocarro urbano desde o centro', minutos: 15, precoEuros: 1.5 },
      { modo: 'tvde', descricao: 'TVDE a partir da estação', minutos: 10, precoEuros: 6 },
    ],
  },
  'comendador-almeida-freitas': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'carro', descricao: 'Desde Guimarães, com estacionamento perto', minutos: 20, precoEuros: 3 },
      { modo: 'autocarro', descricao: 'Autocarro desde Guimarães', minutos: 35, precoEuros: 2.5 },
      { modo: 'tvde', descricao: 'TVDE desde Guimarães', minutos: 20, precoEuros: 14 },
    ],
  },
  'arcos': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'metro', descricao: 'Linha B até Vila do Conde e 15 min a pé', minutos: 55, precoEuros: 2.6 },
      { modo: 'a-pe', descricao: 'A partir do centro histórico', minutos: 15, precoEuros: 0 },
      { modo: 'tvde', descricao: 'TVDE a partir do centro', minutos: 8, precoEuros: 6 },
    ],
  },
  'coimbra-da-mota': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'comboio', descricao: 'Linha de Cascais até Estoril e 20 min a pé', minutos: 45, precoEuros: 2.4 },
      { modo: 'autocarro', descricao: 'Autocarro desde a estação do Estoril', minutos: 20, precoEuros: 2 },
      { modo: 'tvde', descricao: 'TVDE a partir de Cascais', minutos: 12, precoEuros: 7 },
    ],
  },
  'rio-maior': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'carro', descricao: 'Desde Lisboa pela A15, com portagens', minutos: 60, precoEuros: 12 },
      { modo: 'autocarro', descricao: 'Expresso desde Lisboa', minutos: 80, precoEuros: 9.5 },
      { modo: 'a-pe', descricao: 'A partir do centro de Rio Maior', minutos: 15, precoEuros: 0 },
    ],
  },
  'municipal-arouca': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'carro', descricao: 'Desde o Porto pela A32', minutos: 60, precoEuros: 8 },
      { modo: 'autocarro', descricao: 'Autocarro desde o Porto', minutos: 90, precoEuros: 6.5 },
      { modo: 'a-pe', descricao: 'A partir do centro da vila', minutos: 10, precoEuros: 0 },
    ],
  },
  'sao-miguel': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: true,
    transportes: [
      { modo: 'a-pe', descricao: 'A partir das Portas da Cidade', minutos: 25, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Minibus urbano', minutos: 15, precoEuros: 1 },
      { modo: 'tvde', descricao: 'TVDE a partir do centro', minutos: 8, precoEuros: 5 },
    ],
  },
  'madeira': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'autocarro', descricao: 'Autocarro urbano até à Choupana', minutos: 35, precoEuros: 2 },
      { modo: 'tvde', descricao: 'TVDE a partir da Baixa do Funchal', minutos: 15, precoEuros: 8 },
      { modo: 'carro', descricao: 'Carro desde o centro, com estacionamento', minutos: 20, precoEuros: 2 },
    ],
  },
  'cd-aves': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'carro', descricao: 'Desde o Porto pela A3 e A7', minutos: 35, precoEuros: 5 },
      { modo: 'autocarro', descricao: 'Autocarro desde o Porto', minutos: 60, precoEuros: 4.5 },
      { modo: 'a-pe', descricao: 'A partir do centro da vila', minutos: 10, precoEuros: 0 },
    ],
  },
  'jose-gomes': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'metro', descricao: 'Linha Azul até Reboleira e 10 min a pé', minutos: 35, precoEuros: 1.85 },
      { modo: 'comboio', descricao: 'Linha de Sintra até Reboleira', minutos: 25, precoEuros: 1.85 },
      { modo: 'tvde', descricao: 'TVDE a partir de Lisboa', minutos: 20, precoEuros: 12 },
    ],
  },
  'complexo-alverca': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: true,
    transportes: [
      { modo: 'comboio', descricao: 'Linha da Azambuja até Alverca', minutos: 30, precoEuros: 2.3 },
      { modo: 'a-pe', descricao: 'A partir da estação de Alverca', minutos: 10, precoEuros: 0 },
      { modo: 'carro', descricao: 'Desde Lisboa pela A1', minutos: 25, precoEuros: 3.5 },
    ],
  },
  'joao-cardoso': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'carro', descricao: 'Desde Viseu pelo IP3', minutos: 25, precoEuros: 4 },
      { modo: 'autocarro', descricao: 'Autocarro desde Viseu', minutos: 40, precoEuros: 3.5 },
      { modo: 'a-pe', descricao: 'A partir do centro de Tondela', minutos: 10, precoEuros: 0 },
    ],
  },
  'estadio-maritimo': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'autocarro', descricao: 'Autocarro urbano até aos Barreiros', minutos: 20, precoEuros: 1.95 },
      { modo: 'tvde', descricao: 'TVDE a partir da Baixa do Funchal', minutos: 10, precoEuros: 6 },
      { modo: 'a-pe', descricao: 'A partir da zona do Lido', minutos: 25, precoEuros: 0 },
    ],
  },
  'municipal-chaves': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'a-pe', descricao: 'A partir do centro histórico', minutos: 15, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Autocarro urbano até ao estádio', minutos: 10, precoEuros: 1.2 },
      { modo: 'carro', descricao: 'Desde Vila Real pela A24', minutos: 45, precoEuros: 6 },
    ],
  },
  'estadio-do-mar': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'metro', descricao: 'Linha A até Estádio do Mar', minutos: 30, precoEuros: 1.4 },
      { modo: 'autocarro', descricao: 'Autocarro desde a Boavista', minutos: 35, precoEuros: 2.1 },
      { modo: 'tvde', descricao: 'TVDE desde o centro do Porto', minutos: 18, precoEuros: 10 },
    ],
  },
  'fontelo': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'a-pe', descricao: 'A partir do Rossio', minutos: 15, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Autocarro urbano até ao Fontelo', minutos: 10, precoEuros: 1.1 },
      { modo: 'tvde', descricao: 'TVDE a partir do centro', minutos: 6, precoEuros: 5 },
    ],
  },
  'magalhaes-pessoa': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'a-pe', descricao: 'A partir do centro de Leiria', minutos: 10, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Autocarro urbano até ao estádio', minutos: 10, precoEuros: 1.2 },
      { modo: 'comboio', descricao: 'Comboio até Leiria e 25 min a pé', minutos: 25, precoEuros: 1.5 },
    ],
  },
  'marcolino-de-castro': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: true,
    transportes: [
      { modo: 'a-pe', descricao: 'A partir do castelo', minutos: 15, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Autocarro urbano até ao estádio', minutos: 15, precoEuros: 1.5 },
      { modo: 'carro', descricao: 'Desde o Porto pela A1', minutos: 30, precoEuros: 4 },
    ],
  },
  'restelo': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'autocarro', descricao: 'Carris até ao Restelo', minutos: 30, precoEuros: 2.1 },
      { modo: 'comboio', descricao: 'Linha de Cascais até Belém e 20 min a pé', minutos: 35, precoEuros: 1.85 },
      { modo: 'tvde', descricao: 'TVDE a partir do Cais do Sodré', minutos: 15, precoEuros: 9 },
    ],
  },
  'cidade-de-coimbra': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'autocarro', descricao: 'Autocarro urbano até ao estádio', minutos: 15, precoEuros: 1.6 },
      { modo: 'a-pe', descricao: 'A partir da Praça da República', minutos: 20, precoEuros: 0 },
      { modo: 'tvde', descricao: 'TVDE a partir da Baixa', minutos: 8, precoEuros: 5.5 },
    ],
  },
  'estadio-varzim': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'metro', descricao: 'Linha B até Póvoa de Varzim e 15 min a pé', minutos: 60, precoEuros: 2.6 },
      { modo: 'a-pe', descricao: 'A partir da marginal', minutos: 15, precoEuros: 0 },
      { modo: 'tvde', descricao: 'TVDE a partir do centro', minutos: 8, precoEuros: 6 },
    ],
  },
  'santos-pinto': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: false,
    hasShelter: false,
    transportes: [
      { modo: 'a-pe', descricao: 'A partir do centro, sempre a descer', minutos: 20, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Autocarro urbano até ao estádio', minutos: 15, precoEuros: 1.2 },
      { modo: 'tvde', descricao: 'TVDE a partir do centro', minutos: 8, precoEuros: 6 },
    ],
  },
  'medideira': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'comboio', descricao: 'Fertagus até Fogueteiro e 20 min a pé', minutos: 45, precoEuros: 3.1 },
      { modo: 'autocarro', descricao: 'Carris Metropolitana desde Cacilhas', minutos: 25, precoEuros: 2 },
      { modo: 'carro', descricao: 'Desde Lisboa pela Ponte 25 de Abril', minutos: 25, precoEuros: 4 },
    ],
  },
  'campo-da-mata': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'autocarro', descricao: 'Expresso desde Lisboa', minutos: 75, precoEuros: 9 },
      { modo: 'a-pe', descricao: 'A partir da Praça da Fruta', minutos: 15, precoEuros: 0 },
      { modo: 'comboio', descricao: 'Linha do Oeste e 15 min a pé', minutos: 120, precoEuros: 9 },
    ],
  },
  'olimpico-roma': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: false,
    transportes: [
      { modo: 'autocarro', descricao: 'Autocarros para visitantes a partir de Villa Borghese', minutos: 25, precoEuros: 0 },
      { modo: 'metro', descricao: 'Linha A até Flaminio e elétrico 2', minutos: 35, precoEuros: 1.5 },
      { modo: 'tvde', descricao: 'Táxi a partir do centro', minutos: 20, precoEuros: 18 },
    ],
  },
  'allianz-stadium': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'autocarro', descricao: 'Autocarros grátis a partir do Parco del Valentino', minutos: 35, precoEuros: 0 },
      { modo: 'autocarro', descricao: 'Linha 72 a partir de Bertola Cap', minutos: 40, precoEuros: 1.9 },
      { modo: 'tvde', descricao: 'Táxi a partir do centro', minutos: 25, precoEuros: 22 },
    ],
  },
  'red-bull-arena': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'autocarro', descricao: 'Autocarros grátis a partir da Rudolfskai 16', minutos: 25, precoEuros: 0 },
      { modo: 'comboio', descricao: 'S-Bahn até Taxham Europark e 15 min a pé', minutos: 30, precoEuros: 2.6 },
      { modo: 'tvde', descricao: 'Táxi a partir do centro', minutos: 20, precoEuros: 25 },
    ],
  },
  'emirates': {
    photoUrl: null,
    fotoCredito: null,
    hasShade: true,
    hasShelter: true,
    transportes: [
      { modo: 'metro', descricao: 'Piccadilly Line até Arsenal', minutos: 25, precoEuros: 3.1 },
      { modo: 'comboio', descricao: 'Overground até Highbury & Islington', minutos: 30, precoEuros: 3.1 },
      { modo: 'tvde', descricao: 'Táxi a partir do centro', minutos: 30, precoEuros: 30 },
    ],
  },
};
