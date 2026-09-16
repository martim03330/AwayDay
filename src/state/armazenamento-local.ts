/**
 * What stays on this phone between launches: device preferences and, without an account, the user's activity.
 * Nothing here is sent anywhere. Demo data never gets written here.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TipoNotificacao } from '@/mocks/notificacoes';
import type { AvaliacaoVisita, FotoMissao, MedicaoBarulho, Nota, VisitaLocal } from '@/mocks/tipos';

const CHAVE_PREFERENCIAS = 'awayday-preferencias-v1';
const CHAVE_ATIVIDADE = 'awayday-atividade-local-v1';

export type EstadoPermissaoGuardado = 'aceite' | 'recusada' | null;

export type PreferenciasLocais = {
  onboardingConcluido: boolean;
  introducaoVista: boolean;
  permissoes: { localizacao: EstadoPermissaoGuardado; notificacoes: EstadoPermissaoGuardado };
  clubeFavoritoId: string | null;
  clubeDaTerraId: string | null;
  sonsLigados: boolean;
  /** Only used without an account; with an account the preferences live there. */
  notificacoes: Partial<Record<TipoNotificacao, boolean>>;
  /** Demo data and simulated time instead of the user's real activity. */
  modoDemo: boolean;
  /** 'sistema' segue o telemóvel; 'claro' e 'escuro' fixam a paleta. */
  tema: 'sistema' | 'claro' | 'escuro';
  /** Accounts that were already asked whether to bring this phone's activity in. */
  contasPerguntadas: string[];
};

/** Beer (cervejómetro) and food (petiscómetro) scores for one tasco. */
export type NotasCervejaPetiscoGuardadas = { cerveja: Nota | null; petisco: Nota | null };

export type AtividadeLocal = {
  avaliacoes: AvaliacaoVisita[];
  visitas: VisitaLocal[];
  notasTascos: Record<string, Nota>;
  notasCervejaPetisco: Record<string, NotasCervejaPetiscoGuardadas>;
  fotos: FotoMissao[];
  medicoes: MedicaoBarulho[];
};

export const PREFERENCIAS_INICIAIS: PreferenciasLocais = {
  onboardingConcluido: false,
  introducaoVista: false,
  permissoes: { localizacao: null, notificacoes: null },
  clubeFavoritoId: null,
  clubeDaTerraId: null,
  sonsLigados: false,
  notificacoes: {},
  modoDemo: false,
  tema: 'sistema',
  contasPerguntadas: [],
};

export const ATIVIDADE_VAZIA: AtividadeLocal = {
  avaliacoes: [],
  visitas: [],
  notasTascos: {},
  notasCervejaPetisco: {},
  fotos: [],
  medicoes: [],
};

type Registo = Readonly<Record<string, unknown>>;

function eRegisto(valor: unknown): valor is Registo {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null;
}

function booleano(valor: unknown, omissao: boolean) {
  return typeof valor === 'boolean' ? valor : omissao;
}

function eNota(valor: unknown): valor is Nota {
  return valor === 1 || valor === 2 || valor === 3 || valor === 4 || valor === 5;
}

function permissao(valor: unknown): EstadoPermissaoGuardado {
  return valor === 'aceite' || valor === 'recusada' ? valor : null;
}

function lista<T>(valor: unknown, converter: (item: Registo) => T | null): T[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((item) => {
    const convertido = eRegisto(item) ? converter(item) : null;
    return convertido === null ? [] : [convertido];
  });
}

function avaliacao(item: Registo): AvaliacaoVisita | null {
  const [id, jogoId, estadioId, dataVisita, atualizadaEm] = [
    texto(item.id),
    texto(item.jogoId),
    texto(item.estadioId),
    texto(item.dataVisita),
    texto(item.atualizadaEm),
  ];
  if (!id || !jogoId || !estadioId || !dataVisita || !atualizadaEm) return null;
  if (!eNota(item.estadio) || !eNota(item.ambiente) || !eNota(item.acessos)) return null;
  return {
    id,
    jogoId,
    estadioId,
    estadio: item.estadio,
    ambiente: item.ambiente,
    acessos: item.acessos,
    comentario: texto(item.comentario) ?? '',
    dataVisita,
    atualizadaEm,
  };
}

function visita(item: Registo): VisitaLocal | null {
  const [id, localId, data] = [texto(item.id), texto(item.localId), texto(item.data)];
  if (!id || !localId || !data) return null;
  const origem = item.origem === 'check-in' || item.origem === 'manual' ? item.origem : null;
  if (!origem) return null;
  return { id, localId, data, verificado: booleano(item.verificado, false), origem };
}

function foto(item: Registo): FotoMissao | null {
  const [id, missaoId, tiradaEm] = [texto(item.id), texto(item.missaoId), texto(item.tiradaEm)];
  if (!id || !missaoId || !tiradaEm) return null;
  return {
    id,
    missaoId,
    uri: texto(item.uri),
    tiradaEm,
    jogoId: texto(item.jogoId),
    estadioId: texto(item.estadioId),
    // Photos kept on the phone are never verified: only the server can verify.
    verificada: false,
    exemplo: booleano(item.exemplo, false),
  };
}

function medicao(item: Registo): MedicaoBarulho | null {
  const [id, jogoId, estadioId, medidaEm] = [
    texto(item.id),
    texto(item.jogoId),
    texto(item.estadioId),
    texto(item.medidaEm),
  ];
  if (!id || !jogoId || !estadioId || !medidaEm || typeof item.nivel !== 'number') return null;
  return { id, jogoId, estadioId, medidaEm, nivel: item.nivel };
}

async function ler(chave: string): Promise<unknown> {
  try {
    const bruto = await AsyncStorage.getItem(chave);
    return bruto === null ? null : (JSON.parse(bruto) as unknown);
  } catch {
    // A broken value is treated as missing: the app starts clean instead of crashing.
    return null;
  }
}

async function escrever(chave: string, valor: unknown) {
  try {
    await AsyncStorage.setItem(chave, JSON.stringify(valor));
  } catch (erro: unknown) {
    if (__DEV__) console.warn('Não foi possível guardar no telemóvel:', erro);
  }
}

export async function lerPreferencias(): Promise<PreferenciasLocais> {
  const valor = await ler(CHAVE_PREFERENCIAS);
  if (!eRegisto(valor)) return PREFERENCIAS_INICIAIS;
  const permissoes = eRegisto(valor.permissoes) ? valor.permissoes : {};
  const notificacoes = eRegisto(valor.notificacoes) ? valor.notificacoes : {};
  return {
    onboardingConcluido: booleano(valor.onboardingConcluido, false),
    introducaoVista: booleano(valor.introducaoVista, false),
    permissoes: {
      localizacao: permissao(permissoes.localizacao),
      notificacoes: permissao(permissoes.notificacoes),
    },
    clubeFavoritoId: texto(valor.clubeFavoritoId),
    clubeDaTerraId: texto(valor.clubeDaTerraId),
    sonsLigados: booleano(valor.sonsLigados, false),
    notificacoes: Object.fromEntries(
      Object.entries(notificacoes).filter(
        (entrada): entrada is [TipoNotificacao, boolean] => typeof entrada[1] === 'boolean'
      )
    ),
    modoDemo: booleano(valor.modoDemo, false),
    tema:
      valor.tema === 'claro' || valor.tema === 'escuro' || valor.tema === 'sistema'
        ? valor.tema
        : 'sistema',
    contasPerguntadas: Array.isArray(valor.contasPerguntadas)
      ? valor.contasPerguntadas.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export function guardarPreferencias(preferencias: PreferenciasLocais) {
  return escrever(CHAVE_PREFERENCIAS, preferencias);
}

export async function lerAtividadeLocal(): Promise<AtividadeLocal> {
  const valor = await ler(CHAVE_ATIVIDADE);
  if (!eRegisto(valor)) return ATIVIDADE_VAZIA;
  const notas = eRegisto(valor.notasTascos) ? valor.notasTascos : {};
  const subNotas = eRegisto(valor.notasCervejaPetisco) ? valor.notasCervejaPetisco : {};
  return {
    avaliacoes: lista(valor.avaliacoes, avaliacao),
    visitas: lista(valor.visitas, visita),
    notasTascos: Object.fromEntries(
      Object.entries(notas).filter((entrada): entrada is [string, Nota] => eNota(entrada[1]))
    ),
    notasCervejaPetisco: Object.fromEntries(
      Object.entries(subNotas).flatMap(([localId, notasDoTasco]) => {
        if (!eRegisto(notasDoTasco)) return [];
        const cerveja = eNota(notasDoTasco.cerveja) ? notasDoTasco.cerveja : null;
        const petisco = eNota(notasDoTasco.petisco) ? notasDoTasco.petisco : null;
        return cerveja === null && petisco === null ? [] : [[localId, { cerveja, petisco }]];
      })
    ),
    fotos: lista(valor.fotos, foto),
    medicoes: lista(valor.medicoes, medicao),
  };
}

export function guardarAtividadeLocal(atividade: AtividadeLocal) {
  return escrever(CHAVE_ATIVIDADE, atividade);
}

export function temAtividade(atividade: AtividadeLocal) {
  return (
    atividade.avaliacoes.length > 0 ||
    atividade.visitas.length > 0 ||
    Object.keys(atividade.notasTascos).length > 0 ||
    Object.keys(atividade.notasCervejaPetisco).length > 0 ||
    atividade.fotos.length > 0 ||
    atividade.medicoes.length > 0
  );
}
