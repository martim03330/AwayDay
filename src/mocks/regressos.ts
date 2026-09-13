import type { UltimoTransporte } from '@/mocks/tipos';

/** Último transporte público de regresso por estádio (valores mock, só para a demo). */
const ultimosTransportes: Partial<Record<string, UltimoTransporte>> = {
  luz: { modo: 'metro', descricao: 'Último metro da Linha Azul em Colégio Militar/Luz', hora: '01:00' },
  dragao: { modo: 'metro', descricao: 'Último metro na estação Estádio do Dragão', hora: '01:00' },
  alvalade: { modo: 'metro', descricao: 'Último metro da Linha Verde em Campo Grande', hora: '01:00' },
  'municipal-braga': { modo: 'autocarro', descricao: 'Último TUB para o centro de Braga', hora: '00:30' },
  'afonso-henriques': { modo: 'autocarro', descricao: 'Último autocarro para o centro de Guimarães', hora: '00:15' },
  'coimbra-da-mota': { modo: 'comboio', descricao: 'Último comboio do Estoril para o Cais do Sodré', hora: '01:30' },
  'estadio-maritimo': { modo: 'autocarro', descricao: 'Último autocarro dos Barreiros para a Baixa', hora: '23:45' },
  'municipal-arouca': { modo: 'autocarro', descricao: 'Último autocarro de Arouca para o Porto', hora: '20:30' },
  'estadio-do-mar': { modo: 'metro', descricao: 'Último metro da Linha A no Estádio do Mar', hora: '01:00' },
  fontelo: { modo: 'autocarro', descricao: 'Último autocarro urbano do Fontelo', hora: '22:00' },
  'joao-cardoso': { modo: 'autocarro', descricao: 'Último autocarro de Tondela para Viseu', hora: '23:00' },
  'cd-aves': { modo: 'autocarro', descricao: 'Último autocarro da Vila das Aves para o Porto', hora: '23:30' },
  'santos-pinto': { modo: 'autocarro', descricao: 'Último autocarro para o centro da Covilhã', hora: '21:00' },
  medideira: { modo: 'comboio', descricao: 'Último Fertagus do Fogueteiro para Lisboa', hora: '01:30' },
  'comendador-almeida-freitas': { modo: 'autocarro', descricao: 'Último autocarro para Guimarães', hora: '22:30' },
  'estadio-varzim': { modo: 'metro', descricao: 'Último metro da Linha B para o Porto', hora: '01:00' },
  'rio-maior': { modo: 'autocarro', descricao: 'Último expresso de Rio Maior para Lisboa', hora: '23:30' },
  '22-de-junho': { modo: 'comboio', descricao: 'Último comboio de Famalicão para o Porto', hora: '00:40' },
  'cidade-de-coimbra': { modo: 'autocarro', descricao: 'Último autocarro para a Baixa de Coimbra', hora: '23:00' },
  restelo: { modo: 'comboio', descricao: 'Último comboio de Belém para o Cais do Sodré', hora: '01:30' },
  'olimpico-roma': { modo: 'autocarro', descricao: 'Autocarros para visitantes até à Piazza dei Cinquecento', hora: '23:30' },
  'allianz-stadium': { modo: 'autocarro', descricao: 'Autocarros grátis de regresso ao Parco del Valentino', hora: '23:15' },
  'red-bull-arena': { modo: 'autocarro', descricao: 'Autocarros grátis de regresso à Rudolfskai 16', hora: '23:30' },
};

export function ultimoTransporteDe(estadioId: string) {
  return ultimosTransportes[estadioId];
}
