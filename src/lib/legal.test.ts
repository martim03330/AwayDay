import { describe, expect, it } from 'vitest';

import { DOCUMENTOS_LEGAIS, IDADE_MINIMA, RESPONSAVEL, VERSAO_DOS_TERMOS } from '@/lib/legal';

const textoDe = (id: string) => {
  const doc = DOCUMENTOS_LEGAIS.find((candidato) => candidato.id === id);
  if (!doc) throw new Error(`missing ${id}`);
  return doc.seccoes
    .flatMap((seccao) => [seccao.titulo, ...seccao.blocos.flatMap((b) => (b.tipo === 'paragrafo' ? [b.texto] : b.itens))])
    .join('\n');
};

describe('documentos legais', () => {
  it('has the privacy policy, the terms and the about page', () => {
    expect(DOCUMENTOS_LEGAIS.map((doc) => doc.id)).toEqual(['privacidade', 'termos', 'sobre']);
  });

  it('every document names who is responsible and how to reach them', () => {
    for (const doc of DOCUMENTOS_LEGAIS) {
      const texto = textoDe(doc.id);
      expect(texto).toContain(RESPONSAVEL.nome);
      expect(texto).toContain(RESPONSAVEL.email);
    }
  });

  it('has no leftover placeholders', () => {
    for (const doc of DOCUMENTOS_LEGAIS) {
      expect(textoDe(doc.id)).not.toMatch(/\bTODO\b|\bXXX\b|\[[^\]]*\]|lorem ipsum/);
    }
  });

  it('privacy policy says where to complain and the minimum age', () => {
    const texto = textoDe('privacidade');
    expect(texto).toContain('CNPD');
    expect(texto).toContain(`${IDADE_MINIMA} anos`);
  });

  it('terms say the app takes no money and rides only share costs', () => {
    const texto = textoDe('termos');
    expect(texto).toMatch(/não processa pagamentos/);
    expect(texto).toMatch(/partilhar os custos/);
  });

  it('the terms version is a date', () => {
    expect(VERSAO_DOS_TERMOS).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
