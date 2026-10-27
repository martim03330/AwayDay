// «Acertar contas» in the trip's expenses (src/app/sessao/[sessaoId]/despesas.tsx): recording a payment always asks
// first, and the payments made stay visible, with «Desfazer» for who the server lets take them back.
// The test lives outside src/app so Expo Router never picks it up as a page.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import DespesasScreen from '@/app/sessao/[sessaoId]/despesas';
import type { TripBalance, TripSettlement } from '@/features/trips/api';
import { carregarNoAlerta, espiarAlertas } from '../../../jest/alertas';
import { definirUtilizador } from '../../../jest/sessao';

jest.mock('@/lib/session', () => jest.requireActual('../../../jest/sessao').mockSessao);
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default
);
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sessaoId: 's1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('@/state/app-state', () => ({
  useAppState: () => ({ esconderValores: false, alternarEsconderValores: jest.fn() }),
}));
jest.mock('@/lib/vibrar', () => ({ vibrarErro: jest.fn(), vibrarSucesso: jest.fn(), vibrarSelecao: jest.fn() }));

const RUI = '00000000-0000-4000-8000-000000000001';
const TIAGO = '00000000-0000-4000-8000-000000000002';
const ANA = '00000000-0000-4000-8000-000000000003';

let mockSaldos: TripBalance[];
let mockPagamentos: TripSettlement[];
const mockRefrescar = jest.fn();
jest.mock('@/features/trips/hooks/useTrips', () => ({
  useRefreshTrips: () => mockRefrescar,
  useTripSessionCard: () => ({ card: { totalCents: 14631, people: 3 }, isLoading: false }),
  useTripExpenses: () => ({ data: [] }),
  useTripBalances: () => ({ data: mockSaldos }),
  useTripSettlements: () => ({ data: mockPagamentos }),
}));

const mockAdd = jest.fn();
const mockConfirm = jest.fn();
const mockRemove = jest.fn();
jest.mock('@/features/trips/api', () => ({
  addTripSettlement: (...args: unknown[]) => mockAdd(...args),
  confirmTripSettlement: (...args: unknown[]) => mockConfirm(...args),
  removeTripSettlement: (...args: unknown[]) => mockRemove(...args),
  removeTripExpense: jest.fn(),
  novoIdDePedido: () => 'pedido-1',
}));

function saldo(profileId: string, displayName: string, balanceCents: number): TripBalance {
  return {
    profileId,
    displayName,
    paidCents: 0,
    owedCents: 0,
    settledCents: 0,
    balanceCents,
    isMe: profileId === RUI,
  };
}

function pagamento(mudancas: Partial<TripSettlement>): TripSettlement {
  return {
    id: 'p1',
    fromProfileId: TIAGO,
    fromName: 'Tiago Silva',
    toProfileId: RUI,
    toName: 'Rui Costa',
    cents: 3534,
    confirmed: true,
    iReceive: false,
    mine: false,
    createdOn: '2026-10-27',
    receiverUndoUntil: null,
    ...mudancas,
  };
}

/** Normalises Intl's non-breaking spaces, so «35,34 €» can be written plainly. */
const simples = (texto: unknown) => String(texto).replace(/\s/g, ' ');

function abrirAcertar() {
  render(<DespesasScreen />);
  fireEvent.press(screen.getByRole('tab', { name: 'Acertar contas' }));
}

beforeEach(() => {
  definirUtilizador(RUI);
  mockSaldos = [saldo(RUI, 'Rui Costa', 3534), saldo(TIAGO, 'Tiago Silva', -3534)];
  mockPagamentos = [];
  mockRefrescar.mockReset().mockResolvedValue(undefined);
  mockAdd.mockReset().mockResolvedValue('novo');
  mockConfirm.mockReset().mockResolvedValue(undefined);
  mockRemove.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('«Já recebi» and «Já paguei» ask first', () => {
  it('the creditor’s «Já recebi» records nothing until confirmed, and nothing at all on «Cancelar»', () => {
    const alertas = espiarAlertas();
    abrirAcertar();
    fireEvent.press(screen.getByText('Já recebi'));

    expect(mockAdd).not.toHaveBeenCalled();
    expect(simples(alertas.mock.calls[0][0])).toBe('Confirmar que recebeste 35,34 € de Tiago?');
    carregarNoAlerta(alertas, 'Cancelar');
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('confirmed, it records the payment from the debtor to me', async () => {
    const alertas = espiarAlertas();
    abrirAcertar();
    fireEvent.press(screen.getByText('Já recebi'));
    carregarNoAlerta(alertas, 'Recebi');

    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('s1', RUI, 3534, TIAGO, 'pedido-1'));
    await waitFor(() => expect(mockRefrescar).toHaveBeenCalled());
  });

  it('the debtor’s «Já paguei» asks too', async () => {
    definirUtilizador(TIAGO);
    const alertas = espiarAlertas();
    abrirAcertar();
    fireEvent.press(screen.getByText('Já paguei'));

    expect(simples(alertas.mock.calls[0][0])).toBe('Confirmar que pagaste 35,34 € a Rui?');
    expect(mockAdd).not.toHaveBeenCalled();
    carregarNoAlerta(alertas, 'Paguei');
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('s1', RUI, 3534, TIAGO, 'pedido-1'));
  });
});

describe('«Pagamentos»', () => {
  it('the debtor sees the confirmed payment, with «Desfazer»', async () => {
    definirUtilizador(TIAGO);
    mockSaldos = [saldo(RUI, 'Rui Costa', 0), saldo(TIAGO, 'Tiago Silva', 0)];
    mockPagamentos = [pagamento({ confirmed: true, mine: true })];
    const alertas = espiarAlertas();
    abrirAcertar();

    // Nothing left to settle, but the payment is still there to see.
    expect(screen.queryByText('Já paguei')).toBeNull();
    expect(screen.getByText('Pagamentos')).toBeOnTheScreen();
    expect(simples(screen.getByText(/^Pagaste/).props.children)).toBe('Pagaste 35,34 € a Rui');
    expect(screen.getByText('Confirmado')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Desfazer este pagamento' }));
    expect(mockRemove).not.toHaveBeenCalled();
    carregarNoAlerta(alertas, 'Desfazer');
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('p1'));
  });

  it('the receiver can undo their confirmation within 10 minutes', () => {
    mockSaldos = [saldo(RUI, 'Rui Costa', 0), saldo(TIAGO, 'Tiago Silva', 0)];
    mockPagamentos = [
      pagamento({
        confirmed: true,
        iReceive: true,
        mine: true,
        receiverUndoUntil: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }),
    ];
    abrirAcertar();

    expect(simples(screen.getByText(/pagou-te/).props.children)).toBe('Tiago pagou-te 35,34 €');
    expect(screen.getByRole('button', { name: 'Desfazer este pagamento' })).toBeTruthy();
  });

  it('past the 10 minutes the receiver cannot undo it (the server refuses that)', () => {
    mockSaldos = [saldo(RUI, 'Rui Costa', 0), saldo(TIAGO, 'Tiago Silva', 0)];
    mockPagamentos = [
      pagamento({
        confirmed: true,
        iReceive: true,
        mine: true,
        receiverUndoUntil: new Date(Date.now() - 60 * 1000).toISOString(),
      }),
    ];
    abrirAcertar();

    expect(simples(screen.getByText(/pagou-te/).props.children)).toBe('Tiago pagou-te 35,34 €');
    expect(screen.queryByRole('button', { name: 'Desfazer este pagamento' })).toBeNull();
  });

  it('a pending payment to me: «Recebi» asks before confirming', async () => {
    mockPagamentos = [pagamento({ confirmed: false, iReceive: true, mine: true })];
    const alertas = espiarAlertas();
    abrirAcertar();

    expect(screen.getByText('Confirma que recebeste')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Recebi'));
    expect(mockConfirm).not.toHaveBeenCalled();
    carregarNoAlerta(alertas, 'Recebi');
    await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith('p1'));
  });

  it('a pending payment I made can be undone', () => {
    definirUtilizador(TIAGO);
    mockPagamentos = [pagamento({ confirmed: false, mine: true })];
    abrirAcertar();

    expect(screen.getByText('Por confirmar')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Desfazer este pagamento' })).toBeOnTheScreen();
  });

  it('someone else’s payment shows, without buttons', () => {
    definirUtilizador(ANA);
    mockSaldos = [saldo(RUI, 'Rui Costa', 0), saldo(TIAGO, 'Tiago Silva', 0), saldo(ANA, 'Ana Lopes', 0)];
    mockPagamentos = [pagamento({ confirmed: true })];
    abrirAcertar();

    expect(simples(screen.getByText(/pagou 35/).props.children)).toBe('Tiago pagou 35,34 € a Rui');
    expect(screen.queryByRole('button', { name: 'Desfazer este pagamento' })).toBeNull();
  });
});
