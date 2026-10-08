import { describe, expect, it } from 'vitest';

import {
  conviteDoCartao,
  deOutroGrupo,
  origemDoPlano,
  rotuloDeOutroGrupo,
} from '@/features/groups/partilha';

const plano = { groupId: 'malta', groupName: 'Malta do café' };

describe('deOutroGrupo', () => {
  it('is true only when shown outside its own group', () => {
    expect(deOutroGrupo(plano, 'primos')).toBe(true);
    expect(deOutroGrupo(plano, 'malta')).toBe(false);
    expect(deOutroGrupo(plano, null)).toBe(false);
  });
});

describe('conviteDoCartao', () => {
  it("says who invites, as before, in the plan's own group", () => {
    expect(conviteDoCartao('Ana', plano, 'malta')).toBe('Ana convida');
    expect(conviteDoCartao(undefined, plano, 'malta')).toBe('Convite para o jogo');
  });

  it('names the home group when the plan was sent here', () => {
    expect(conviteDoCartao('Ana', plano, 'primos')).toBe('Ana · Malta do café convida');
    expect(conviteDoCartao(undefined, plano, 'primos')).toBe('Convite de Malta do café');
  });

  it('keeps «Convidaste a malta» for who invited, wherever it shows', () => {
    expect(conviteDoCartao('eu', plano, 'primos')).toBe('Convidaste a malta');
  });
});

describe('origemDoPlano', () => {
  it('explains a plan from another group', () => {
    expect(origemDoPlano(plano, 'primos')).toBe('Plano de «Malta do café», aberto a este grupo');
  });

  it("says nothing in the plan's own group", () => {
    expect(origemDoPlano(plano, 'malta')).toBeNull();
  });
});

describe('rotuloDeOutroGrupo', () => {
  it("labels a car or a house that is another group's", () => {
    expect(rotuloDeOutroGrupo('boleia', 'Malta do café')).toBe('Boleia de «Malta do café», aberta ao teu grupo');
    expect(rotuloDeOutroGrupo('casa', 'Malta do café')).toBe('Casa de «Malta do café», aberta ao teu grupo');
  });
});
