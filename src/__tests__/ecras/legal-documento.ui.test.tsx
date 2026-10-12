// The legal screen lives in src/app (a route); its test lives here so Expo Router never picks the test up as a page.
import { render, screen } from '@testing-library/react-native';

import DocumentoLegalScreen from '@/app/legal/[documento]';
import { DOCUMENTOS_LEGAIS, RESPONSAVEL } from '@/lib/legal';

let mockParams: { documento?: string } = {};
const mockTitulos: string[] = [];
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
  useSegments: () => [],
  Stack: {
    Screen: ({ options }: { options?: { title?: string } }) => {
      if (options?.title) mockTitulos.push(options.title);
      return null;
    },
  },
}));

beforeEach(() => {
  mockTitulos.length = 0;
});

describe.each(DOCUMENTOS_LEGAIS.map((doc) => [doc.id, doc] as const))('legal document «%s»', (id, doc) => {
  beforeEach(() => {
    mockParams = { documento: id };
  });

  it('sets the screen title and shows the title as a heading, the summary and the date', () => {
    render(<DocumentoLegalScreen />);
    expect(mockTitulos).toContain(doc.titulo);
    expect(screen.getByRole('header', { name: doc.titulo })).toBeOnTheScreen();
    expect(screen.getByText(doc.resumo)).toBeOnTheScreen();
    expect(screen.getByText(`Atualizado a ${doc.atualizadoEm}`)).toBeOnTheScreen();
  });

  it('shows every section as a heading, and every paragraph and list item', () => {
    render(<DocumentoLegalScreen />);
    for (const seccao of doc.seccoes) {
      expect(screen.getByRole('header', { name: seccao.titulo })).toBeOnTheScreen();
      for (const bloco of seccao.blocos) {
        const textos = bloco.tipo === 'paragrafo' ? [bloco.texto] : bloco.itens;
        for (const texto of textos) expect(screen.getAllByText(texto).length).toBeGreaterThan(0);
      }
    }
  });

  it('renders without React warnings (e.g. two sections or items with the same key)', () => {
    const erros = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<DocumentoLegalScreen />);
    expect(erros).not.toHaveBeenCalled();
    erros.mockRestore();
  });

  it('never shows «null» or «undefined» (e.g. a missing address)', () => {
    render(<DocumentoLegalScreen />);
    expect(screen.queryByText(/\bnull\b|\bundefined\b/)).toBeNull();
  });
});

describe('legal document: about and contacts', () => {
  it('names who is responsible and the email, and an address only when there is one', () => {
    mockParams = { documento: 'sobre' };
    render(<DocumentoLegalScreen />);
    expect(screen.getByText(`Nome: ${RESPONSAVEL.nome}`)).toBeOnTheScreen();
    expect(screen.getByText(`Email: ${RESPONSAVEL.email}`)).toBeOnTheScreen();
    if (RESPONSAVEL.morada) expect(screen.getByText(`Morada: ${RESPONSAVEL.morada}`)).toBeOnTheScreen();
    else expect(screen.queryByText(/^Morada:/)).toBeNull();
  });
});

describe('legal document: unknown or missing id', () => {
  it.each([['nao-existe'], [undefined], ['']])('%s shows the empty state, not a crash', (documento) => {
    mockParams = documento === undefined ? {} : { documento };
    render(<DocumentoLegalScreen />);
    expect(mockTitulos).toContain('Documento');
    expect(screen.getByRole('header', { name: 'Não encontrámos este documento' })).toBeOnTheScreen();
    expect(screen.getByText('Fecha e tenta outra vez.')).toBeOnTheScreen();
  });
});
