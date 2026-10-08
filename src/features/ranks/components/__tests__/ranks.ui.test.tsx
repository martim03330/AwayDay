import { fireEvent, render, screen } from '@testing-library/react-native';

import { CartaoDivisao } from '@/features/ranks/components/CartaoDivisao';
import { CartaoNivel } from '@/features/ranks/components/CartaoNivel';
import { iconeDaMissao, LinhaMissao } from '@/features/ranks/components/LinhaMissao';
import { TabelaRanking, type LinhaTabela } from '@/features/ranks/components/TabelaRanking';
import type { Mission, MyRanking } from '@/features/ranks/types';
import { icons } from '@/ui/icon';

function missao(mudancas: Partial<Mission> = {}): Mission {
  return {
    id: 'm1',
    kind: 'weekly',
    family: 'tasco',
    tier: null,
    metric: 'tasco',
    needsProofPhoto: false,
    target: 3,
    xp: 50,
    title: 'Vai a três tascos',
    description: 'Antes do jogo.',
    badge: null,
    icon: 'tasco',
    proofHint: null,
    sort: 1,
    weekStart: '2026-10-05',
    progress: 1,
    completedAt: null,
    ...mudancas,
  };
}

function ranking(mudancas: Partial<MyRanking> = {}): MyRanking {
  return {
    totalXp: 1200,
    level: 7,
    levelXp: 1000,
    nextLevelXp: 1500,
    seasonId: 's1',
    seasonXp: 300,
    division: 3,
    divisionMovement: 0,
    divisionPosition: 10,
    divisionSize: 30,
    promotionSpots: 3,
    relegationSpots: 3,
    promotionMinXp: 100,
    streakWeeks: 2,
    bestStreakWeeks: 4,
    stadiums: 5,
    stadiumVisits: 9,
    showInRankings: true,
    ...mudancas,
  };
}

describe('LinhaMissao', () => {
  it('an open mission is one element read with progress and points', () => {
    render(<LinhaMissao missao={missao()} />);
    expect(screen.getByLabelText('Vai a três tascos. 1 de 3. Mais 50 pontos.')).toBeOnTheScreen();
    expect(screen.getByText('1 de 3', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a done mission is read as «Feito» and hides the progress', () => {
    render(<LinhaMissao missao={missao({ progress: 3, completedAt: '2026-10-06T12:00:00Z' })} />);
    expect(screen.getByLabelText('Vai a três tascos. Feito. Mais 50 pontos.')).toBeOnTheScreen();
    expect(screen.queryByText('3 de 3', { includeHiddenElements: true })).toBeNull();
  });

  it('a one-step mission shows no «0 de 1»', () => {
    render(<LinhaMissao missao={missao({ target: 1, progress: 0 })} />);
    expect(screen.queryByText('0 de 1', { includeHiddenElements: true })).toBeNull();
  });

  it('with a handler, tapping the row opens how to do it and a button that goes there', () => {
    const onAcao = jest.fn();
    render(<LinhaMissao missao={missao()} onAcao={onAcao} />);
    expect(screen.queryByText('Ver tascos perto')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Vai a três tascos. 1 de 3. Mais 50 pontos. Toca para ver como fazer.' }));
    expect(screen.getByText('Abre em Locais o tasco onde estás.')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Ver tascos perto'));
    expect(onAcao).toHaveBeenCalledWith('ver-tascos');
  });

  it('the photo with a rival opens the camera from its guide, not from a button in the list', () => {
    const onAcao = jest.fn();
    render(<LinhaMissao missao={missao({ metric: 'proof_photo', needsProofPhoto: true, target: 1, progress: 0 })} onAcao={onAcao} />);
    expect(screen.queryByText('Abrir a câmara')).toBeNull();
    fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('Pede primeiro. Cada um com a sua camisola, lado a lado e sem contacto.')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Abrir a câmara'));
    expect(onAcao).toHaveBeenCalledWith('abrir-camara');
  });

  it('a done mission opens to say it is done, with no action', () => {
    render(<LinhaMissao missao={missao({ progress: 3, completedAt: '2026-10-06T12:00:00Z' })} onAcao={jest.fn()} />);
    fireEvent.press(screen.getByRole('button'));
    expect(screen.getByText('Feita. Os pontos já estão no teu ranking.')).toBeOnTheScreen();
    expect(screen.queryByText('Ver tascos perto')).toBeNull();
  });

  it('without a handler (no account, demo) the row is read-only', () => {
    render(<LinhaMissao missao={missao({ needsProofPhoto: true })} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('an unknown icon name falls back to the mission icon', () => {
    expect(iconeDaMissao('nao-existe')).toBe(icons.missao);
    expect(iconeDaMissao('carro')).toBe('carro');
    // Inherited object keys are not icons.
    expect(iconeDaMissao('toString')).toBe(icons.missao);
  });
});

describe('TabelaRanking', () => {
  const linha = (posicao: number, nome: string, sou = false): LinhaTabela => ({
    chave: `${posicao}-${nome}`,
    posicao,
    nome,
    detalhe: 'Nível 7',
    valor: `${1000 - posicao} pts`,
    sou,
  });

  it('empty: shows the given message', () => {
    render(<TabelaRanking linhas={[]} vazio="Ainda ninguém pontuou." />);
    expect(screen.getByText('Ainda ninguém pontuou.')).toBeOnTheScreen();
  });

  it('each line is read as one element; your own says «tu» and is marked', () => {
    render(
      <TabelaRanking
        linhas={[linha(1, 'Ana'), linha(2, 'Rui Costa', true), linha(3, 'Zé')]}
        vazio="-"
      />
    );
    expect(screen.getByLabelText('1.º, Ana, 999 pts, Nível 7')).toBeOnTheScreen();
    const minha = screen.getByLabelText('2.º, tu, 998 pts, Nível 7');
    expect(minha).toBeOnTheScreen();
    expect(screen.getByText('Rui Costa (tu)', { includeHiddenElements: true })).toBeOnTheScreen();
    // Highlighted with a background; the others have none.
    expect(minha).toHaveStyle({ borderRadius: 12 });
    expect(screen.getByLabelText('1.º, Ana, 999 pts, Nível 7')).not.toHaveStyle({ borderRadius: 12 });
  });

  it('a gap in positions (you outside the top) shows «⋯» once, and only there', () => {
    render(
      <TabelaRanking
        linhas={[linha(1, 'Ana'), linha(2, 'Bia'), linha(3, 'Carla'), linha(57, 'Rui', true)]}
        vazio="-"
      />
    );
    expect(screen.getAllByText('⋯', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByLabelText('57.º, tu, 943 pts, Nível 7')).toBeOnTheScreen();
  });

  it('no gap when positions follow on, and ties do not count as a gap', () => {
    render(
      <TabelaRanking linhas={[linha(1, 'Ana'), linha(2, 'Bia'), linha(2, 'Carla'), linha(3, 'Rui', true)]} vazio="-" />
    );
    expect(screen.queryByText('⋯', { includeHiddenElements: true })).toBeNull();
  });
});

describe('CartaoDivisao', () => {
  it('promotion zone', () => {
    render(<CartaoDivisao ranking={ranking({ divisionPosition: 2 })} />);
    expect(screen.getByLabelText('Zona de subida')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Zona de descida')).toBeNull();
    expect(
      screen.getByText('Zona de subida: se a época acabasse hoje, subias de divisão.', { includeHiddenElements: true })
    ).toBeOnTheScreen();
  });

  it('top of the table but under the minimum points: not promotion', () => {
    render(<CartaoDivisao ranking={ranking({ divisionPosition: 1, seasonXp: 50 })} />);
    expect(screen.queryByLabelText('Zona de subida')).toBeNull();
  });

  it('relegation zone with points', () => {
    render(<CartaoDivisao ranking={ranking({ divisionPosition: 29 })} />);
    expect(screen.getByLabelText('Zona de descida')).toBeOnTheScreen();
    expect(
      screen.getByText('Zona de descida: se a época acabasse hoje, descias. Ainda vais a tempo.', {
        includeHiddenElements: true,
      })
    ).toBeOnTheScreen();
  });

  it('no points this season: relegation, with the encouraging text', () => {
    render(<CartaoDivisao ranking={ranking({ seasonXp: 0, divisionPosition: 1 })} />);
    expect(screen.getByLabelText('Zona de descida')).toBeOnTheScreen();
    expect(
      screen.getByText('Sem pontos esta época, desces de divisão. Basta um jogo para saíres daqui.', {
        includeHiddenElements: true,
      })
    ).toBeOnTheScreen();
  });

  it('bottom division with no points: nowhere to drop, no relegation', () => {
    render(<CartaoDivisao ranking={ranking({ division: 5, seasonXp: 0 })} />);
    expect(screen.queryByLabelText('Zona de descida')).toBeNull();
    expect(screen.getByText('Distrital', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('top division, mid table: hold your place, never a promotion zone', () => {
    render(<CartaoDivisao ranking={ranking({ division: 1, divisionPosition: 1 })} />);
    expect(screen.queryByLabelText('Zona de subida')).toBeNull();
    expect(
      screen.getByText('Estás na divisão de topo. Agora é segurar o lugar.', { includeHiddenElements: true })
    ).toBeOnTheScreen();
  });

  it.each([
    [0, 'No fim da época sobem os primeiros com pelo menos 100 pontos.'],
    [1, 'No fim da época sobe o primeiro, se tiver pelo menos 100 pontos.'],
    [3, 'No fim da época sobem os 3 primeiros com pelo menos 100 pontos.'],
  ])('mid table with %i promotion spots explains the rule', (promotionSpots, texto) => {
    render(<CartaoDivisao ranking={ranking({ promotionSpots, divisionPosition: 10 })} />);
    expect(screen.getByText(texto, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('last season movement tags', () => {
    const { rerender } = render(<CartaoDivisao ranking={ranking({ divisionMovement: 1 })} />);
    expect(screen.getByLabelText('Subiste na época passada')).toBeOnTheScreen();
    rerender(<CartaoDivisao ranking={ranking({ divisionMovement: -1 })} />);
    expect(screen.getByLabelText('Desceste na época passada')).toBeOnTheScreen();
    rerender(<CartaoDivisao ranking={ranking({ divisionMovement: 0 })} />);
    expect(screen.queryByLabelText(/época passada/)).toBeNull();
  });

  it('with an action, the whole card is one button that says where you stand', () => {
    const onPress = jest.fn();
    render(<CartaoDivisao ranking={ranking({ divisionPosition: 2 })} onPress={onPress} />);
    const botao = screen.getByRole('button', {
      name: 'Divisão Liga 3, 2.º de 30. Zona de subida: se a época acabasse hoje, subias de divisão.',
    });
    fireEvent.press(botao);
    expect(onPress).toHaveBeenCalled();
  });
});

describe('CartaoNivel', () => {
  it('shows level, title, the way to the next level and the season numbers', () => {
    render(<CartaoNivel ranking={ranking()} />);
    expect(screen.getByLabelText('Nível 7')).toBeOnTheScreen();
    expect(screen.getByText('Adepto')).toBeOnTheScreen();
    expect(screen.getByText(/Faltam 300 pontos para o nível 8 · Habitual no nível 10/)).toBeOnTheScreen();
    expect(screen.getByLabelText('300 pontos esta época')).toBeOnTheScreen();
    expect(screen.getByLabelText('2 jornadas seguidas')).toBeOnTheScreen();
    expect(screen.getByLabelText('5 estádios carimbados')).toBeOnTheScreen();
  });

  it('singulars', () => {
    render(<CartaoNivel ranking={ranking({ streakWeeks: 1, stadiums: 1 })} />);
    expect(screen.getByLabelText('1 jornada seguida')).toBeOnTheScreen();
    expect(screen.getByLabelText('1 estádio carimbado')).toBeOnTheScreen();
  });

  it('max level', () => {
    render(<CartaoNivel ranking={ranking({ level: 99 })} />);
    expect(screen.getByText('Nível máximo. Não há mais nada a provar.')).toBeOnTheScreen();
  });

  it('never says a negative number of points to go', () => {
    render(<CartaoNivel ranking={ranking({ totalXp: 2000, nextLevelXp: 1500 })} />);
    expect(screen.getByText(/Faltam 0 pontos/)).toBeOnTheScreen();
  });
});
