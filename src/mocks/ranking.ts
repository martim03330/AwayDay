import type { UtilizadorRanking } from '@/mocks/tipos';

/** Utilizadores fictícios para o ranking de tascos verificados. */
export const rankingMock: UtilizadorRanking[] = [
  { id: 'rita', nome: 'Rita das Bifanas', clubeId: 'benfica', tascosVerificados: 14 },
  { id: 'ze', nome: 'Zé Tripeiro', clubeId: 'porto', tascosVerificados: 11 },
  { id: 'ines', nome: 'Inês da Bancada Central', clubeId: 'sporting', tascosVerificados: 9 },
  { id: 'marta', nome: 'Marta Minhota', clubeId: 'braga', tascosVerificados: 7 },
  { id: 'joca', nome: 'Joca Vimaranense', clubeId: 'vitoria', tascosVerificados: 5 },
  { id: 'ana', nome: 'Ana Tasqueira', clubeId: 'academica', tascosVerificados: 4 },
  { id: 'nuno', nome: 'Nuno do Restelo', clubeId: 'belenenses', tascosVerificados: 2 },
  { id: 'filipe', nome: 'Filipe Insular', clubeId: 'maritimo', tascosVerificados: 1 },
];
