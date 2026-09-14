# Decisões

Registo das decisões estruturais, com data e razão. A mais recente fica em cima.

## 2026-09-14 — Dados dos estádios verificados

Capacidade, coordenadas e morada dos 34 estádios foram conferidas contra fontes, uma a uma, e corrigidas
no snapshot e na base de dados (seed com upsert, sem migração nova).

**Critérios.** Capacidade: lugares sentados da época 2025/26, pela página da equipa na Liga Portugal ou
pelo Guia do Adepto do clube; nos estrangeiros, a liga ou o clube. Coordenadas: centro do relvado no
OpenStreetMap, com 4 casas decimais; só se mexe quando a diferença é de pelo menos 25 m. Morada: página
oficial do clube, guia do adepto ou câmara; com códigos postais em conflito fica a NULL.

**Tascos e WC.** Os WC calculam a posição a partir do estádio e acompanham sozinhos. Os tascos têm
coordenadas fixas: os do Restelo (o único estádio com tascos que mudou) foram deslocados no mesmo vetor.

| Estádio | Capacidade | Coordenadas | Morada | Fonte da capacidade |
|---|---|---|---|---|
| `luz` | 64 642 → 68 118 | certas | sim | [fonte](https://ligaportugalstorage.blob.core.windows.net/backoffice/assets/Documento_Guia_do_Adepto_SLB_8dca774e3f.pdf) |
| `dragao` | igual | certas | sim | [fonte](https://www.ligaportugal.pt/team/157/fc-porto/ligaportugalbetclic/20252026) |
| `alvalade` | 50 095 → 52 707 | certas | sim | [fonte](https://ligaportugalstorage.blob.core.windows.net/backoffice/assets/Guia_do_Adepto_SCP_25_26_b1a533e853.pdf) |
| `municipal-braga` | 30 286 → 30 007 | certas | sim | [fonte](https://ligaportugalstorage.blob.core.windows.net/backoffice/assets/Guia_Adepto_SC_Braga_d6bdc1a8e8.pdf) |
| `afonso-henriques` | 30 029 → 29 531 | certas | sim | [fonte](https://ligaportugalstorage.blob.core.windows.net/backoffice/assets/Guia_do_Adepto_VSC_36368e8c3e.pdf) |
| `22-de-junho` | 5 307 → 5 186 | movido 1199 m | sim | [fonte](https://fcfamalicao.pt/clube/instalacoes/) |
| `cidade-de-barcelos` | 12 046 → 12 029 | movido 1908 m | **NULL** | [fonte](https://www.ligaportugal.pt/team/162/gil-vicente-fc/ligaportugalbetclic/20252026) |
| `comendador-almeida-freitas` | igual | movido 298 m | **NULL** | [fonte](https://www.ligaportugal.pt/team/226/moreirense-fc/ligaportugalbetclic/20252026) |
| `arcos` | 9 065 → 5 244 | movido 502 m | sim | [fonte](https://ligaportugalstorage.blob.core.windows.net/backoffice/assets/Guia_Adepto_RIOAVEFC_2025_2026_aacc234e11.pdf) |
| `coimbra-da-mota` | 5 015 → 5 094 | movido 1060 m | sim | [fonte](https://www.ligaportugal.pt/team/176/estoril-praia/ligaportugalbetclic/20252026) |
| `rio-maior` | 6 500 → 6 984 | movido 867 m | sim | [fonte](https://www.ligaportugal.pt/team/56/casa-pia-ac/ligaportugalbetclic/20252026) |
| `municipal-arouca` | 5 600 → 5 200 | movido 691 m | sim | [fonte](https://www.ligaportugal.pt/team/619/fc-arouca/ligaportugalbetclic/20252026) |
| `sao-miguel` | 12 500 → 9 933 | movido 3503 m | sim | [fonte](https://www.ligaportugal.pt/team/98/santa-clara/ligaportugalbetclic/20252026) |
| `madeira` | 5 132 → 5 220 | movido 625 m | sim | [fonte](https://www.ligaportugal.pt/team/88/cd-nacional/ligaportugalbetclic/20252026) |
| `cd-aves` | 8 560 → 6 246 | movido 117 m | sim | [fonte](https://www.ligaportugal.pt/team/322/afs/ligaportugalbetclic/20252026) |
| `jose-gomes` | 9 288 → 7 331 | movido 501 m | sim | [fonte](https://www.ligaportugal.pt/team/112/estrela-amadora/ligaportugalbetclic/20252026) |
| `complexo-alverca` | 7 705 → 6 932 | movido 450 m | sim | [fonte](https://www.ligaportugal.pt/team/135/fc-alverca/ligaportugalbetclic/20252026) |
| `joao-cardoso` | 5 000 → 4 791 | movido 344 m | **NULL** | [fonte](https://www.ligaportugal.pt/team/100/cd-tondela/ligaportugalbetclic/20252026) |
| `estadio-maritimo` | 10 600 → 10 565 | movido 108 m | **NULL** | [fonte](https://www.ligaportugal.pt/team/125/maritimo-m./ligaportugalmeusuper/20252026) |
| `municipal-chaves` | igual | movido 512 m | sim | [fonte](https://www.ligaportugal.pt/team/173/gd-chaves/ligaportugalmeusuper/20252026) |
| `estadio-do-mar` | 6 000 → 5 225 | movido 1222 m | sim | [fonte](https://www.ligaportugal.pt/team/217/leixoes-sc/ligaportugalmeusuper/20252026) |
| `fontelo` | 6 000 → 6 785 | movido 467 m | **NULL** | [fonte](https://www.ligaportugal.pt/team/60/academico/ligaportugalmeusuper/20252026) |
| `magalhaes-pessoa` | 23 888 → 22 668 | movido 105 m | sim | [fonte](https://www.ligaportugal.pt/team/311/u.-leiria/ligaportugalmeusuper/20252026) |
| `marcolino-de-castro` | 5 600 → 5 389 | movido 404 m | sim | [fonte](https://www.ligaportugal.pt/team/81/cd-feirense/ligaportugalmeusuper/20252026) |
| `restelo` | 19 856 → 10 145 | movido 101 m | sim | [fonte](https://www.ligaportugal.pt/team/2173/belenenses/playoff/20242025) |
| `cidade-de-coimbra` | 29 744 → 26 118 | movido 129 m | sim | [fonte](https://www.academica-oaf.pt/instalacoes/) |
| `estadio-varzim` | 7 280 → 3 866 | movido 1203 m | sim | [fonte](https://www.ligaportugal.pt/team/331/varzim-sc/20202021) |
| `santos-pinto` | 3 000 → 1 916 | movido 729 m | **NULL** | [fonte](https://www.ligaportugal.pt/team/288/sc-covilha/ligaportugalsabseg/20222023) |
| `medideira` | 3 000 → 1 000 | movido 799 m | sim | [fonte](https://amorafcsad.pt/instalacoes/) |
| `campo-da-mata` | 2 500 → 5 700 | movido 1078 m | **NULL** | [fonte](https://www.ogol.com.br/estadio.php?id=2066) |
| `olimpico-roma` | 70 634 → 69 689 | certas | sim | [fonte](https://www.legaseriea.it/team/lazio/stadium) |
| `allianz-stadium` | igual | certas | sim | [fonte](https://www.juventus.com/en/faq/allianz-stadium) |
| `red-bull-arena` | igual | certas | sim | [fonte](https://www.salzburg.info/en/salzburg/sports-leisure/red-bull-arena) |
| `emirates` | 60 704 → 60 405 | certas | sim | [fonte](https://arsenal.com/news/emirates-at-20-the-stats-breakdown-aiV0A9T0lVxm) |

### Continua por confirmar

- **Campo da Mata:** sem capacidade oficial; 5 700 vem do zerozero/ogol (o mock tinha 2 500, inventado).
- **Épocas antigas:** Varzim (3 866, Liga 2020/21), Covilhã (1 916, Liga 2022/23) e Restelo (10 145, play-off
  2024/25) não têm número de 2025/26.
- **Red Bull Arena:** 30 188 é a lotação internacional (site de turismo de Salzburgo); na liga austríaca são 17 318.
- **Fontes oficiais em desacordo (escolha feita):** Alvalade 52 707 (guia) vs 52 350 (Liga); Braga 30 007 (guia)
  vs 29 984 (Liga); Guimarães 29 531 (guia) vs 29 098 (Liga); Arouca 5 200 (Liga) vs 4 937 (guia); Leiria 22 668
  (Liga) vs 23 888 (câmara); Barcelos 12 029 (Liga) vs 12 046 (câmara); Coimbra 26 118 sentados vs 29 622 no total.
- **Moradas a NULL (7):** Cidade de Barcelos, Comendador Almeida Freitas, João Cardoso, Marítimo, Fontelo,
  José dos Santos Pinto e Campo da Mata.

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

- ~~Capacidades, coordenadas e moradas dos estádios~~: verificadas a 2026-09-14 (ver entrada acima).
- **Preços dos transportes** continuam em euros com casas decimais nos mocks. Quando passarem para a
  base de dados, têm de ser cêntimos inteiros (regra 1).

### Limitações conhecidas

- Alguns módulos calculam listas logo ao carregar (`locais/index.tsx`, `lista-clube-terra.tsx`,
  `modo-demo-card.tsx`, `mocks/avaliacoes.ts`, `mocks/album.ts`) e ficam com o catálogo embutido.
  Enquanto a base de dados tiver os mesmos dados que o snapshot, não se nota.
- ~~O `CLAUDE.md` com as regras do projeto fora do repositório~~: já está na raiz desde 2026-09-14.
