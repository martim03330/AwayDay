import { act, renderHook } from '@testing-library/react-native';

import { usePuxarParaAtualizar } from '@/hooks/use-puxar-para-atualizar';

describe('usePuxarParaAtualizar', () => {
  it('shows the spinner only while the pull is in flight', async () => {
    let acabar: () => void = () => undefined;
    const refrescar = jest.fn(() => new Promise<void>((resolve) => (acabar = resolve)));
    const { result } = renderHook(() => usePuxarParaAtualizar(refrescar));

    expect(result.current.refreshing).toBe(false);
    act(() => result.current.onRefresh());
    expect(result.current.refreshing).toBe(true);
    expect(refrescar).toHaveBeenCalledTimes(1);

    await act(async () => acabar());
    expect(result.current.refreshing).toBe(false);
  });

  it('stops the spinner when the refresh fails', async () => {
    const { result } = renderHook(() => usePuxarParaAtualizar(() => Promise.reject(new Error('sem rede'))));

    await act(async () => result.current.onRefresh());
    expect(result.current.refreshing).toBe(false);
  });
});
