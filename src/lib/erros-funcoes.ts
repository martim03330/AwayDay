/**
 * The JSON body an Edge Function answered with for a non-2xx status (e.g. `{ "error": "too_far", "distance_m": 400 }`),
 * read from the error supabase-js throws. Duck typing on purpose: `instanceof FunctionsHttpError` / `instanceof
 * Response` are not reliable in React Native (the response can come from another fetch implementation), and then
 * every refusal looked like a network failure. The body can only be read once: read it here, then use the result.
 */
export async function corpoDoErroDaFuncao(
  erro: unknown
): Promise<Readonly<Record<string, unknown>> | null> {
  if (typeof erro !== 'object' || erro === null) return null;
  const contexto: unknown = Reflect.get(erro, 'context');
  if (typeof contexto !== 'object' || contexto === null) return null;
  const lerJson: unknown = Reflect.get(contexto, 'json');
  if (typeof lerJson !== 'function') return null;
  try {
    const corpo: unknown = await Reflect.apply(lerJson, contexto, []);
    return typeof corpo === 'object' && corpo !== null && !Array.isArray(corpo)
      ? Object.fromEntries(Object.entries(corpo))
      : null;
  } catch {
    return null;
  }
}
