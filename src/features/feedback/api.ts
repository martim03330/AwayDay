import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Reportar um erro ou sugerir uma melhoria. Não é preciso ter conta: um erro não espera por um registo.

function client() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export const NATUREZAS = ['erro', 'ideia'] as const;
export type NaturezaFeedback = (typeof NATUREZAS)[number];

export const AREAS = [
  'jogos',
  'boleias',
  'contas',
  'locais',
  'mapa',
  'perfil',
  'grupos',
  'outro',
] as const;
export type AreaFeedback = (typeof AREAS)[number];

export type FeedbackRefusal = 'bad_feedback' | 'bad_body' | 'rate_limited' | 'unknown';

export class FeedbackRefused extends Error {
  readonly reason: FeedbackRefusal;

  constructor(reason: FeedbackRefusal) {
    super(reason);
    this.name = 'FeedbackRefused';
    this.reason = reason;
  }
}

function refusal(error: { message: string }) {
  const conhecidas: FeedbackRefusal[] = ['bad_feedback', 'bad_body', 'rate_limited'];
  return new FeedbackRefused(conhecidas.find((razao) => error.message === razao) ?? 'unknown');
}

/**
 * O aparelho, como a app o conhece — «ios 18.2 · iPhone». Metade dos erros são de um telemóvel só, e sem isto não
 * se reproduzem. Não vai daqui nada que a pessoa não tenha escrito, nem localização.
 */
function aparelho() {
  const modelo = Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android' : 'Web';
  return `${Platform.OS} ${String(Platform.Version)} · ${modelo}`.slice(0, 120);
}

function versaoDaApp() {
  const versao = Constants.expoConfig?.version;
  return typeof versao === 'string' ? versao : undefined;
}

export async function sendFeedback(input: {
  kind: NaturezaFeedback;
  area: AreaFeedback;
  body: string;
}) {
  const { error } = await client().rpc('send_feedback', {
    p_kind: input.kind,
    p_area: input.area,
    p_body: input.body.trim(),
    p_device: aparelho(),
    p_app_version: versaoDaApp(),
  });
  if (error) throw refusal(error);
}

export type FeedbackItem = {
  id: string;
  kind: NaturezaFeedback;
  area: AreaFeedback;
  body: string;
  device: string | null;
  appVersion: string | null;
  status: 'novo' | 'visto' | 'resolvido';
  fromName: string | null;
  createdAt: string;
};

/** A caixa de entrada, para quem administra. */
export async function fetchFeedbackInbox(status = 'novo'): Promise<FeedbackItem[]> {
  const { data, error } = await client().rpc('feedback_inbox', { p_status: status });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    kind: row.kind === 'ideia' ? ('ideia' as const) : ('erro' as const),
    area: AREAS.find((area) => area === row.area) ?? 'outro',
    body: row.body ?? '',
    device: row.device,
    appVersion: row.app_version,
    status: row.status === 'resolvido' ? 'resolvido' : row.status === 'visto' ? 'visto' : 'novo',
    fromName: row.from_name,
    createdAt: row.created_at ?? '',
  }));
}

export async function setFeedbackStatus(id: string, status: 'novo' | 'visto' | 'resolvido') {
  const { error } = await client().rpc('set_feedback_status', { p_id: id, p_status: status });
  if (error) throw refusal(error);
}
