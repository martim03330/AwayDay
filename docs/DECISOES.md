# Decisões

Registo das decisões estruturais, com data e razão. A mais recente fica em cima.

## 2026-09-13 — Supabase: jogos e estádios

**Projeto alojado em vez de stack local.** O projeto `cskgcyroztazjhqqzkoh` já existia e a máquina
não tem Docker. As migrações vão com `supabase db push` e o seed com `--include-seed`. O
`supabase start` continua possível no futuro sem mudar nada no repositório.

**Ids em texto (slugs) em `competition`, `venue`, `club` e `fixture`.** Os ecrãs, os deep links, o
modo demo e tudo o que continua em mocks (tascos, WC, visitas, avaliações, álbum) referem estes
registos por `'luz'`, `'benfica-moreirense'`, etc. Mudar para uuid obrigava a mexer em tudo isso
nesta sessão. `fixture.external_id` fica reservado para a sincronização com a API de jogos.

**Coordenadas.** A fonte é `venue.location` (`geography(Point, 4326)`, com índice GIST). `latitude`
e `longitude` são colunas geradas, para aparecerem nos tipos gerados e serem lidas com a mesma
RLS, sem views nem funções.

**Leitura pública, escrita nenhuma.** RLS ativa nas quatro tabelas, só com políticas de `select`
para `anon` e `authenticated`. Por segurança extra, o `insert`/`update`/`delete`/`truncate` é
revogado a esses papéis.

**O que não está na base de dados continua em mocks, junto por id.** Meteorologia, pontos de
encontro, transportes, sombra, abrigo, fotos e adeptos na app vivem em `src/mocks/extras-*.ts`.
Uma linha da base de dados sem estes dados (por exemplo, um jogo novo sem meteorologia) fica de fora
do catálogo em vez de rebentar, e aparece em `skipped`.

**A UI não muda: camada de compatibilidade.** `src/mocks/jogos.ts`, `estadios.ts` e `clubes.ts`
mantêm os mesmos exports e tipos, mas passam a ler de `src/features/fixtures/store.ts`, que preenche
os arrays no sítio. A única alteração fora dos dados é o provider em `src/app/_layout.tsx`.

**Cache.** TanStack Query com a cache persistida em AsyncStorage (7 dias, com `buster` para
invalidar quando o formato muda). A app só desenha depois de restaurar a cache, por isso abre com
dados. A revalidação em fundo guarda os dados novos e estes são aplicados **no arranque seguinte**:
os ecrãs leem os dados de forma síncrona e o React Compiler memoriza o que calculam, por isso trocar
os dados com um ecrã aberto deixava partes da UI desatualizadas.

**Catálogo embutido.** `src/features/fixtures/snapshot.ts` é usado na primeira abertura (antes de
haver resposta) e sem rede, e é também a fonte do seed (`npm run db:seed`). Assim, com ou sem rede,
os dados são os mesmos.

**Datas fixas.** Os mocks calculavam as datas a partir de hoje; numa base de dados alojada isso não
é possível. O snapshot e o seed foram gerados a 2026-09-13 e as horas ficam fixas. O modo demo
continua a funcionar porque simula a hora a partir da hora do jogo. Para renovar as datas, edita o
snapshot, corre `npm run db:seed` e faz `supabase db push --include-seed` (o seed faz upsert).

### Por confirmar

- **Capacidades e coordenadas dos 34 estádios** vêm dos mocks e são aproximadas. O pedido §2.4 prefere
  NULL a valores errados, mas os tipos atuais e o mapa precisam deles. Conferir estádio a estádio
  antes de sair da demo.
- **`venue.address`** está a NULL em todos.
- **Preços dos transportes** continuam em euros com casas decimais nos mocks. Quando passarem para a
  base de dados, têm de ser cêntimos inteiros (regra 1).

### Limitações conhecidas

- Alguns módulos calculam listas logo ao carregar (`locais/index.tsx`, `lista-clube-terra.tsx`,
  `modo-demo-card.tsx`, `mocks/avaliacoes.ts`, `mocks/album.ts`) e ficam com o catálogo embutido.
  Enquanto a base de dados tiver os mesmos dados que o snapshot, não se nota.
- O `CLAUDE.md` com as regras do projeto ainda não está no repositório (está em
  `~/Downloads/awayday/`).
