// A Casa's trip, from the fan's side (src/app/casa/viagem/[viagemId]/index.tsx): booking with companions and the
// member code, the waiting list, the server's refusals in plain Portuguese, and nothing to cancel or pay while the
// booking is still only the app's guess. The test lives outside src/app so Expo Router never picks it up as a page.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ViagemDaCasaScreen from '@/app/casa/viagem/[viagemId]/index';
import {
  ClubTripError,
  type ClubTripFull,
  type MyClubBooking,
  type SupportersClub,
} from '@/features/casas/types';
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
// A Saturday in November; bookings close well after it.
jest.mock('@/hooks/use-now', () => ({ useNow: () => Date.parse('2026-11-01T10:00:00Z') }));
jest.mock('@/mocks/jogos', () => ({ obterJogo: () => undefined }));
jest.mock('@/features/moderation/components/Moderacao', () => ({
  useModeracao: () => ({ abrirConteudo: jest.fn(), elemento: null }),
  BotaoMais: () => null,
}));

let mockViagem: ClubTripFull;
const mockBook = jest.fn();
const mockCancel = jest.fn();
jest.mock('@/features/casas/api', () => ({
  fetchClubTrip: () => Promise.resolve(mockViagem),
  fetchClubTripNotices: () => Promise.resolve([]),
  fetchSupportersClub: (): Promise<SupportersClub> =>
    Promise.resolve({
      id: 'c1',
      clubId: 'clube-1',
      name: 'Casa da Terra',
      municipalityName: 'Terra',
      status: 'verified',
      myRole: null,
      following: false,
    }),
  bookClubTrip: (...args: unknown[]) => mockBook(...args),
  cancelMyClubBooking: (...args: unknown[]) => mockCancel(...args),
}));

function viagem(mudancas: Partial<ClubTripFull['trip']> = {}, myBooking: MyClubBooking | null = null): ClubTripFull {
  return {
    trip: {
      id: 't1',
      supportersClubId: 'c1',
      fixtureId: 'f1',
      name: 'Autocarro da sede',
      priceCents: 1500,
      membersOnly: false,
      bookingsCloseAt: '2026-11-07T20:00:00Z',
      note: null,
      status: 'open',
      ...mudancas,
    },
    stops: [
      { id: 's1', position: 1, name: 'Sede', passesAt: '2026-11-08T09:00:00Z' },
      { id: 's2', position: 2, name: 'Rotunda', passesAt: '2026-11-08T09:20:00Z' },
    ],
    summary: [
      {
        vehicleId: 'v1',
        label: 'Autocarro 1',
        kind: 'autocarro',
        seats: 50,
        occupied: 47,
        waitingPeople: 0,
        paidPeople: 0,
        dueCents: 0,
      },
    ],
    myBooking,
  };
}

function reserva(mudancas: Partial<MyClubBooking>): MyClubBooking {
  return {
    bookingId: 'b1',
    status: 'booked',
    stopName: 'Sede',
    passesAt: '2026-11-08T09:00:00Z',
    vehicleLabel: 'Autocarro 1',
    people: 1,
    dueCents: 1500,
    paid: false,
    positionInWaiting: null,
    ...mudancas,
  };
}

let cliente: QueryClient | null = null;

function abrir() {
  // No garbage-collection timers: they would keep Jest running after the last test.
  cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={cliente}>
      <ViagemDaCasaScreen />
    </QueryClientProvider>
  );
}

/** The sheet's own «Inscrever-me» is the last one on screen (the page's stays behind the sheet). */
function confirmarNaFolha() {
  const botoes = screen.getAllByRole('button', { name: 'Inscrever-me' });
  fireEvent.press(botoes[botoes.length - 1]);
}

beforeEach(() => {
  definirUtilizador(UTILIZADORES.comConta);
  mockViagem = viagem();
  mockBook.mockReset().mockResolvedValue('booked');
  mockCancel.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cliente?.clear();
  cliente = null;
});

describe('Booking a seat', () => {
  it('shows the free seats, and books the chosen stop with a companion', async () => {
    abrir();
    expect(await screen.findByText('3 lugares livres')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Inscrever-me' }));
    fireEvent.press(screen.getByRole('button', { name: /Rotunda/ }));
    fireEvent.changeText(screen.getByLabelText('Nome de quem vai contigo'), 'Rita');
    fireEvent.press(screen.getByRole('button', { name: 'Acrescentar' }));
    expect(screen.getByText('Rita')).toBeTruthy();
    confirmarNaFolha();

    await waitFor(() => expect(mockBook).toHaveBeenCalled());
    expect(mockBook.mock.calls[0][0]).toEqual({
      tripId: 't1',
      stopId: 's2',
      companions: ['Rita'],
      memberCode: null,
    });
  });

  it('a «só sócios» trip asks for the member code and sends it', async () => {
    mockViagem = viagem({ membersOnly: true });
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Inscrever-me' }));
    expect(screen.getByLabelText('Código de sócio')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /Sede/ }));
    fireEvent.changeText(screen.getByLabelText('Código de sócio'), 'azul1893');
    confirmarNaFolha();

    await waitFor(() => expect(mockBook).toHaveBeenCalled());
    expect(mockBook.mock.calls[0][0]).toMatchObject({ stopId: 's1', companions: [], memberCode: 'azul1893' });
  });

  it('a trip open to every fan has no code field', async () => {
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Inscrever-me' }));
    expect(screen.queryByLabelText('Código de sócio')).toBeNull();
  });

  it('says why the server refused, in plain words', async () => {
    mockBook.mockRejectedValue(new ClubTripError('already_in_car'));
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Inscrever-me' }));
    fireEvent.press(screen.getByRole('button', { name: /Sede/ }));
    confirmarNaFolha();

    expect(await screen.findByText('Já tens lugar num carro para este jogo.')).toBeTruthy();
  });
});

describe('A refused booking keeps what was filled in', () => {
  it('a wrong member code shows the message in the sheet, with the stop, companions and code still there', async () => {
    mockViagem = viagem({ membersOnly: true });
    mockBook.mockRejectedValue(new ClubTripError('bad_member_code'));
    abrir();
    fireEvent.press(await screen.findByRole('button', { name: 'Inscrever-me' }));
    fireEvent.press(screen.getByRole('button', { name: /Rotunda/ }));
    fireEvent.changeText(screen.getByLabelText('Nome de quem vai contigo'), 'Rita');
    fireEvent.press(screen.getByRole('button', { name: 'Acrescentar' }));
    fireEvent.changeText(screen.getByLabelText('Código de sócio'), 'errado');
    confirmarNaFolha();

    expect(await screen.findByText('Esse código não está certo. Confirma-o com a Casa.')).toBeTruthy();
    expect(screen.getByText('Rita')).toBeTruthy();
    expect(screen.getByLabelText('Código de sócio').props.value).toBe('errado');
    expect(screen.getByRole('button', { name: /Rotunda/ }).props.accessibilityState).toMatchObject({
      selected: true,
    });

    // Fixed and sent again: the same stop and companion go with the new code.
    mockBook.mockReset().mockResolvedValue('booked');
    fireEvent.changeText(screen.getByLabelText('Código de sócio'), 'azul1893');
    confirmarNaFolha();
    await waitFor(() => expect(mockBook).toHaveBeenCalled());
    expect(mockBook.mock.calls[0][0]).toEqual({
      tripId: 't1',
      stopId: 's2',
      companions: ['Rita'],
      memberCode: 'azul1893',
    });
  });
});

describe('My booking', () => {
  it('on a cancelled trip, only the notice speaks: no booking, no amount', async () => {
    mockViagem = viagem({ status: 'cancelled' }, reserva({ dueCents: 1500 }));
    abrir();
    expect(await screen.findByText('Viagem cancelada')).toBeTruthy();
    expect(screen.queryByText('Inscrito')).toBeNull();
    expect(screen.queryByText('A tua inscrição')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar inscrição' })).toBeNull();
  });

  it('on the waiting list, shows the place in it', async () => {
    mockViagem = viagem({}, reserva({ status: 'waiting', vehicleLabel: null, positionInWaiting: 1 }));
    abrir();
    expect(await screen.findByText('Em lista de espera (1.º)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Inscrever-me' })).toBeNull();
  });

  it('booked, shows the vehicle, the amount and «Cancelar inscrição»', async () => {
    mockViagem = viagem({}, reserva({ people: 2, dueCents: 3000 }));
    abrir();
    expect(await screen.findByText('Autocarro 1')).toBeTruthy();
    expect(screen.getByText(/^30,00\s€$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar inscrição' })).toBeTruthy();
  });

  it('while the server has not answered, shows no amount and nothing to cancel', async () => {
    mockViagem = viagem({}, reserva({ bookingId: 'pending', dueCents: 0, vehicleLabel: null }));
    abrir();
    expect(await screen.findByText('A confirmar…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancelar inscrição' })).toBeNull();
    expect(screen.queryByText(/^0,00\s€$/)).toBeNull();
  });
});
