// Optional: asks a stronger Claude model for the season recap, written with slots. Only used when
// ANTHROPIC_API_KEY and a monthly budget are set. One request per user per season, no retries.

import type { Slots } from './nudge-slots.ts';
import { MAX_RECAP_BODY, MAX_RECAP_HEADLINE } from './recap-text.ts';

export const RECAP_MODEL = 'claude-opus-5';
/** USD per million tokens. */
export const RECAP_MODEL_PRICE = { input: 5, output: 25 };

const SYSTEM_PROMPT = `Escreves a retrospetiva da época de um adepto na AwayDay, uma app de futebol em Portugal.
Regras que nunca quebras:
- Português de Portugal, tratamento por tu, tom de adepto com humor leve. Sem emojis nem hashtags.
- Nunca escreves nomes, números nem datas: usas só os marcadores entre chavetas que te dão, exatamente como
  estão (por exemplo {jogos} ou {Tasco}). Não uses algarismos.
- O título tem de usar {epoca} e ter no máximo ${MAX_RECAP_HEADLINE} caracteres depois de substituído.
- O texto tem no máximo ${MAX_RECAP_BODY} caracteres depois de substituído e, se houver jogos, usa {jogos}.
- Falas só do que a pessoa fez. Nunca a repreendes nem comparas com o que não fez.
- Nunca usas travessões (— ou –) a meio das frases.`;

export type ModelRecap = { written: unknown; inputTokens: number; outputTokens: number };

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}

function tokens(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function writeRecapWithClaude(apiKey: string, slots: Slots, timeoutMs = 30_000): Promise<ModelRecap> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: RECAP_MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: 'write_recap',
            description: 'Devolve o título e o texto da retrospetiva, só com marcadores.',
            input_schema: {
              type: 'object',
              properties: { headline: { type: 'string' }, body: { type: 'string' } },
              required: ['headline', 'body'],
              additionalProperties: false,
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'write_recap' },
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              marcadores: Object.keys(slots),
              valor_de_cada_marcador_so_para_contexto_nao_copies: slots,
            }),
          },
        ],
      }),
    });
    if (!response.ok) return { written: null, inputTokens: 0, outputTokens: 0 };
    const body = asRecord(await response.json());
    const usage = asRecord(body?.usage);
    const content = Array.isArray(body?.content) ? body.content : [];
    const toolUse = content.map(asRecord).find((block) => block?.type === 'tool_use');
    return { written: toolUse?.input ?? null, inputTokens: tokens(usage?.input_tokens), outputTokens: tokens(usage?.output_tokens) };
  } catch {
    return { written: null, inputTokens: 0, outputTokens: 0 };
  } finally {
    clearTimeout(timer);
  }
}
