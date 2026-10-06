// The kinds of person a screen can meet, for tests that mock `@/lib/session`.
//
//   jest.mock('@/lib/session', () => require('../../../jest/sessao').mockSessao);
//   ...
//   definirUtilizador(UTILIZADORES.semConta);

/** `null` is someone with no account (or not signed in). */
export const UTILIZADORES = {
  semConta: null,
  comConta: '00000000-0000-4000-8000-000000000001',
  admin: '00000000-0000-4000-8000-0000000000ad',
} as const;

let atual: string | null = null;

export function definirUtilizador(userId: string | null) {
  atual = userId;
}

/** Module shape of `@/lib/session` that reads the person set with `definirUtilizador`. */
export const mockSessao = {
  useUserId: () => atual,
  currentUserId: () => atual,
  useSession: () =>
    atual
      ? { status: 'signed-in' as const, session: { user: { id: atual } } }
      : { status: 'signed-out' as const },
};
