/** Rivalidades usadas pelas missões (mock). Clubes sem entrada não têm rivais definidos na demo. */
const rivaisPorClube: Partial<Record<string, readonly string[]>> = {
  benfica: ['sporting', 'porto'],
  sporting: ['benfica', 'porto'],
  porto: ['benfica', 'sporting'],
  braga: ['vitoria'],
  vitoria: ['braga'],
};

export function rivaisDe(clubeId: string): readonly string[] {
  return rivaisPorClube[clubeId] ?? [];
}
