import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { CartaoDoPlano } from '@/features/groups/components/CartaoDoPlano';
import type { FixturePlan } from '@/features/groups/plans';
import { AvisoDeConversa } from '@/ui/conversa';

const PLANO: FixturePlan = {
  id: 'plano-1',
  groupId: 'malta',
  groupName: 'Malta do café',
  fixtureId: 'jogo-que-nao-existe',
  kickoffAt: '2026-10-13T16:45:00.000Z',
  createdBy: 'ana',
  creatorName: 'Ana Ribeiro',
  isMine: false,
  status: 'aberto',
  closedByFullCar: false,
  going: 2,
  maybe: 0,
  myAnswer: null,
  sharedGroups: 1,
  ride: null,
  stay: null,
};

// The card answers optimistically through the query cache.
function comCache(elemento: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{elemento}</QueryClientProvider>;
}

describe('CartaoDoPlano, for a plan sent to another group', () => {
  it('in the group that received it, says which group it comes from', () => {
    render(comCache(<CartaoDoPlano plano={PLANO} quemConvidou="Ana" grupoAtualId="primos" onAbrir={() => undefined} />));
    expect(screen.getByText('Ana · Malta do café convida')).toBeTruthy();
    expect(screen.getByText('Convite da malta do «Malta do café»')).toBeTruthy();
  });

  it('in its own group, stays as it was', () => {
    render(comCache(<CartaoDoPlano plano={PLANO} quemConvidou="Ana" grupoAtualId="malta" onAbrir={() => undefined} />));
    expect(screen.getByText('Ana convida')).toBeTruthy();
    expect(screen.queryByText(/Convite da malta/)).toBeNull();
  });
});

describe('AvisoDeConversa', () => {
  it('shows the notice in full and reads it as a notice', () => {
    const texto = 'Ana mandou o plano Lens x Sporting ao grupo «Primos da bola». Eles veem a boleia e a casa e podem pedir lugar.';
    render(<AvisoDeConversa texto={texto} />);
    expect(screen.getByText(texto)).toBeTruthy();
    expect(screen.getByLabelText(`Aviso: ${texto}`)).toBeTruthy();
  });
});
