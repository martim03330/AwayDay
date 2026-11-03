// A Casa's trip, from the managers' side (src/app/casa/viagem/[viagemId]/gerir.tsx): the vehicles with who is in
// each, the waiting list, the totals the server counted, and the «⋯» on each booking (move, paid, take off).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Share } from 'react-native';

import GerirViagemScreen from '@/app/casa/viagem/[viagemId]/gerir';
import type { ClubBooking, ClubTripFull, SupportersClub } from '@/features/casas/types';
import { carregarNoAlerta, espiarAlertas } from '../../../jest/alertas';
import { definirUtilizador, UTILIZADORES } from '../../../jest/sessao';

jest.mock('@/lib/session', () => jest.requireActual('../../../jest/sessao').mockSessao);
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ viagemId: 't1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useFocusEffect: () => undefined,
  Stack: { Screen: () => null },
}));
jest.mock('@/state/app-state', () => ({
  useAppState: () => ({ esconderValores: false }),
}));
jest.mock('@/lib/vibrar', () => ({
  vibrarErro: jest.fn(),
  vibrarSucesso: jest.fn(),
  vibrarSelecao: jest.fn(),
}));
jest.mock('@/hooks/use-now', () => ({ useNow: () => Date.parse('2026-11-01T10:00:00Z') }));
jest.mock('@/mocks/jogos', () => ({ obterJogo: () => undefined }));

let mockPapel: SupportersClub['myRole'] = 'owner';
let mockEstado: SupportersClub['status'] = 'verified';
let mockCasaFalha = false;
let mockSoSocios = false;
const mockManage = jest.fn();
const mockRotate = jest.fn();
jest.mock('@/features/casas/api', () => ({
  fetchClubTrip: () => Promise.resolve(mockViagem()),
  fetchClubTripBookings: () => Promise.resolve(mockReservas()),
  fetchClubTripNotices: () => Promise.resolve([]),
  fetchMemberCode: () => Promise.resolve(mockSoSocios ? 'douro2026x' : null),
  rotateMemberCode: (...args: unknown[]) => mockRotate(...args),
  fetchSupportersClub: (): Promise<SupportersClub> =>
    mockCasaFalha
      ? Promise.reject(new Error('offline'))
      : Promise.resolve({
          id: 'c1',
          clubId: 'clube-1',
          name: 'Casa da Terra',
          municipalityName: 'Terra',
          status: mockEstado,
          myRole: mockPapel,
          following: false,
        }),
  manageClubBooking: (...args: unknown[]) => mockManage(...args),
}));

function mockViagem(): ClubTripFull {
  return {
    trip: {
      id: 't1',
      supportersClubId: 'c1',
      fixtureId: 'f1',
      name: 'Autocarro da sede',
      priceCents: 1360,
      membersOnly: mockSoSocios,
      bookingsCloseAt: '2026-11-07T20:00:00Z',
      note: null,
      status: 'open',
    },
    stops: [{ id: 's1', position: 1, name: 'Sede', passesAt: '2026-11-08T09:00:00Z' }],
    summary: [
      {
        vehicleId: 'v1',
        label: 'Autocarro 1',
        kind: 'autocarro',
        seats: 2,
        occupied: 2,
        waitingPeople: 3,
        paidPeople: 0,
        dueCents: 2720,
      },
      {
        vehicleId: 'v2',
        label: 'Carrinha 1',
        kind: 'carrinha',
        seats: 3,
        occupied: 1,
        waitingPeople: 3,
        paidPeople: 1,
        dueCents: 0,
      },
    ],
    myBooking: null,
  };
}

function reserva(mudancas: Partial<ClubBooking>): ClubBooking {
  return {
    id: 'b1',
    name: 'Rui',
    isManual: false,
    stopName: 'Sede',
    vehicleId: 'v1',
    people: 2,
    companions: ['Ana'],
    status: 'booked',
    paid: false,
    boarded: false,
    ...mudancas,
  };
}

function mockReservas(): ClubBooking[] {
  return [
    reserva({}),
    reserva({ id: 'b2', name: 'Sara', vehicleId: 'v2', people: 1, companions: [], paid: true }),
    reserva({ id: 'b3', name: 'Tiago', vehicleId: null, people: 1, companions: [], status: 'waiting' }),
  ];
}

let cliente: QueryClient | null = null;

function abrir() {
  cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={cliente}>
      <GerirViagemScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  definirUtilizador(UTILIZADORES.comConta);
  mockPapel = 'owner';
  mockEstado = 'verified';
  mockCasaFalha = false;
  mockSoSocios = false;
  mockManage.mockReset().mockResolvedValue(undefined);
  mockRotate.mockReset().mockResolvedValue('novo1234ab');
});
afterEach(() => {
  cliente?.clear();
  cliente = null;
  jest.restoreAllMocks();
});

describe('Managing a Casa trip', () => {
  it('shows each vehicle with its seats, the waiting list and what is still to be paid', async () => {
    abrir();
    expect(await screen.findByText('Lista de espera · 1')).toBeTruthy();
    expect(screen.getByText('2/2')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('Por receber 27,20 €')).toBeTruthy();
    // The waiting people as the server counted them, not a sum over the list.
    expect(screen.getByText('Em espera 3 pessoas')).toBeTruthy();
    expect(await screen.findByText('Rui')).toBeTruthy();
    expect(screen.getByText('Tiago')).toBeTruthy();
  });

  it('moves a booking to another vehicle from its «⋯»', async () => {
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Mais opções sobre Rui' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mudar de transporte' }));
    // The second menu opens once the first one has faded away.
    fireEvent.press(await screen.findByRole('button', { name: 'Carrinha 1' }));
    await waitFor(() => expect(mockManage).toHaveBeenCalledWith('b1', 'move', 'v2'));
  });

  it('marks a booking as paid', async () => {
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Mais opções sobre Rui' }));
    fireEvent.press(within(screen.getByTestId('menu-de-acoes')).getByRole('button', { name: 'Pago' }));
    await waitFor(() => expect(mockManage).toHaveBeenCalledWith('b1', 'paid', undefined));
  });

  it('asks before taking someone off the trip', async () => {
    const alertas = espiarAlertas();
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Mais opções sobre Rui' }));
    fireEvent.press(screen.getByRole('button', { name: 'Tirar da viagem' }));
    // The alert waits for the menu to fade away (iOS drops one asked for while a modal is closing).
    expect(alertas).not.toHaveBeenCalled();
    await waitFor(() => expect(alertas).toHaveBeenCalledTimes(1));
    expect(mockManage).not.toHaveBeenCalled();
    carregarNoAlerta(alertas, 'Tirar');
    await waitFor(() => expect(mockManage).toHaveBeenCalledWith('b1', 'remove', undefined));
  });

  it('is only for the Casa’s managers', async () => {
    mockPapel = null;
    abrir();
    expect(await screen.findByText('Só para quem gere a Casa')).toBeTruthy();
    expect(screen.queryByText('Lista de espera · 1')).toBeNull();
  });

  it('shows a connection error before deciding who manages the Casa', async () => {
    mockCasaFalha = true;
    abrir();
    expect(await screen.findByText('Sem ligação')).toBeTruthy();
    expect(screen.queryByText('Só para quem gere a Casa')).toBeNull();
  });

  it('offers nothing to change while the Casa is suspended', async () => {
    mockEstado = 'suspended';
    abrir();
    expect(await screen.findByText('Casa suspensa')).toBeTruthy();
    expect(await screen.findByText('Rui')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mais opções sobre Rui' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Acrescentar transporte' })).toBeNull();
    expect(screen.queryByText('Cancelar viagem')).toBeNull();
  });

  it('shares the member code of a «só sócios» trip, so the Casa can send it to its members', async () => {
    mockSoSocios = true;
    const partilha = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    abrir();
    expect(await screen.findByText('douro2026x')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Partilhar código' }));
    expect(partilha).toHaveBeenCalledWith({ message: 'Código de sócio de Casa da Terra no AwayDay: douro2026x' });
  });

  it('asks before replacing the member code', async () => {
    mockSoSocios = true;
    const alertas = espiarAlertas();
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Novo código' }));
    expect(mockRotate).not.toHaveBeenCalled();
    carregarNoAlerta(alertas, 'Criar código novo');
    await waitFor(() => expect(mockRotate.mock.calls[0]?.[0]).toBe('c1'));
  });

  it('shows no member code on a trip open to everyone', async () => {
    abrir();
    expect(await screen.findByText('Rui')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Partilhar código' })).toBeNull();
  });
});
