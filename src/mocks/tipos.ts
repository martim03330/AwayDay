/** Classificação de 1 a 5, usada no cervejómetro, no petiscómetro e nas avaliações. */
export type Nota = 1 | 2 | 3 | 4 | 5;

export type Divisao = 1 | 2 | 3;

export type Clube = {
  id: string;
  nome: string;
  nomeCurto: string;
  /** Até 3 letras, desenhada no escudo. */
  sigla: string;
  cores: { primaria: string; secundaria: string };
  divisao: Divisao;
  estadioId: string;
};

export type Coordenadas = { latitude: number; longitude: number };

/** Madeira e Açores não têm ligação por estrada ao continente. */
export type Regiao = 'continente' | 'madeira' | 'acores';

export type ModoTransporte = 'metro' | 'autocarro' | 'comboio' | 'tvde' | 'a-pe' | 'carro';

export type OpcaoTransporte = {
  modo: ModoTransporte;
  descricao: string;
  minutos: number;
  /** Preço estimado por pessoa; 0 significa grátis. */
  precoEuros: number;
};

export type RoofCoverage = 'total' | 'parcial' | 'nenhuma';

export type Venue = {
  id: string;
  nome: string;
  cidade: string;
  capacidade: number;
  clubeId: string;
  regiao: Regiao;
  coordenadas: Coordenadas;
  /** Fotografia do estádio; `null` enquanto não houver fotos (a demo não usa rede). */
  photoUrl: string | null;
  roofCoverage: RoofCoverage;
  /** Há bancadas à sombra em jogos de dia. */
  hasShade: boolean;
  /** Há zonas cobertas para esperar fora do estádio, junto às portas. */
  hasShelter: boolean;
  transportes: [OpcaoTransporte, OpcaoTransporte, OpcaoTransporte];
};

export type Competicao = 'liga' | 'liga-2' | 'liga-3' | 'taca-de-portugal' | 'taca-da-liga';

export type CondicaoMeteorologica = 'sol' | 'limpo' | 'nublado' | 'aguaceiros' | 'chuva';

export type Meteorologia = {
  condicao: CondicaoMeteorologica;
  temperatura: number;
  probabilidadeChuva: number;
  ventoKmh: number;
};

export type Jogo = {
  id: string;
  competicao: Competicao;
  fase: string;
  casaId: string;
  foraId: string;
  estadioId: string;
  /** Data e hora de início em ISO 8601 (UTC). */
  inicio: string;
  meteorologia: Meteorologia;
};

export type TipoLocal = 'tasca' | 'cervejaria' | 'bar' | 'roulotte' | 'churrasqueira';

export type Local = {
  id: string;
  nome: string;
  tipo: TipoLocal;
  estadioId: string;
  distanciaMetros: number;
  /** Tempo a pé até ao estádio, já a contar com subidas e passadeiras. */
  minutosAPe: number;
  cervejometro: Nota;
  petiscometro: Nota;
  /** Pessoas presentes antes do teu check-in. */
  pessoasAqui: number;
  especialidade: string;
  horario: string;
  precoMedio: 1 | 2 | 3;
  notas: string[];
};

export type Avaliacao = {
  jogoId: string;
  estadio: Nota;
  ambiente: Nota;
  acessos: Nota;
  comentario: string;
  /** Data da última gravação em ISO 8601. */
  criadaEm: string;
};
