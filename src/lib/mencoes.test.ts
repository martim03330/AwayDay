import { describe, expect, it } from 'vitest';

import {
  inserirMencao,
  mencaoAEscrever,
  mencoesNoTexto,
  partesComMencoes,
  sugestoesDeMencao,
} from './mencoes';

const pessoas = [
  { profileId: 'a', nome: 'André Silva' },
  { profileId: 'b', nome: 'Ana' },
  { profileId: 'c', nome: 'Martim Henriques' },
];

describe('mencaoAEscrever', () => {
  it('finds the @ being typed at the end', () => {
    expect(mencaoAEscrever('olá @an')).toBe('an');
    expect(mencaoAEscrever('@')).toBe('');
  });

  it('ignores an @ already finished or inside a word', () => {
    expect(mencaoAEscrever('olá @Ana vens')).toBeNull();
    expect(mencaoAEscrever('mail@x')).toBeNull();
    expect(mencaoAEscrever('sem nada')).toBeNull();
  });
});

describe('sugestoesDeMencao', () => {
  it('matches any word of the name, without accents', () => {
    expect(sugestoesDeMencao('andre', pessoas).pessoas.map((p) => p.profileId)).toEqual(['a']);
    expect(sugestoesDeMencao('hen', pessoas).pessoas.map((p) => p.profileId)).toEqual(['c']);
    expect(sugestoesDeMencao('an', pessoas).pessoas.map((p) => p.profileId)).toEqual(['a', 'b']);
  });

  it('offers @todos while it fits', () => {
    expect(sugestoesDeMencao('', pessoas).todos).toBe(true);
    expect(sugestoesDeMencao('to', pessoas).todos).toBe(true);
    expect(sugestoesDeMencao('an', pessoas).todos).toBe(false);
  });
});

describe('inserirMencao', () => {
  it('replaces what was typed by the full name and a space', () => {
    expect(inserirMencao('olá @mar', 'Martim Henriques')).toBe('olá @Martim Henriques ');
    expect(inserirMencao('@', 'todos')).toBe('@todos ');
  });
});

describe('mencoesNoTexto', () => {
  it('finds the people and @todos', () => {
    expect(mencoesNoTexto('@Martim Henriques e @Ana, bora? @todos', pessoas)).toEqual({
      todos: true,
      ids: ['b', 'c'],
    });
  });

  it('needs the name to end there: «@Anabela» is not Ana', () => {
    expect(mencoesNoTexto('@Anabela vem', pessoas)).toEqual({ todos: false, ids: [] });
  });

  it('prefers the longest name', () => {
    const parecidas = [
      { profileId: 'x', nome: 'Ana' },
      { profileId: 'y', nome: 'Ana Rita' },
    ];
    expect(mencoesNoTexto('@Ana Rita vens?', parecidas).ids).toEqual(['y']);
  });
});

describe('partesComMencoes', () => {
  it('splits the mentions apart', () => {
    expect(partesComMencoes('olá @Ana e @todos!', ['Ana'])).toEqual([
      { texto: 'olá ', mencao: false },
      { texto: '@Ana', mencao: true },
      { texto: ' e ', mencao: false },
      { texto: '@todos', mencao: true },
      { texto: '!', mencao: false },
    ]);
  });

  it('leaves a text without mentions whole', () => {
    expect(partesComMencoes('sem nada', ['Ana'])).toEqual([{ texto: 'sem nada', mencao: false }]);
  });
});
