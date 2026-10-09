@AGENTS.md

# CLAUDE.md

Regras do projeto. Lê isto antes de qualquer alteração.

## Projeto

App móvel para adeptos de futebol em dia de jogo: lista de jogos, ficha do estádio,
locais à volta avaliados pelos utilizadores, boleias com partilha de custos e divisão
de despesas de grupo. Mercado: Portugal. UI em português de Portugal.

## Stack

- Expo SDK 57 + React Native 0.86 + TypeScript 6 `strict`
- Expo Router (navegação por ficheiros)
- TanStack Query (dados de servidor) + Zustand (estado local de UI)
- Supabase: Postgres + PostGIS, Auth, Realtime, Storage, Edge Functions (Deno)
- Testes: Vitest (lógica pura) + Jest com Testing Library (`*.ui.test.tsx`) + SQL (`supabase/tests`) + Maestro (e2e)

## Comandos

```bash
npx expo start --clear              # dev (sempre --clear: o repo está no Desktop do iCloud)
npm run check                       # typecheck + lint + vitest + jest (tudo antes de um commit)
npm run test:sql                    # testes SQL contra o projeto ligado (cada um numa transação desfeita)
npm run test:e2e                    # Maestro, no simulador
# Supabase: projeto REMOTO ligado (--linked). Sem Docker: nada de `supabase start` nem `db reset`.
# Migração nova: criar supabase/migrations/<AAAAMMDDHHMMSS>_<nome>.sql à mão (`migration new` é lento).
supabase db push                    # aplica as migrações novas
npm run db:types                    # regenera src/lib/database.types.ts
```

Lições:
- Nunca `db reset` nem SQL destrutivo com `--linked`: é a base de dados de produção.
- Depois de `git stash`/`reset`, procurar cópias do iCloud: `git status --untracked-files=all | grep " 2\."`.
- Só `supabase/functions/sync-weather` tem `deno.lock` no repositório; não criar outros.
- `docs/DECISOES.md` é grande: procurar com grep, não ler inteiro.

## Estrutura

```
app/                 ecrãs (Expo Router). Só composição, sem lógica de negócio.
src/features/<x>/    api.ts · hooks/ · components/ · types.ts
src/lib/             supabase.ts · money.ts · geo.ts · format.ts
src/ui/              componentes base reutilizáveis
supabase/migrations/ SQL versionado
supabase/functions/  edge functions
docs/DECISOES.md     registo de decisões estruturais
```

Uma feature nunca importa de dentro de outra feature. Partilha via `src/lib` ou `src/ui`.

## Regras invioláveis

1. **Dinheiro é sempre `number` inteiro em cêntimos.** Nunca floats, nunca `parseFloat`
   em valores monetários. Toda a aritmética passa por `src/lib/money.ts`.
2. **Datas em UTC** (`timestamptz` na BD, ISO no cliente). Apresentação sempre em
   `Europe/Lisbon`. Nunca guardar horas locais.
3. **Nenhuma chave de API de terceiros no cliente.** Chamadas a APIs externas (jogos,
   mapas, meteorologia) só em Edge Functions, com cache em Postgres.
4. **Toda a tabela nova nasce com RLS ativo** e políticas explícitas na mesma migração.
   Sem política = a tabela não é acessível. Nada de `service_role` no cliente.
5. **Alterações de esquema só por migração** em `supabase/migrations/`. Nunca alterar a
   BD à mão nem editar uma migração já aplicada — cria uma nova.
6. **Valores calculados são calculados no servidor.** Custo de boleia, saldos e acertos
   nunca vêm do cliente.
7. **Sem dependências novas sem perguntar primeiro.** Se precisares de uma, propõe e
   espera resposta.
8. **Sem `any`.** Tipos da BD vêm de `src/lib/database.types.ts` (gerados).

## Privacidade (não negociável)

- Localização individual nunca é exposta a outro utilizador, em nenhum endpoint.
- O mapa lê agregados (`place_pulse`), nunca a tabela `checkin`.
- Um agregado só é publicado com ≥ 5 pessoas; a repartição por clube tem o mesmo mínimo
  por clube, e os restantes vão para "outros".
- Check-ins expiram automaticamente e são apagados às 48h.
- Qualquer código que leia `checkin` corre em Edge Function, nunca no cliente.

## Testes obrigatórios

Estas três coisas nunca entram sem testes, incluindo casos limite e arredondamentos:

- `src/lib/money.ts`
- cálculo do custo da boleia
- algoritmo de acerto de contas (settle-up)

São os sítios onde um bug custa dinheiro real a pessoas reais.

## Como trabalhar

- Antes de escrever código para uma feature nova: **propõe um plano e espera aprovação**.
- Ordem de implementação: migração SQL → tipos gerados → `api.ts` → hooks → UI.
- Uma feature slice por sessão. Não alterar ficheiros fora do âmbito pedido.
- Código, nomes de variáveis, tabelas e comentários em inglês. Texto visível ao utilizador
  em português de Portugal (sem "você", sem português do Brasil).
- Cada decisão estrutural fica registada em `docs/DECISOES.md` com data e razão.

## Não tocar

- `supabase/migrations/` já aplicadas
- `src/lib/database.types.ts` (é gerado — regenera, não edites)
- ficheiros de configuração do Expo (`app.json`, `eas.json`) sem pedir

## Skills

A base de skills para desenvolvimento, com quando usar cada uma, está em `docs/SKILLS.md`.

### Task Observer

Usa a skill task-observer só quando o utilizador pedir uma revisão das skills ou corrigir a forma de trabalhar
(«não faças assim», «faz sempre…»). O registo fica em `skill-observations/` (fora do Git).

Escolhe as skills pela decisão que o pedido envolve, não pelo formato em que chegou.
