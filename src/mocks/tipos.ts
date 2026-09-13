/** Classificação de 1 a 5, usada no cervejómetro, no petiscómetro e nas avaliações. */
export type Nota = 1 | 2 | 3 | 4 | 5;

export type Divisao = 1 | 2 | 3;

export type Clube = {
  id: string;
  nome: string;
  nomeCurto: string;
  /** Até 3 letras, desenhada no escudo. */
  sigla: string;
  pais: string;
  cores: { primaria: string; secundaria: string };
  /** `null` para clubes estrangeiros. */
  divisao: Divisao | null;
  /** Número de adeptos deste clube na app (valor mock). */
  adeptosNaApp: number;
  estadioId: string;
};

export type Coordenadas = { latitude: number; longitude: number };

/** Madeira, Açores e estádios estrangeiros não têm ligação por estrada a partir de Lisboa. */
export type Regiao = 'continente' | 'madeira' | 'acores' | 'estrangeiro';

export type ModoTransporte = 'metro' | 'autocarro' | 'comboio' | 'tvde' | 'a-pe' | 'carro';

export type OpcaoTransporte = {
  modo: ModoTransporte;
  descricao: string;
  minutos: number;
  /** Preço estimado por pessoa; 0 significa grátis. */
  precoEuros: number;
};

/** Último transporte público de regresso depois do jogo. */
export type UltimoTransporte = {
  modo: ModoTransporte;
  descricao: string;
  /** Hora de partida em Lisboa (HH:MM); se for antes do fim do jogo, é no dia seguinte. */
  hora: string;
};

export type RoofCoverage = 'total' | 'parcial' | 'nenhuma';

export type Venue = {
  id: string;
  nome: string;
  cidade: string;
  pais: string;
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

export type Competicao =
  | 'liga'
  | 'liga-2'
  | 'liga-3'
  | 'taca-de-portugal'
  | 'taca-da-liga'
  | 'champions'
  | 'liga-europa'
  | 'conference';

export type CondicaoMeteorologica = 'sol' | 'limpo' | 'nublado' | 'aguaceiros' | 'chuva';

export type Meteorologia = {
  condicao: CondicaoMeteorologica;
  temperatura: number;
  probabilidadeChuva: number;
  ventoKmh: number;
};

export type OrigemPontoEncontro = 'clube' | 'camara' | 'policia';

/** Ponto de encontro oficial para adeptos visitantes. */
export type PontoEncontro = {
  nome: string;
  morada: string;
  horario: string;
  transporte: string;
  nota: string | null;
  origem: OrigemPontoEncontro;
  publicadoPor: string;
  fonte: {
    titulo: string;
    url: string;
    publicadoEm: string;
    /** Jogo real para o qual a informação foi publicada. */
    jogoOriginal: string;
  };
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
  /** Só nos jogos europeus; `null` quando ninguém indicou um ponto de encontro. */
  pontoEncontro: PontoEncontro | null;
};

export type TipoLocal = 'tasca' | 'cervejaria' | 'bar' | 'roulotte' | 'churrasqueira';

export type Prato = {
  id: string;
  nome: string;
  precoEuros: number;
  minutosPreparacao: number;
  temperatura: 'quente' | 'fria';
  /** Especialidade da casa. */
  especialidade: boolean;
  /** Recomendações de outros utilizadores; não é o dono que declara. */
  recomendacoes: number;
};

export type TipoRestroom = 'publica' | 'tasco' | 'estadio';

export type AcessoRestroom = 'livre' | 'clientes' | 'bilhete';

export type HorarioRestroom =
  | { tipo: 'sempre' }
  /** Horas em Lisboa (HH:MM); se `fecha` for antes de `abre`, fecha depois da meia-noite. */
  | { tipo: 'intervalo'; abre: string; fecha: string }
  /** Só abre em dias de jogo, algumas horas antes, e fecha no fim do jogo. */
  | { tipo: 'dias-de-jogo'; abreHorasAntes: number };

export type Restroom = {
  id: string;
  nome: string;
  tipo: TipoRestroom;
  estadioId: string;
  /** Tasco a que pertence, quando `tipo` é 'tasco'. */
  localId: string | null;
  coordenadas: Coordenadas;
  gratuita: boolean;
  /** 0 quando é gratuita. */
  precoEuros: number;
  acessivel: boolean;
  acesso: AcessoRestroom;
  horario: HorarioRestroom;
  /** Nota curta com humor; a informação prática vem sempre antes. */
  nota: string;
};

export type ProgressoMissao =
  | 'estadios-visitados'
  | 'tascos-avaliados'
  | 'especialidade-recomendada'
  | 'jogo-a-chuva'
  | 'check-in-com-rivais'
  /** A própria foto é a missão (ex.: foto com um adepto rival). */
  | 'so-foto';

/** `por-comprovar`: o objetivo está cumprido, mas falta a foto que o prova. */
export type EstadoMissao = 'por-fazer' | 'em-curso' | 'por-comprovar' | 'concluida';

export type Missao = {
  id: string;
  titulo: string;
  descricao: string;
  distintivo: { emoji: string; nome: string };
  meta: number;
  progresso: ProgressoMissao;
  /** O que a foto de prova deve mostrar. */
  dicaFoto: string;
  /** Aparece outra pessoa na foto: pede-se autorização antes de abrir a câmara. */
  fotoComOutraPessoa: boolean;
};

/** Foto que prova uma missão; fica no álbum de recordações. */
export type FotoMissao = {
  id: string;
  missaoId: string;
  /** Ficheiro local tirado com a câmara; `null` nas recordações de exemplo (a demo não traz ficheiros). */
  uri: string | null;
  /** Hora da app quando a foto foi tirada, em ISO 8601. */
  tiradaEm: string;
  jogoId: string | null;
  estadioId: string | null;
  /** Tirada em dia de jogo, com check-in feito nesse dia perto do estádio. */
  verificada: boolean;
  /** Foto de exemplo usada num aparelho sem câmara: nunca conta como verificada. */
  exemplo: boolean;
};

/** Medição válida do barulhómetro. O som nunca é guardado, só o nível. */
export type MedicaoBarulho = {
  id: string;
  jogoId: string;
  estadioId: string;
  /** Hora da app, em ISO 8601. */
  medidaEm: string;
  /** Escala relativa de 0 a 100 (não são decibéis). */
  nivel: number;
};

/** Melhor medição de outro adepto no mesmo jogo (fictícia na demo). */
export type MedicaoAdepto = {
  id: string;
  nome: string;
  lado: 'casa' | 'fora';
  nivel: number;
};

export type Local = {
  id: string;
  nome: string;
  tipo: TipoLocal;
  estadioId: string;
  distanciaMetros: number;
  /** Tempo a pé até ao estádio, já a contar com subidas e passadeiras. */
  minutosAPe: number;
  /** Posição aproximada, só para o mapa da demo. */
  coordenadas: Coordenadas;
  /** Ponto habitual de adeptos da casa: aparece com outra cor no mapa. */
  homeFanHeavy: boolean;
  /** Clubes com adeptos presentes hoje (mock). */
  clubesAqui: string[];
  pratos: Prato[];
  cervejometro: Nota;
  petiscometro: Nota;
  /** Pessoas presentes antes do teu check-in. */
  pessoasAqui: number;
  especialidade: string;
  horario: string;
  precoMedio: 1 | 2 | 3;
  notas: string[];
};

/** Avaliação de uma visita a um estádio: uma por jogo, várias por estádio. */
export type AvaliacaoVisita = {
  id: string;
  jogoId: string;
  estadioId: string;
  estadio: Nota;
  ambiente: Nota;
  acessos: Nota;
  comentario: string;
  /** Data da visita (início do jogo) em ISO 8601. */
  dataVisita: string;
  /** Data da última gravação em ISO 8601. */
  atualizadaEm: string;
};

export type VisitaLocal = {
  id: string;
  localId: string;
  /** Data do registo em ISO 8601. */
  data: string;
  /** Check-in no local conta como verificado; "Já estive aqui" fica por verificar. */
  verificado: boolean;
  origem: 'check-in' | 'manual';
};

export type UtilizadorRanking = {
  id: string;
  nome: string;
  clubeId: string;
  tascosVerificados: number;
};
