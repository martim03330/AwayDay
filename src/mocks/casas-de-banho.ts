import { obterEstadio } from '@/mocks/estadios';
import { locaisDemo } from '@/mocks/locais';
import type { Coordenadas, Restroom } from '@/mocks/tipos';

const METROS_POR_GRAU_LATITUDE = 111320;

function coordenadasDoEstadio(estadioId: string): Coordenadas {
  const estadio = obterEstadio(estadioId);
  if (!estadio) throw new Error(`Estádio desconhecido nos mocks de WC: ${estadioId}`);
  return estadio.coordenadas;
}

/** The fictional places always exist in the demo list; the on-screen list can still be empty at load time. */
function coordenadasDoLocal(localId: string): Coordenadas {
  const local = locaisDemo.find((candidato) => candidato.id === localId);
  if (!local) throw new Error(`Local desconhecido nos mocks de WC: ${localId}`);
  return local.coordenadas;
}

/** Ponto a `metros` de distância em linha reta, na direção `rumo` (graus, 0 = norte). */
function aPartirDe(origem: Coordenadas, metros: number, rumo: number): Coordenadas {
  const radianos = (rumo * Math.PI) / 180;
  return {
    latitude: origem.latitude + (metros * Math.cos(radianos)) / METROS_POR_GRAU_LATITUDE,
    longitude:
      origem.longitude +
      (metros * Math.sin(radianos)) /
        (METROS_POR_GRAU_LATITUDE * Math.cos((origem.latitude * Math.PI) / 180)),
  };
}

/** Casas de banho mock à volta dos estádios com tascos. Posições, preços e horários são de demo. */
export const casasDeBanho: Restroom[] = [
  // Estádio da Luz
  {
    id: 'wc-luz-estadio',
    nome: 'WC do Estádio da Luz (Porta 18)',
    tipo: 'estadio',
    estadioId: 'luz',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('luz'), 90, 20),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'bilhete',
    horario: { tipo: 'dias-de-jogo', abreHorasAntes: 2 },
    nota: 'Fila no intervalo garantida. Vai aos 40 minutos, que o árbitro dá sempre descontos.',
  },
  {
    id: 'wc-luz-publico',
    nome: 'WC público do Colégio Militar',
    tipo: 'publica',
    estadioId: 'luz',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('luz'), 450, 200),
    gratuita: false,
    precoEuros: 0.5,
    acessivel: true,
    acesso: 'livre',
    horario: { tipo: 'intervalo', abre: '08:00', fecha: '22:00' },
    nota: 'Custa 50 cêntimos e vale cada um deles.',
  },
  {
    id: 'wc-tasca-terceiro-anel',
    nome: 'WC da Tasca do Terceiro Anel',
    tipo: 'tasco',
    estadioId: 'luz',
    localId: 'tasca-terceiro-anel',
    coordenadas: coordenadasDoLocal('tasca-terceiro-anel'),
    gratuita: true,
    precoEuros: 0,
    acessivel: false,
    acesso: 'clientes',
    horario: { tipo: 'intervalo', abre: '12:00', fecha: '00:00' },
    nota: 'Pede qualquer coisa primeiro. Uma imperial conta.',
  },
  // Estádio do Dragão
  {
    id: 'wc-dragao-estadio',
    nome: 'WC do Estádio do Dragão (bancada nascente)',
    tipo: 'estadio',
    estadioId: 'dragao',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('dragao'), 90, 90),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'bilhete',
    horario: { tipo: 'dias-de-jogo', abreHorasAntes: 2 },
    nota: 'Sobe um piso e poupas 10 minutos de fila.',
  },
  {
    id: 'wc-dragao-metro',
    nome: 'WC da estação de metro Estádio do Dragão',
    tipo: 'publica',
    estadioId: 'dragao',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('dragao'), 260, 160),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'livre',
    horario: { tipo: 'intervalo', abre: '06:00', fecha: '01:00' },
    nota: 'Grátis, que é o melhor preço que há.',
  },
  {
    id: 'wc-cervejaria-azul-branco',
    nome: 'WC da Cervejaria Azul e Branco',
    tipo: 'tasco',
    estadioId: 'dragao',
    localId: 'cervejaria-azul-branco',
    coordenadas: coordenadasDoLocal('cervejaria-azul-branco'),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'clientes',
    horario: { tipo: 'intervalo', abre: '12:00', fecha: '01:00' },
    nota: 'Limpo e com sabonete. Luxo.',
  },
  // Estádio José Alvalade
  {
    id: 'wc-alvalade-estadio',
    nome: 'WC do Estádio José Alvalade (bancada central)',
    tipo: 'estadio',
    estadioId: 'alvalade',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('alvalade'), 90, 270),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'bilhete',
    horario: { tipo: 'dias-de-jogo', abreHorasAntes: 2 },
    nota: 'Os da bancada central têm menos fila. Não digas a ninguém.',
  },
  {
    id: 'wc-campo-grande-publico',
    nome: 'WC público do Campo Grande',
    tipo: 'publica',
    estadioId: 'alvalade',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('alvalade'), 520, 180),
    gratuita: false,
    precoEuros: 0.5,
    acessivel: false,
    acesso: 'livre',
    horario: { tipo: 'intervalo', abre: '07:00', fecha: '21:00' },
    nota: 'Fecha às 21h. Planeia a bexiga em conformidade.',
  },
  // Estádio Municipal de Braga
  {
    id: 'wc-braga-estadio',
    nome: 'WC do Estádio Municipal de Braga',
    tipo: 'estadio',
    estadioId: 'municipal-braga',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('municipal-braga'), 90, 0),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'bilhete',
    horario: { tipo: 'dias-de-jogo', abreHorasAntes: 2 },
    nota: 'A pedreira é bonita. A fila nem por isso.',
  },
  {
    id: 'wc-tasca-da-pedreira',
    nome: 'WC da Tasca da Pedreira',
    tipo: 'tasco',
    estadioId: 'municipal-braga',
    localId: 'tasca-da-pedreira',
    coordenadas: coordenadasDoLocal('tasca-da-pedreira'),
    gratuita: true,
    precoEuros: 0,
    acessivel: false,
    acesso: 'clientes',
    horario: { tipo: 'intervalo', abre: '11:00', fecha: '23:00' },
    nota: 'A porta é rija: empurra com convicção.',
  },
  // Estádio D. Afonso Henriques
  {
    id: 'wc-afonso-henriques-estadio',
    nome: 'WC do Estádio D. Afonso Henriques',
    tipo: 'estadio',
    estadioId: 'afonso-henriques',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('afonso-henriques'), 90, 180),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'bilhete',
    horario: { tipo: 'dias-de-jogo', abreHorasAntes: 2 },
    nota: 'Sai cedo ao intervalo. O Berço é grande e a fila também.',
  },
  {
    id: 'wc-toural-publico',
    nome: 'WC público do Largo do Toural',
    tipo: 'publica',
    estadioId: 'afonso-henriques',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('afonso-henriques'), 1000, 240),
    gratuita: true,
    precoEuros: 0,
    acessivel: true,
    acesso: 'livre',
    horario: { tipo: 'intervalo', abre: '08:00', fecha: '20:00' },
    nota: 'Grátis e no centro. Fecha às 20h, o jogo não.',
  },
  // Estádio do Restelo
  {
    id: 'wc-restelo-estadio',
    nome: 'WC do Estádio do Restelo',
    tipo: 'estadio',
    estadioId: 'restelo',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('restelo'), 90, 45),
    gratuita: true,
    precoEuros: 0,
    acessivel: false,
    acesso: 'bilhete',
    horario: { tipo: 'dias-de-jogo', abreHorasAntes: 2 },
    nota: 'Bancada clássica, casa de banho a condizer.',
  },
  {
    id: 'wc-belem-publico',
    nome: 'WC público de Belém',
    tipo: 'publica',
    estadioId: 'restelo',
    localId: null,
    coordenadas: aPartirDe(coordenadasDoEstadio('restelo'), 900, 170),
    gratuita: false,
    precoEuros: 0.5,
    acessivel: true,
    acesso: 'livre',
    horario: { tipo: 'intervalo', abre: '09:00', fecha: '20:00' },
    nota: 'Com vista para o rio, se deixares a porta aberta. Não deixes.',
  },
];
