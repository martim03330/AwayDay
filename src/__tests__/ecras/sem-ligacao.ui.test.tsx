// Offline must never look like «no groups» or «removed from the group»: Malta (src/app/(tabs)/malta/index.tsx) and a
// group's chat (src/app/grupos/[grupoId]/index.tsx) tell loading, error and empty apart.
// The test lives outside src/app so Expo Router never picks it up as a page.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import MaltaScreen from '@/app/(tabs)/malta';
import ConversaDoGrupoScreen from '@/app/grupos/[grupoId]';
import type { GroupInboxItem } from '@/features/groups/api';
import { definirUtilizador, UTILIZADORES } from '../../../jest/sessao';

jest.mock('@/lib/session', () => jest.requireActual('../../../jest/sessao').mockSessao);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ grupoId: 'g1' }),
  useFocusEffect: jest.fn(),
  useSegments: () => [],
  Stack: { Screen: () => null },
}));
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 0 }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

type Consulta = {
  data?: GroupInboxItem[];
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  refetch: jest.Mock;
};
let mockInbox: Consulta;
const mockRefrescarGrupos = jest.fn();
const mockVazio = { data: undefined, isLoading: false };

jest.mock('@/features/groups/hooks/useGroups', () => ({
  useMyGroupInbox: () => mockInbox,
  useGroupFromInbox: (groupId: string | null) => ({
    ...mockInbox,
    group: (mockInbox.data ?? []).find((grupo) => grupo.id === groupId) ?? null,
  }),
  useRefreshGroups: () => mockRefrescarGrupos,
  useGroupMessages: () => mockVazio,
  useGroupChannel: () => 1,
  usePlans: () => mockVazio,
  usePlanConflicts: () => mockVazio,
  useGroupFixturePlans: () => mockVazio,
  useGroupMembers: () => mockVazio,
  useGroupChatActions: () => ({ enviar: jest.fn(), reagir: jest.fn(), editar: jest.fn(), apagar: jest.fn() }),
  plansKey: () => ['plans'],
}));
jest.mock('@/features/friends/hooks/useFriends', () => ({
  useMyGroupInvites: () => ({ data: [], isLoading: false }),
  useRefreshFriends: () => jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/features/profile/hooks/useMyProfile', () => ({ useProfileCards: () => mockVazio }));
jest.mock('@/features/moderation/components/Moderacao', () => ({ useModeracao: () => ({}) }));
jest.mock('@/features/groups/components/EntrarComCodigo', () => ({ EntrarComCodigo: () => null }));
jest.mock('@/features/groups/components/CaraDoGrupo', () => ({ CaraDoGrupo: () => null }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));

function consulta(mudancas: Partial<Consulta>): Consulta {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn().mockResolvedValue(undefined),
    ...mudancas,
  };
}

beforeEach(() => {
  definirUtilizador(UTILIZADORES.comConta);
  mockRefrescarGrupos.mockReset().mockResolvedValue(undefined);
});

describe('Malta', () => {
  it('a failed fetch with nothing saved is «Sem ligação», with a retry — never «Ainda sem malta»', () => {
    mockInbox = consulta({ isError: true });
    render(<MaltaScreen />);
    expect(screen.getByRole('header', { name: 'Sem ligação' })).toBeOnTheScreen();
    expect(screen.getByText('Puxa para baixo para tentar outra vez.')).toBeOnTheScreen();
    expect(screen.queryByText('Ainda sem malta')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    expect(mockRefrescarGrupos).toHaveBeenCalled();
  });

  it('an answer with no groups is «Ainda sem malta»', () => {
    mockInbox = consulta({ data: [] });
    render(<MaltaScreen />);
    expect(screen.getByText('Ainda sem malta')).toBeOnTheScreen();
    expect(screen.queryByText('Sem ligação')).toBeNull();
  });

  it('while loading, neither message', () => {
    mockInbox = consulta({ isLoading: true });
    render(<MaltaScreen />);
    expect(screen.queryByText('Ainda sem malta')).toBeNull();
    expect(screen.queryByText('Sem ligação')).toBeNull();
  });
});

describe('A group chat', () => {
  it('a failed list is «Sem ligação» with a retry — never «Já não estás neste grupo»', async () => {
    mockInbox = consulta({ isError: true });
    render(<ConversaDoGrupoScreen />);
    expect(screen.getByRole('header', { name: 'Sem ligação' })).toBeOnTheScreen();
    expect(screen.queryByText('Já não estás neste grupo')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    });
    expect(mockInbox.refetch).toHaveBeenCalled();
  });

  it('a list that arrived without the group is «Já não estás neste grupo»', () => {
    mockInbox = consulta({ data: [] });
    render(<ConversaDoGrupoScreen />);
    expect(screen.getByText('Já não estás neste grupo')).toBeOnTheScreen();
    expect(screen.queryByText('Sem ligação')).toBeNull();
  });
});
