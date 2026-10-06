import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { EscolherConcelho } from '@/components/escolher-concelho';
import type { Municipality } from '@/features/profile/types';

function concelho(id: string, name: string, district: string): Municipality {
  const region = district === 'Madeira' ? 'madeira' : district === 'Açores' ? 'azores' : 'mainland';
  return { id, name, district, region, latitude: 0, longitude: 0 };
}

const MUNICIPIOS: Municipality[] = [
  concelho('ponta-delgada', 'Ponta Delgada', 'Açores'),
  concelho('funchal', 'Funchal', 'Madeira'),
  concelho('sintra', 'Sintra', 'Lisboa'),
  concelho('lisboa', 'Lisboa', 'Lisboa'),
  concelho('amadora', 'Amadora', 'Lisboa'),
  concelho('evora', 'Évora', 'Évora'),
  concelho('braga', 'Braga', 'Braga'),
  concelho('aveiro', 'Aveiro', 'Aveiro'),
];

function nomesDosBotoes() {
  return screen.getAllByRole('button').map((botao) => within(botao).queryAllByText(/.+/)[0]?.props.children);
}

describe('EscolherConcelho', () => {
  it('with nothing chosen, starts on the districts: mainland alphabetical (Évora in its place), then the islands', () => {
    render(<EscolherConcelho municipios={MUNICIPIOS} valor={null} onChange={jest.fn()} />);
    expect(screen.getByText('Primeiro o distrito')).toBeOnTheScreen();
    expect(nomesDosBotoes()).toEqual(['Aveiro', 'Braga', 'Évora', 'Lisboa', 'Açores', 'Madeira']);
    for (const botao of screen.getAllByRole('button')) expect(botao).not.toBeSelected();
  });

  it('district then concelho: the concelhos of that district only, sorted, and the choice goes out', () => {
    const onChange = jest.fn();
    render(<EscolherConcelho municipios={MUNICIPIOS} valor={null} onChange={onChange} />);
    fireEvent.press(screen.getByRole('button', { name: 'Lisboa' }));

    expect(screen.queryByText('Primeiro o distrito')).toBeNull();
    const voltar = screen.getByRole('button', { name: 'Lisboa. Toca para escolher outro distrito.' });
    expect(voltar).toBeOnTheScreen();
    const concelhos = screen.getAllByRole('button').filter((botao) => botao !== voltar);
    expect(concelhos.map((botao) => within(botao).getByText(/.+/).props.children)).toEqual([
      'Amadora',
      'Lisboa',
      'Sintra',
    ]);
    expect(screen.queryByText('Funchal')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Sintra' }));
    expect(onChange).toHaveBeenCalledWith('sintra');
  });

  it('the district name on top goes back to the full list', () => {
    render(<EscolherConcelho municipios={MUNICIPIOS} valor={null} onChange={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Madeira' }));
    fireEvent.press(screen.getByRole('button', { name: 'Madeira. Toca para escolher outro distrito.' }));
    expect(screen.getByText('Primeiro o distrito')).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('with a concelho already chosen, opens on its district with it selected', () => {
    render(<EscolherConcelho municipios={MUNICIPIOS} valor="funchal" onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Madeira. Toca para escolher outro distrito.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Funchal' })).toBeSelected();
  });

  it('going back from a chosen concelho marks its district as selected', () => {
    render(<EscolherConcelho municipios={MUNICIPIOS} valor="evora" onChange={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Évora. Toca para escolher outro distrito.' }));
    expect(screen.getByRole('button', { name: 'Évora' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Lisboa' })).not.toBeSelected();
  });

  it('an unknown chosen id (e.g. a concelho list not loaded yet) starts on the districts', () => {
    render(<EscolherConcelho municipios={MUNICIPIOS} valor="nao-existe" onChange={jest.fn()} />);
    expect(screen.getByText('Primeiro o distrito')).toBeOnTheScreen();
  });

  it('with no concelhos at all, shows only the heading and no buttons', () => {
    render(<EscolherConcelho municipios={[]} valor={null} onChange={jest.fn()} />);
    expect(screen.getByText('Primeiro o distrito')).toBeOnTheScreen();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
