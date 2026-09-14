// Optional: asks Claude for a nudge sentence written with slots. Only used when ANTHROPIC_API_KEY and a
// monthly budget are set. One request per message, no retries: on any failure the caller uses a template.

import type { Slots } from './nudge-slots.ts';
import { MAX_NUDGE_LENGTH, NUDGE_TEMPLATES, type TemplateId } from './nudge-text.ts';

export const NUDGE_MODEL = 'claude-sonnet-5';
/** USD per million tokens, to keep track of the monthly budget. */
export const NUDGE_MODEL_PRICE = { input: 2, output: 10 };

const SYSTEM_PROMPT = `Escreves notificações curtas para a AwayDay, uma app para adeptos de futebol em Portugal.
Regras que nunca quebras:
- Português de Portugal, tratamento por tu, tom de adepto com humor leve. Sem emojis nem hashtags.
- Nunca escreves nomes de clubes, estádios, tascos, dias da semana, horas nem números. Usas só os marcadores
  entre chavetas que te dão, exatamente como estão escritos (por exemplo {Clube} ou {estadio_a}).
- Não usas algarismos.
- Depois de os marcadores serem substituídos, o texto tem no máximo ${MAX_NUDGE_LENGTH} caracteres.
- Nunca repreendes nem fazes sentir culpa a quem não foi a jogos.
- Uma frase, ou duas curtas.`;

export type ModelNudge = { template: string | null; inputTokens: number; outputTokens: number };

const NOTHING: ModelNudge = { template: null, inputTokens: 0, outputTokens: 0 };

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function tokenCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function parseModelResponse(payload: unknown): ModelNudge {
  const body = asRecord(payload);
  const usage = asRecord(body?.usage);
  const content = Array.isArray(body?.content) ? body.content : [];
  const toolUse = content.map(asRecord).find((block) => block?.type === 'tool_use');
  const input = asRecord(toolUse?.input);
  return {
    template: typeof input?.text === 'string' ? input.text : null,
    inputTokens: tokenCount(usage?.input_tokens),
    outputTokens: tokenCount(usage?.output_tokens),
  };
}

export async function writeNudgeWithClaude(
  apiKey: string,
  kind: TemplateId,
  slots: Slots,
  timeoutMs = 10_000
): Promise<ModelNudge> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: NUDGE_MODEL,
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: 'write_nudge',
            description: 'Devolve a notificação escrita só com os marcadores disponíveis.',
            input_schema: {
              type: 'object',
              properties: { text: { type: 'string' } },
              required: ['text'],
              additionalProperties: false,
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'write_nudge' },
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              tipo: kind,
              marcadores: Object.keys(slots),
              valor_de_cada_marcador_so_para_contexto_nao_copies: slots,
              marcadores_obrigatorios: NUDGE_TEMPLATES[kind].required,
              exemplos: NUDGE_TEMPLATES[kind].variants,
            }),
          },
        ],
      }),
    });
    if (!response.ok) return NOTHING;
    return parseModelResponse(await response.json());
  } catch {
    return NOTHING;
  } finally {
    clearTimeout(timer);
  }
}
