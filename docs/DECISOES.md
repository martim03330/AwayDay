# Decisões

Registo das decisões estruturais, com data e razão. A mais recente fica em cima.

## 2026-09-16 — Fatia 2: «O meu jogo»

**O quê.** Marcar «Vou a este jogo» abre um ecrã só desse jogo (`/jogos/o-meu-jogo`). Chega-se lá pelo
botão do jogo, pelo cartão «O teu próximo jogo» no topo da lista de Jogos ou tocando num aviso. O ecrã
mostra:
- a contagem decrescente, ou «hora por definir»;
- o tasco escolhido, com os primeiros sugeridos pela mesma ordem da lista de Locais, «Ver o tasco» e
  «Como chegar a pé»;
- as horas do dia;
- o ponto de encontro oficial, quando existe;
- um espaço reservado para a boleia e as contas (fatias 3 e 4);
- os avisos deste jogo.

**Onde fica guardado.** O botão «Vou» passou a funcionar sem conta.
- **Com conta:** `fixture_attendance`, com `status = 'going'` e a nova coluna `place_id`.
- **Sem conta:** no telemóvel (`awayday-planos-jogos-v1`).
- **Modo demo:** só em memória.

O estado fica em `src/state/planos-jogos.tsx`. Os planos guardados sem conta não passam para a conta
ao entrar (limitação conhecida).

**As horas** (`src/lib/avisos-jogo.ts`, com testes):
- chegar ao tasco 2 h 30 antes do apito;
- sair do tasco a tempo de andar, com 15 min para entrar e mais 10 min de folga;
- sem tasco, ir para o estádio 90 min antes.

**Avisos.** São notificações locais agendadas no telemóvel: não passam pelo servidor e funcionam no
Expo Go. A permissão é pedida na primeira vez que se marca um jogo. Os avisos:
- «Faltam 3 dias» às 19:00, nunca na véspera (dar tempo para planear);
- «Hora de ir para o tasco»;
- «Hora de ir para o estádio».

Com a hora do jogo por definir só há o de planear, e os outros entram quando a hora for confirmada.
São reagendados sempre que muda o jogo, a hora ou o tasco. Cada jogo pode desligá-los neste
telemóvel. No modo demo não há avisos, porque a hora é simulada.

## 2026-09-16 — Pontos de encontro semi-automáticos

**Como funciona.**
1. **Procura:** o pg_cron chama `check-meeting-points` três vezes por dia (8h, 14h e 19h UTC). Para
   cada jogo europeu fora de casa do Benfica, do FC Porto ou do Sporting nos 7 dias seguintes, e ainda
   sem ponto de encontro, a função lê a página de notícias do clube.
2. **Filtro:** fica com as ligações de «informações aos adeptos» que mencionam o adversário ou a
   cidade.
3. **Rascunho:** da notícia guarda o título, a ligação e as frases úteis (ponto de encontro,
   transporte, portas, bilhetes, proibições) em `meeting_point_draft`.
4. **Aviso:** os administradores recebem uma notificação push.
5. **Confirmação:** um administrador abre Perfil → «Pontos de encontro por confirmar», preenche os
   campos a partir do excerto e publica.
6. **Publicação:** a função `meeting-point-drafts` localiza o sítio com o geocodificador do
   OpenStreetMap (Nominatim) e grava em `fixture_meeting_point`. Nada chega aos adeptos sem esta
   confirmação.

**Porquê sem IA.** Não há chave de modelo no servidor e a primeira versão é sem custos. Os sites não
têm formato fixo, por isso extrair os campos automaticamente sem revisão arriscava mandar adeptos
para o sítio errado.

**Administradores.** `profile.is_admin`, que só o dono altera: não há permissão de escrita para essa
coluna. A conta do dono foi marcada como administrador a 2026-09-16.

**Cobertura.** Benfica, FC Porto e Sporting. As páginas de notícias do Braga e do Torreense são
geradas por JavaScript e não trazem as ligações no HTML; esses pontos continuam à mão. Testado com a
notícia real do Benfica para o Milan–Benfica.

## 2026-09-15 — Cuidados nos clássicos, caminho até ao ponto de encontro e pratos para todos os tascos

**Cuidados para adeptos visitantes (Benfica, Porto e Sporting entre si).**
- **Tabela `venue_safety_note`:** pública e só de leitura, preenchida à mão com `supabase/seed/10_seguranca_classicos.sql`, depois de a lista ser revista e aprovada a 2026-09-15.
- **Tipos de nota:**
  - «indicação oficial»: como a PSP organizou os visitantes nos últimos clássicos;
  - «zona a evitar»: centro e raio.
- **Regras do conteúdo:**
  - só zonas (ruas, praças, estações), nunca estabelecimentos nem pessoas;
  - linguagem neutra, com fontes e datas;
  - ficam de fora incidentes com mais de 5 épocas, dentro do estádio, longe do estádio ou sem fonte de referência.
- **Na app:** a ficha do clássico mostra o cartão e desenha as zonas a vermelho no mapa (o laranja já marca os locais de adeptos da casa). O aviso final é «Segue sempre as indicações da PSP no dia do jogo».

**Caminho até ao ponto de encontro dentro da app.**
- **Coordenadas:** o ponto de encontro passou a ter latitude e longitude.
- **O percurso:** «Levar-me até lá» lê a posição uma vez e pede o percurso à Edge Function `walking-route`, que o pede ao serviço público de rotas a pé do OpenStreetMap (OSRM da FOSSGIS, sem chave e com uso moderado).
- **Na app:** o mapa mostra a linha, a tua posição, a distância, o tempo e as indicações em português.
- **Exceção à regra da cache:** a regra 3 manda guardar em cache as respostas de APIs externas, mas uma rota depende da posição de cada pessoa e guardá-la seria guardar localizações. Por isso nada fica guardado: nem a posição, nem o percurso, nem os registos.
- **Limites de uso:**
  - com conta: 60 pedidos por hora, por conta;
  - sem conta: 20 por hora, por endereço de rede, só em memória.
- **Se o serviço grátis não aguentar:** passa-se ao OpenRouteService, grátis até 2000 pedidos por dia.

**Pratos: menu real quando existe, «Costuma haver» nos restantes.**
- **Pesquisa:** foi feita nos sites oficiais dos 222 locais com site no OpenStreetMap.
- **Resultado:** encontraram-se preços em 56 locais; ficaram 44 depois de tirar os preços não confirmados, os menus que podiam ser de outro sítio ou só da cadeia, os pratos acima de um limite barato e as fontes sem https.
- **Onde estão:** `supabase/seed/11_pratos_menus_online.sql`, aprovados, com fonte, data e moeda.
- **Moeda local:** `dish.currency`; `price_cents` passa a estar em unidades mínimas dessa moeda. `formatarPreco` em `money.ts` tem testes.
- **Os outros tascos:** mostram «Costuma haver» (`src/lib/pratos-tipicos.ts`), com pratos típicos do tipo de sítio e do país, sempre apresentados como sugestão e não como o menu da casa.
- **Sem menus inteiros:** não se copiam menus inteiros, por direitos de autor e porque ficam desatualizados.

## 2026-09-15 — Deslizar entre tascos

Na ficha de um tasco, deslizar o cabeçalho para os lados (ou tocar nas setas) passa ao tasco anterior
ou seguinte perto do mesmo estádio, pela mesma ordem da lista de Locais
(`src/components/deslizar-locais.tsx`). Os detalhes:
- Muda o parâmetro da rota em vez de abrir outro ecrã, por isso não se empilham ecrãs.
- A página volta ao topo a cada mudança.
- Não mostra outra vez o carregamento simulado.
- O gesto só reage a movimentos laterais e deixa o scroll vertical livre.
- Com «reduzir movimento» ligado, o cabeçalho não acompanha o dedo.
- A raiz da app passou a ter `GestureHandlerRootView`, que os gestos precisam.

## 2026-09-15 — Ao abrir, a app espera uns segundos por dados novos

**Problema.** Os catálogos (jogos, estádios, tascos, pontos de encontro) ficam guardados no telemóvel.
Os dados novos só eram aplicados na abertura seguinte à que os descarregou. Quem abria a app uma vez
depois de uma mudança continuava a ver a versão antiga: aconteceu com os tascos do estrangeiro e com o
ponto de encontro do Milan–Benfica.

**Decisão.** Ao abrir, se a cópia guardada tiver mais de 5 minutos, a app pede dados novos e espera no
máximo 3 segundos, com o ecrã inicial ainda visível (`freshOrSaved` em `src/lib/query-client.tsx`).
Sem rede ou se o servidor demorar, abre com a cópia guardada, como antes. Com a app já aberta, os
dados continuam a não mudar debaixo de um ecrã (o React Compiler memoriza o que os ecrãs calculam).
A mudança passa a aparecer na abertura seguinte.

## 2026-09-15 — Locais em páginas, só os próximos jogos, sem clube da terra e pontos de encontro

**Locais em páginas.** A API do Supabase devolve no máximo 1000 linhas por pedido (`max_rows`). Com
1486 locais, os últimos a entrar (os 403 à volta dos estádios estrangeiros) nunca chegavam à app, e o
Milan–Benfica aparecia sem tascos. `fetchPlaceCatalogRows` passou a ler os locais e os pratos página a
página, ordenados por id. Qualquer tabela que possa passar das 1000 linhas tem de ser lida assim.

**Estádio estrangeiro sem tascos.** Em vez de sugerir um estádio qualquer, a app pergunta
«Não vais a Milão?» e sugere tascos perto do estádio do teu clube, para veres o jogo com a malta.

**Só os próximos jogos.** A página Jogos mostra os 2 próximos jogos do teu clube e o link
«Ver o calendário todo». A seguir vêm «Jogos a que foste» e «Espreitar a concorrência», que assim
ficam à vista.

**Clube da terra fora da primeira versão.** Faz mais sentido com a Liga 2 e a Liga 3, que ainda não
têm jogos. `MOSTRAR_CLUBE_DA_TERRA = false` tira-o da introdução (passa a ter 3 passos), do Perfil,
da lista de jogos e do treinador. O que já estava escolhido fica guardado.

**Pontos de encontro oficiais.** Nova tabela `fixture_meeting_point`, pública e só de leitura, com
fonte obrigatória: quem publicou, título, URL e data. Para já é preenchida à mão a partir do site do
clube, da câmara ou da polícia. A app mostra-a na ficha do jogo; os dados de exemplo continuam só no
modo demo.

## 2026-09-15 — Check-out automático, dica que abre o tasco e «Como chegar»

**Check-out automático.** Um check-in termina quando começa um jogo no estádio desse tasco: quem lá
estava foi para o jogo. Continua a terminar ao fim de 3 horas.
- **No servidor:** `refresh_place_pulse`, que corre de 5 em 5 minutos, termina a presença à hora do
  apito. O `coach_context` deixa de dar `checkin_ativo` depois do apito e passou a usar `p_now` em
  vez de `now()`, para o relógio do modo demo dar a mesma resposta.
- **Na app:** `checkInsAtivos` (`src/lib/presenca.ts`) aplica a mesma regra, por isso o tasco deixa
  de mostrar «Estás aqui» depois do apito. A visita verificada fica no histórico.
- **Testes:** correram numa transação revertida antes de aplicar a migração (jogo noutro estádio não
  termina o check-in, jogo no estádio do tasco termina, a visita fica).

**A dica do treinador abre o que interessa.** Tocar na dica abre o tasco do check-in, o jogo ou o
passaporte. A função `coach-message` passou a devolver o `fixtureId`. As notificações push das dicas
levam o `fixtureId` e abrem o jogo; as restantes continuam a abrir as Novidades.

**«Como chegar».** O botão abre o Apple Maps (iOS) ou o Google Maps com o trajeto: a pé para o tasco,
de carro para o estádio. Não precisa de API nem de chave (`src/lib/direcoes.ts`).

**Filtros de jogos.** Na primeira versão só aparecem os filtros «Todas», «Liga Betclic» e «Europa».

## 2026-09-15 — Primeira versão: Liga Portugal e jogos europeus, sem custos

**Âmbito.** A primeira versão tem só os jogos da Liga Portugal e os jogos europeus dos clubes
portugueses, para não pagar APIs. Na escolha do clube (o que apoias e o clube da terra) só aparecem os
clubes da Liga Portugal (`DIVISOES_NA_ESCOLHA` em `src/mocks/clubes.ts`). Os clubes da Liga 2 e da
Liga 3 continuam na base de dados, e os tascos dos estádios deles continuam visíveis.

**De onde vêm os jogos.**
- **Liga Portugal e Liga dos Campeões:** sincronização automática com a football-data.org (plano
  grátis). Só entram jogos entre clubes com `club.football_data_id`, ou seja, os do Porto e do
  Sporting e os adversários que acrescentámos.
  - Os ids dos jogos europeus levam a competição e, nas eliminatórias, a ronda. Assim não colidem com
    os jogos da Liga entre os mesmos clubes.
  - Na Europa usa-se `club.european_venue_id` quando existe.
- **Liga Europa e Liga Conferência:** não vêm na API grátis, por isso estão à mão em
  `supabase/seed/08_europa_2026_27.sql`, com o estádio de cada jogo. São os jogos do Benfica e do
  Torreense na Liga Europa e do Braga na Liga Conferência.
  - Fontes: uefa.com, Record, RTP e sites dos clubes, consultados a 2026-09-15.
  - Para atualizar (eliminatórias, mudanças de hora), edita o ficheiro e aplica-o com
    `supabase db query --linked -f`. É um upsert.
- **Liga 2, Liga 3 e taças:** a API-Football tem-nas, mas só num plano pago.

**Estádios e clubes estrangeiros.**
- Há 18 estádios novos, com coordenadas e capacidade da Wikidata, só onde joga um clube português.
  Casos especiais desta época:
  - Betis em La Cartuja, enquanto o Villamarín está em obras.
  - Shakhtar em Stamford Bridge (aprovação da UEFA por confirmar).
  - Torreense em casa em Leiria.
- Os clubes que só vêm jogar a Portugal não têm estádio (`home_venue_id` nulo). A app aceita-os
  (`Clube.estadioId` pode ser `null`), para não inventar estádios nem coordenadas.
- As cores dos clubes estrangeiros são aproximadas (cores do equipamento). As do Ararat-Armenia são
  neutras.

**Hora por definir.** Os jogos com hora provisória (`fixture.kickoff_confirmed = false`) mostram
«--:--» e «Por definir» no cartão, e «hora por definir» na ficha do jogo.

**Tascos no estrangeiro.** O `npm run db:tascos` passou a ler os estádios da base de dados. Sem ids
importa os portugueses; com ids importa exatamente esses, incluindo os estrangeiros. Os locais
entram como sugestões «Por confirmar» e os adeptos votam, como em Portugal.

### Limitações conhecidas

- Os jogos da Liga Europa e da Liga Conferência não se atualizam sozinhos. Mudanças de hora e
  eliminatórias têm de ser acrescentadas à mão.
- Nos jogos Plzeň–Benfica e Ferencváros–Torreense assumiu-se o estádio habitual do clube da casa.
- O treinador e as dicas usam a hora do jogo mesmo quando é provisória.

## 2026-09-15 — Sair do modo demo, fatia 3: presença real no dia de jogo

**Check-in com localização.** A app lê a posição uma vez e envia-a à Edge Function `check-in`, que
mede a distância ao tasco e esquece a posição. Não é guardada nem registada em logs, e à app só se
devolve a distância arredondada a 50 m. Conta até 150 m, com precisão de 100 m ou melhor. Nova
dependência: `expo-location` (aprovada a 2026-09-15). Só pede a localização com a app aberta.

**Tabela `checkin`.**
- Não tem políticas RLS e não guarda coordenadas.
- Só a alteram `start_checkin` e `end_checkin`, e só a lê `refresh_place_pulse`. Estas três funções
  só podem ser executadas pelo service role (a Edge Function) e pelo pg_cron, e a app nunca lhes
  chega. É assim que se cumpre a regra «código que lê `checkin` corre em Edge Function».
- A presença dura 3 horas. Um check-in noutro tasco termina o anterior.
- O pg_cron recalcula os agregados de 5 em 5 minutos e apaga os check-ins com mais de 48 horas.

**Agregados (`place_pulse`).**
- São recalculados a cada check-in e publicados só com 5 ou mais pessoas.
- A repartição por clube tem o mesmo mínimo; o resto vai para `others`.
- Qualquer pessoa os lê, mesmo sem conta. No modo demo continuam os números de exemplo.

**Visitas verificadas.** Só o servidor as cria (`place_visit.source = 'check-in'`); a app só pode
criar visitas `manual`. Isto também protege as fotos das missões e o barulhómetro, que dependem do
check-in. Anular um check-in termina a presença e apaga a visita que ele criou.

**Sem conta.** O telemóvel verifica a distância com as mesmas regras. A visita conta para o teu
passaporte, mas não para a claque nem para os rankings. Ao juntar a atividade à conta, estas visitas
entram «por verificar».

**Rankings.**
- `verified_places_ranking` (tascos diferentes com visita verificada) e `noise_ranking` (melhor
  medição por jogo) são calculados no servidor e só estão disponíveis com conta.
- Outras pessoas só aparecem se ligarem «Aparecer nos rankings» (`profile.show_in_rankings`,
  desligado por omissão). Vês sempre a tua linha.

**Barulhómetro.** O servidor passou a exigir um check-in verificado nesse dia (em Lisboa) num tasco
perto do estádio do jogo.

**Testes.** Os testes de RLS e das regras (menos de 5 não publica, clubes com menos de 5 vão para
outros, expiração, anular, rankings só com quem aceitou, barulho sem check-in) correram numa
transação revertida antes de aplicar a migração.

### Limitações conhecidas

- O `app.json` ainda não tem o texto da permissão de localização para iOS. O Expo Go funciona, mas
  uma build precisa dele (pedir antes de alterar o `app.json`).
- A localização pode ser falsificada com apps de GPS falso. Nesta fase, aceita-se.
- O ranking de tascos conta visitas de sempre, não por época.
- O check-in não exige jogo nesse dia.

## 2026-09-15 — Jogos reais da Liga Portugal (football-data.org)

**O quê.** A Edge Function `sync-fixtures` vai buscar os jogos da Liga Portugal 2026-27 ao
football-data.org e guarda-os em `public.fixture` (upsert por id `casa-fora-2026-27`). O pg_cron
chama-a de 6 em 6 horas (`15 */6 * * *`) com o segredo do Vault, como o `generate-nudges`. A primeira
execução guardou 305 jogos (1 adiado ficou de fora).

**Porquê assim.** A chave da API só existe nos segredos da função (`FOOTBALL_DATA_API_KEY`); a app lê
a cache em Postgres (regra 3). Cada clube tem `club.football_data_id` (os 18 da Liga preenchidos na
migração). O estádio é o `home_venue_id` do visitado, porque a API não indica o estádio.

**Hora por confirmar.** Os jogos `SCHEDULED` têm data provisória: ficam com
`fixture.kickoff_confirmed = false` (198 à data). A app ainda não mostra esta diferença.

**Cobertura.** O plano gratuito só inclui, em Portugal e Europa, a Liga Portugal, a Liga dos Campeões
e o Europeu. Liga 2, Liga 3, taças e Liga Europa não vêm na chave (a Liga 2 responde 404). A Liga dos
Campeões fica para depois: faltam clubes e estádios estrangeiros.

**API-Football (testada a 2026-09-15).** Tem a Liga 2 (id 95), a Liga 3 (865), a Taça de Portugal
(96) e a Taça da Liga (97), com o estádio de cada jogo. O plano grátis, porém, só dá acesso às
épocas de 2022 a 2024 e recusa a de 2026. Para ter estes jogos é preciso um plano pago (Pro, 19 $ por
mês) ou carregá-los à mão. A chave está guardada no segredo `API_FOOTBALL_KEY` e ainda não é usada.

### Limitações conhecidas

- Um jogo guardado que depois é adiado ou cancelado fica com a data antiga até a API lhe dar uma nova.
- Se um clube jogar fora do seu estádio (castigo, obras), o estádio fica errado.
- A chave foi partilhada numa conversa: gerar uma nova antes do lançamento e voltar a guardá-la com
  `supabase secrets set`.

## 2026-09-15 — Tascos sugeridos, confirmados pelos adeptos

**Muda a curadoria da fatia 2.** Em vez de esperar que o dono aprove cada tasco, os candidatos do OpenStreetMap
passam a aparecer logo como **"Por confirmar"**, com o aviso de que podem não ser um tasco para dia de jogo. No
lançamento há poucos adeptos a avaliar, e a app não pode abrir sem tascos; com o tempo, são os adeptos que decidem.
- `suggest_place_candidates()` (só o dono) copia os candidatos pendentes para `place` com `confirmation =
  'suggested'`, id, artigo e etiquetas calculados. Pode correr outra vez: só pega nos pendentes. Primeira publicação:
  628 sugestões em 29 estádios, mais os 455 candidatos dos 28 estádios da época 2026-27.
- **Rápido e barato** (`quick_and_cheap`): cafés, comida rápida, bares, pubs, nomes de tasco (tasca, snack, bifana,
  petiscos, cervejaria…) e cozinhas de snack, sandes ou kebab. Cozinhas pouco próprias para antes do jogo (sushi,
  japonesa, chinesa, italiana, mexicana, marisqueira, casa de carnes) nunca levam a etiqueta e descem na lista.
  O OpenStreetMap quase nunca tem preços: "barato" é uma aproximação pelo tipo de sítio.
- **Votos** (`place_vote`, só com conta): "É um bom sítio para ir antes do jogo?". Com pelo menos 5 respostas e o dobro
  de um lado, a sugestão fica confirmada ou escondida (`rejected`, invisível para todos). Só se vota em sugestões.
- **O dono manda sempre:** `confirm_place` e `reject_place`, e `publish_place_candidate` publica logo confirmado.
- **O treinador só sugere tascos confirmados** (`coach_nearby_place`). As Edge Functions que leem nomes de tascos só
  os usam como lista de proteção do texto do modelo, por isso não precisaram de mudar.
- **Na app:** a lista mostra primeiro os confirmados e depois as sugestões (rápidos e baratos à frente, depois pela
  pontuação e pela distância); o cartão e a ficha têm as etiquetas "Rápido e barato" e "Por confirmar"; a ficha tem
  o bloco de voto (sem conta, convida a entrar; no modo demo, fica em memória). A ordem dos estádios e a sugestão
  "Ver tascos perto de…" deixaram de assumir que só a Luz tem tascos.
- Testado com um bloco SQL revertido: pontuação e etiquetas, publicação repetida, a app sem acesso às funções do dono
  nem à contagem, 5 votos a confirmar e a esconder, sem votos em confirmados, e o treinador só com confirmados.
- Os 27 jogos de exemplo foram apagados da base de dados alojada (a pedido do dono).

## 2026-09-15 — Sair do modo demo, fatia 2: tascos, pratos e época 2026-27

**Tascos reais, com curadoria.** `npm run db:tascos` procura no OpenStreetMap cafés, bares e restaurantes com nome a
menos de 1,2 km de cada estádio português, deixa de fora cadeias (etiqueta `brand`), sugere o tipo e estima o tempo a
pé (distância em linha reta × 1,3, a 80 m/min). Corre na máquina de quem desenvolve, nunca na app. Os resultados vão
para `place_candidate`, sem nenhum acesso da app; só `publish_place_candidate` (dono, painel ou CLI) os copia para
`place`, com atribuição "© contribuidores do OpenStreetMap". Assim, tudo o que lê `place` (app, treinador, dicas,
retrospetiva) só vê tascos publicados, sem mexer nessas funções.
- Os 25 tascos fictícios foram apagados da base de dados e ficam só no modo demo (`src/mocks/locais.ts`).
- `place` ganha os tipos `restaurante` e `cafe`, horário, nível de preço, especialidade, origem e coordenadas geradas.
- Primeira importação: 628 candidatos para os 30 estádios que já existiam.

**Pratos e fotos sugeridos pelos adeptos, com moderação.** Uma sugestão fica `pending` até o dono a aprovar no painel
do Supabase. Um trigger põe o autor e o estado (a app não escreve essas colunas), recusa duplicados e limita a 20
pratos e 10 fotos por dia. As fotos ficam no bucket privado `place-photos`; os ficheiros só são legíveis por quem os
enviou ou, depois de aprovados, por todos. Os ecrãs para sugerir pratos e fotos ainda estão por fazer.

**Dinheiro em cêntimos.** `src/lib/money.ts` (ler preços escritos à mão, somar, comparar, formatar) com testes em
Vitest, a dependência de desenvolvimento aprovada nesta fatia (`npm run test`). O preço dos pratos passa a
`precoCentimos`. Os preços dos transportes e das casas de banho continuam em euros até à fatia 4.

**Recomendações e notas.** `dish_recommendation` guarda quem recomenda o quê, só visível ao próprio; a contagem vive no
prato e é mantida por um trigger. Na app, a contagem mostrada nunca conta a tua recomendação duas vezes (pode ficar
uma abaixo até a app recarregar o catálogo). `place_rating` ganha `beer_score` e `food_score`; as médias
(`place_scores`, `place_scores_all`) só aparecem com pelo menos 5 pessoas. Sem conta, as notas de cerveja e comida
ficam só em memória.

**Catálogo dos tascos na app** (`src/features/places`), com o mesmo desenho do catálogo de jogos: em modo real lê os
tascos publicados, os pratos aprovados e as médias; em modo demo usa os fictícios. Os mocks mantêm os exports.
Campos que os tascos reais ainda não têm passam a opcionais e os ecrãs escondem-nos: cervejómetro e petiscómetro,
pessoas no tasco, especialidade, horário (traduzido do formato do OpenStreetMap), preço médio, e preço, tempo e
temperatura dos pratos. A versão da cache guardada passou a `catalog-v3`.

**Estádios e jogos sem dados extra deixam de ficar de fora.** Meteorologia, transportes, sombra, abrigo e cobertura
passam a opcionais; a ficha do jogo e o cartão do estádio só mostram o que se sabe.

**Época 2026-27.** Divisões confirmadas na Wikipédia, no A Bola e no zerozero: sobem à Liga Portugal o Marítimo e o
Académico de Viseu; descem à Liga 2 o AVS e o Tondela; a Académica sobe à Liga 2; o Amora desce ao Campeonato de
Portugal (fica sem divisão). Entram 28 estádios e 27 clubes da Liga 2 e da Liga 3, com fontes por campo.
Artigos, nomes curtos e distritos novos em `supabase/seed/07_names_2026_27.sql`.
- O AVS passa a aparecer como AFS (nome curto e sigla); o nome legal continua "AVS - Futebol SAD".
- **Provisório, por confirmar:** cores neutras (preto e branco) para Louletano, União de Santarém e São João de Ver;
  capacidade de 1 468 para o Campo Chã das Padeiras (zerozero, antes das obras).
- **A ter em conta nos jogos:** o Lourosa não tem estádio próprio esta época (jogos noutros campos), o Porto B divide
  jogos entre o Olival e Pedroso, e o Louletano já mudou um jogo para Albufeira: o estádio tem de vir de cada jogo.
- Capacidades dos estádios que já existiam e que a Wikipédia dá diferentes (Restelo, São Miguel, Varzim, Cidade de
  Coimbra, Estádio do Mar, Santos Pinto, Magalhães Pessoa) não foram revistas.

**Jogos de exemplo só no modo demo.** O catálogo de jogos tem uma versão demo (os 27 jogos de exemplo do snapshot,
com meteorologia simulada) e uma real (só o que vem da base de dados). O modo real aceita não haver jogos e aplica
logo a primeira resposta. O seed deixou de escrever jogos: os reais vêm da sincronização com a football-data.org
(Liga Portugal e Champions no plano grátis), ainda à espera da chave.
- **Pendente:** apagar os 27 jogos de exemplo da base de dados alojada. Não levam atividade (0 idas, avaliações e
  medições; 4 dicas e 2 fotos só perdem a ligação ao jogo). O pedido foi bloqueado pelas permissões do Claude Code e
  fica para o dono decidir. Até lá, o modo real ainda os mostra.

## 2026-09-14 — Sair do modo demo, fatia 1: a tua atividade fica guardada

**Três origens de dados, escolhidas no `AppStateProvider`.**
- **Modo demo** (opção explícita nas Definições, guardada no telemóvel): dados de exemplo e hora simulada, só em
  memória. Nada vai para a conta nem fica no telemóvel. O link `?demoFase=` liga o modo demo, para a hora simulada
  nunca se misturar com atividade real.
- **Sem conta:** a atividade fica neste telemóvel (AsyncStorage, `src/state/armazenamento-local.ts`), com leitura
  validada campo a campo (um valor estragado é ignorado, não rebenta a app).
- **Com conta:** a atividade vem da conta (TanStack Query) e cada mudança é gravada lá, com atualização imediata
  no ecrã e nova leitura a seguir (que também desfaz uma mudança que falhou).
- **Sempre no telemóvel:** introdução vista, permissões, clubes escolhidos, sons e modo demo. A introdução deixa de
  aparecer em cada arranque.

**Juntar à conta só com pergunta.** Na primeira vez que alguém entra numa conta com atividade guardada no telemóvel,
a app pergunta se a junta. Assim, a atividade de outra pessoa que usou o mesmo telemóvel nunca vai parar à conta.
Se alguma parte falhar (por exemplo, a avaliação de um jogo que ainda não começou), o telemóvel fica com a cópia.
As medições do barulhómetro não sobem: a conta só aceita medições feitas durante o jogo.

**Migração `20260914190000_personal_activity`**, com RLS e políticas na mesma migração:
- `place_rating`: a tua nota a cada tasco (1 a 5).
- `noise_measurement`: só se escreve pela função `record_noise_measurement`, que aceita medições apenas com o jogo
  a decorrer (115 minutos desde o apito) e com 8 minutos entre medições da mesma pessoa no mesmo jogo, com bloqueio
  para pedidos em paralelo.
- `notification_preference`: os quatro tipos de aviso, com nomes em inglês na base de dados.
- `mission_photo` e o bucket privado `mission-photos` (uma pasta por pessoa, 5 MB, JPEG/PNG/HEIC). O telemóvel não
  escreve `verified` nem `taken_at`: um trigger marca a foto como verificada quando há, nesse dia em Lisboa, um
  check-in num tasco perto do estádio de um jogo desse dia, e usa esse jogo e estádio.
- Testada com um bloco SQL revertido no fim: notas fora de 1 a 5, escrever em nome de outra pessoa, medições
  seguidas, fora do jogo ou fora da função, fotos verificadas pelo telemóvel, ficheiros na pasta de outra pessoa,
  leitura entre utilizadores, anónimos sem acesso, e tudo a desaparecer com a conta.
- A função `delete-account` apaga também os ficheiros da pessoa no Storage, que não seguem a cascata.

**Cache.** Os links assinados das fotos (válidos 1 hora) não entram na cache guardada no telemóvel: as queries com
`meta: { persist: false }` ficam de fora.

### Limitações conhecidas (resolvidas nas fatias seguintes)

- **Pratos recomendados** continuam só em memória: precisam da tabela `dish` (fatia 2).
- **Progresso das missões** continua a ser calculado no telemóvel, agora com os teus dados reais. Passa para o
  servidor quando meteorologia, pratos e clubes presentes estiverem na base de dados.
- **Fora do modo demo continuam fictícios:** pessoas no tasco, clubes presentes, ranking de adeptos do barulhómetro
  e ranking de tascos verificados (fatia 3, com agregados de pelo menos 5 pessoas).
- **Check-in sem localização:** a verificação das fotos confia no check-in em `place_visit`, que ainda não confirma
  que estás perto do tasco (fatia 3).
- **Fotos sem conta** ficam no ficheiro que a câmara criou; se o sistema limpar essa cache, a foto deixa de abrir.

## 2026-09-14 — Design «Relvado» nos ecrãs, jogos dos teus clubes, histórico e faixa de novidades

**Design, fases 2 e 3.** Os componentes de futebol e os ecrãs seguem o canvas «AwayDay Relvado»: bilhete de jogo
picotado, relógio do dia de jogo com cinco passos, carimbos de passaporte na cor do clube, escudo em SVG, pódio,
mostrador do barulhómetro, cartão de tasco. Não há emoji na interface: as missões (`distintivo.icon`), os níveis do
barulhómetro (`icone`) e os exemplos de notificação usam ícones. `Medidor` recebe `icon` e `ContadorPessoas` tem
`variant`. As missões passam a ter ecrã próprio (`perfil/missoes`), como no design aprovado.

**Jogos: só os teus clubes por omissão.** «Os teus clubes» são o clube que apoias e o clube da terra
(`clubesDoUtilizador`). Os outros jogos ficam atrás de «Espreitar a concorrência». A escolha não é guardada: cada
vez que a app abre, voltas aos teus clubes.

**Jogos terminados saem da lista, nunca da base de dados.** Um jogo terminado só fica em Jogos para quem foi, até ao
fim do dia seguinte em Lisboa, para dar tempo de avaliar (`ficaNaListaDeJogos`). Depois passa para «Os teus jogos»
no Perfil. Os jogos a que não foste deixam de aparecer, mas `fixture` continua intacta: a retrospetiva, as dicas e
o treinador contam as idas a partir de `fixture_attendance`, e apagar jogos partia essas contas.
- «Foste» = `going` ou `attended` na conta (lista completa lida com `fetchMyAttendance`, RLS só devolve as tuas)
  ou uma avaliação feita neste telemóvel. Sem conta, só contam as avaliações.
- Marcar «Vou a este jogo» invalida a lista inteira (`[attendance, userId]` como prefixo).

**Faixa de novidades.** As novidades (`nudge`) correm numa faixa no topo de Jogos, a 45 px/s, com as 5 mais recentes
das últimas duas semanas. Tocar abre a lista. Sem conta ou sem novidades recentes, a faixa não aparece. Com «reduzir
movimento», fica parada na mais recente.

**Perfil arrumado.** O Perfil fica com a conta, os clubes e resumos (passaporte com os 3 carimbos mais recentes,
missões, os teus jogos, álbum, tascos, ranking). Ecrãs próprios: `perfil/passaporte`, `perfil/os-meus-jogos` e
`perfil/definicoes` (sons, notificações, localização, rever a introdução e o modo demo, que os 5 toques no cabeçalho
passam a abrir). A linha de grupo passou para `src/ui/linha-grupo.tsx`. O histórico de avaliações deixou de ter
secção própria: cada jogo em «Os teus jogos» mostra a nota e abre a ficha, onde se edita a avaliação.

**Barra de estado.** Branca nos ecrãs com cabeçalho verde (`useBarraDeEstadoClara`), a seguir o foco e não a
montagem, porque as tabs ficam montadas.

## 2026-09-14 — Design «Relvado», fase 1: fundamentos e componentes base

**Contexto.** O design está no canvas «AwayDay Relvado»: verde de relvado com riscas de corte, fundo cor de
cal, amarelo de cartão para destacar e tinta verde-escura em vez de preto. Vai entrar por fases: fundamentos e
componentes base (esta), componentes de futebol e depois os ecrãs.

- **Só modo claro.** O design só tem versão clara. O `app.json` passa a `userInterfaceStyle: "light"` e o
  `Colors` do tema é uma paleta única. Os nomes antigos (`accent`, `background`, `backgroundElement`, …) ficam
  iguais, para os ecrãs mudarem de cor sem mexer neles. Os hooks `use-color-scheme` saíram, porque ninguém mais
  os usava. A versão escura fica para depois.
- **Fontes: `@expo-google-fonts/big-shoulders`, `big-shoulders-stencil` e `figtree`**, carregadas com
  `useFonts` no layout raiz, com o ecrã de arranque à espera. Big Shoulders para títulos, Stencil para horas e
  números, Figtree para o texto. Os pacotes `big-shoulders-display` são uma versão antiga da mesma família.
- **Um ficheiro de fonte por peso.** O Android ignora o `fontWeight` em fontes próprias, por isso o
  `ThemedText` escolhe a fonte a partir do peso (`fontFamily(role, peso)`) e põe o `fontWeight` a `normal`.
  Os estilos dos ecrãs continuam a escrever `fontWeight: 700`. Os três `Text` diretos que ainda existem
  (escudo e fotos) ficam com a fonte do sistema até à fase 2.
- **Ícones em SVG (`react-native-svg`)** em vez de SF Symbols e Material Symbols: o mesmo traço de 2 px em iOS,
  Android e web, como no design. Os nomes (`icons.jogos`, …) não mudaram. A barra de separadores continua nativa
  e por isso continua com SF Symbols e Material, só com as cores novas.
- **Pedido de dependências aprovado** nesta sessão: `react-native-svg` e os três pacotes de fontes. O
  `expo install` juntou também o plugin `expo-font` ao `app.json`.

## 2026-09-14 — Correções da auditoria de segurança

**Contexto.** Auditoria completa ao código: RLS, Edge Functions, autenticação, segredos, dependências. Não houve
falhas críticas; estas são as correções.

- **Perfis e clubes só pelo dono** (migração `20260914180000_restrict_profile_reads`). Qualquer pessoa com conta
  lia todos os perfis e o clube que cada um apoia. Isso também dava o número exato de adeptos por clube e
  contornava o mínimo de 5 pessoas do `club_supporter_counts`. A app só lê o perfil de quem tem sessão, por isso
  nada muda para quem a usa.
- **Limites no servidor** (`20260914180100_rate_limits_and_ai_usage`).
  - `coach-message` escreve no máximo 12 mensagens novas por pessoa por hora (`take_rate_limit`). Contar e
    registar acontecem com um bloqueio por pessoa, para pedidos em paralelo não passarem todos.
  - O gasto com o modelo passa a ser somado em SQL (`ai_usage_since`). Lido pela API, parava nas 1000 linhas e o
    orçamento deixava de crescer. Dicas e retrospetivas contam para o mesmo orçamento mensal.
  - O Claude continua desligado (não há `ANTHROPIC_API_KEY` nas funções), mas o limite já trava linhas sem fim.
- **A hora da demo continua a chegar ao servidor.** O Modo demo do Perfil precisa dela e o limite por hora trava
  o abuso. O deep link `?demoFase=` só funciona em desenvolvimento ou com `EXPO_PUBLIC_DEMO_MODE=true`, porque
  qualquer página o podia abrir.
- **Códigos de 8 algarismos, válidos 15 minutos.** Com 6 algarismos e só o limite por IP (30 tentativas a cada 5
  minutos), cerca de 100 IPs tinham perto de 58% de hipóteses de acertar um código de recuperação num dia. Com 8,
  fica abaixo de 1%. O captcha fica por decidir, porque precisa de uma dependência nova.
- **Apagar conta pede a password.** A função só aceita sessões que entraram há menos de 10 minutos (claim `amr`
  do token): uma sessão roubada ou esquecida num telemóvel já não apaga a conta. Com `secure_password_change`
  ligado, mudar a password numa sessão antiga pede reautenticação. A recuperação por código continua a funcionar,
  porque cria uma sessão nova.
- **A cache da conta sai ao terminar sessão.** Dicas, retrospetiva, presenças e mensagens ficavam guardadas no
  telemóvel até 7 dias, mesmo depois de apagar a conta. Agora sai tudo menos o catálogo de jogos.
- **Tokens de push:** no máximo 10 telemóveis por conta (`20260914180200_device_token_cap`).
- **Android sem cópia de segurança automática** (`allowBackup: false`): a sessão está no AsyncStorage e ia para o
  Google Drive.
- **`.env` e `.env.*` no `.gitignore`**, exceto o `.env.example`.
- **Edge Functions com `supabase-js` fixo em 2.116.0**, a mesma versão da app, e sem imports que não se usavam.
- **Quem chama uma Edge Function verifica-se num só sítio** (`_shared/auth.ts`): `authenticatedCaller` para a app,
  `hasCronSecret` para o `pg_cron`. Com `verify_jwt` desligado em todas, uma função nova que se esquecesse da
  verificação ficava pública; assim há uma forma óbvia de o fazer.
- **Regra de lint para métodos que o Hermes do Expo Go não tem** (`toSorted`, `Object.groupBy`, etc.). O
  TypeScript não avisa, e o `toSorted` pôs a app a rebentar ao abrir para quem tinha sessão.

**Fica por fazer.** Captcha no registo e na recuperação. Sessão encriptada (`expo-secure-store`). Remover
dependências sem uso (`expo-web-browser`, `expo-status-bar`). `deno.lock` das funções (o Deno não está instalado).

## 2026-09-14 — Ajustes às mensagens depois da simulação com perfis fictícios

**Como se testou.** `supabase/seed-dev/perfis-ficticios.sql` cria três perfis fictícios (Vai a Tudo, Ocasional,
Novato) com uma época de histórico (2025-26). Só serve para desenvolvimento e fica fora de `supabase/seed`, por
isso o `db push --include-seed` nunca o carrega. Numa base de dados partilhada, é melhor corrê-lo dentro de uma
transação revertida: os perfis contam para agregados públicos, como os adeptos por clube. Com ele geraram-se
mensagens em várias horas simuladas, com o payload do SQL ao lado do texto e contagens feitas à parte, e as três
retrospetivas.

**O que mudou** (migração `20260914170000_coach_context_fixes`, textos em `_shared`):
- **Marco do passaporte.** A mensagem diz o número real de estádios e o carimbo mais recente, isto é, o estádio
  visitado pela primeira vez há menos tempo. Antes, quem passava de 9 para 12 estádios entre duas aberturas lia
  "10 estádios", com o carimbo do último jogo. O marco (3, 5, 10…) só decide que há alguma coisa a celebrar e
  fica em `facts.milestone`.
- **Estádio novo com "Vou".** Tem frases próprias (`estadio_novo_com_vou`): a ida já está decidida, por isso a
  mensagem não convida a planear e fala da estreia.
- **Check-in ativo.** A chave deixa de incluir a fase do dia de jogo: o mesmo check-in mantém a mensagem quando a
  fase muda.
- **Retrospetiva.**
  - Nomeia até três estádios estreados e diz quantos faltam ("…, os Arcos, o Estádio do Mar e mais 5").
  - Só diz "Onde mais andaste" quando houve pelo menos dois estádios.

**Por decidir.** Oito estádios não têm nome curto e os nomes completos tornam as frases pesadas. O pior caso é o
"Parque de Jogos Comendador Joaquim de Almeida Freitas", com 127 caracteres. Não se inventaram nomes curtos: os
dados dos estádios são verificados, por isso fica por confirmar como cada um é conhecido.

## 2026-09-14 — Mensagens do treinador ao abrir a app

**O que faz.** O `AICoachProvider` (padrão wrapper, em `src/state/ai-coach.tsx`) calcula no telemóvel a chave
do contexto atual e se há alguma coisa que justifique uma mensagem. Se já houver mensagem guardada para essa
chave, mostra-a logo, sem pedidos. Se não houver, pede-a em segundo plano à Edge Function `coach-message` e
mostra uma linha discreta a carregar. Sem contexto, sem conta ou com as sugestões desligadas, fica calada.
A mensagem aparece no topo do ecrã Jogos e fica também nas Novidades, já marcada como lida.

**A cache muda com o contexto, não com o tempo.** A chave junta o jogo mais próximo, a fase do dia de jogo, o
estádio, o último check-in e o número de estádios visitados. No telemóvel, a cache persistida do TanStack
Query guarda uma resposta por chave, sem expirar. No servidor, `unique (profile_id, context_key)` garante uma
mensagem por contexto: a mesma chave devolve a mensagem guardada e não escreve outra.

**Contextos, calculados em SQL (`coach_context`), por esta prioridade:**
1. Check-in ativo: um check-in nas últimas 3 horas, só do histórico da própria pessoa.
2. Dia de jogo do clube que apoias, uma mensagem por fase:
   - manhã: mais de 4 h antes do apito;
   - chegada: entre 4 h e 90 min antes;
   - antes do apito: menos de 90 min antes;
   - fim: até 3 h depois do apito final.

   Durante o jogo não há mensagem.
3. Marco do passaporte (3, 5, 10, 15…) atingido desde a última abertura (`coach_state.last_passport_count`).
   Na primeira abertura não há com que comparar, por isso não há marco.
4. Estádio novo: jogo do clube que apoias ou do clube da terra nos próximos 7 dias, num estádio onde nunca
   foste. Tem de faltar pelo menos 2 dias, para dar tempo de planear a ida; mais perto do jogo, só se já
   marcaste "Vou".

**Push diário.** A função `generate-nudges` corre às 10:00 de Lisboa. A lista vem de `coach_push_candidates`,
que só inclui quem tem as sugestões ligadas, um telemóvel registado, nenhuma mensagem nas últimas 6 horas e um
contexto válido. O check-in ativo nunca gera push. Sem contexto não se envia nada, e um contexto que já tem
mensagem não volta a ser enviado. Isto substitui `nudge_candidates` e os tipos antigos (tasco na primeira
visita, clube perto de ti), que ficam apenas nas linhas que já existiam.

**Frases e custo.** As regras são as mesmas de antes:
- os factos vêm do SQL e o texto sai de modelos de frase (três variantes e um recurso curto por tipo), a custo zero;
- o Claude continua desligado e o Claude Pro não cobre a API; se um dia for ligado, com `ANTHROPIC_API_KEY` e
  `AI_MONTHLY_BUDGET_USD`, há também um limite de 40 chamadas por pessoa por mês;
- uma mensagem guardada nunca diz "hoje" nem "amanhã", porque pode ser lida noutro dia: a data sai como
  "no sábado, dia 19".

**Modo demo.** A app envia a hora simulada. A função aceita-a até 60 dias de diferença da hora real, e isso só
afeta as mensagens da própria pessoa. Os check-ins usam sempre a hora real.

**Limitações.**
- A chave do telemóvel usa os dados da demo (por exemplo, os estádios visitados dos mocks) e a do servidor usa
  a base de dados, por isso as duas podem divergir. Mesmo assim, o servidor nunca escreve duas mensagens para o
  mesmo contexto.
- A mensagem guardada num telemóvel mantém-se enquanto a chave local não mudar, mesmo que o estado mude a
  partir de outro telemóvel.

## 2026-09-14 — Retrospetiva da época (fase C)

**Uma retrospetiva por utilizador por época** (`season_recap`, `unique (profile_id, season_id)`). Cada pessoa
só lê a sua e só pode marcar que a partilhou.

**Números em SQL** (`season_recap_stats`), dentro das datas da época em hora de Lisboa:
- jogos e estádios diferentes;
- estádios novos: a primeira ida de sempre a esse estádio foi nesta época;
- quilómetros de ida e volta em linha reta desde o estádio do clube da terra (sem clube da terra, não há km);
- tascos diferentes e o tasco onde mais voltou (só com pelo menos duas visitas);
- nota média (média das três notas de cada jogo, com uma casa decimal);
- distrito mais visitado.

**Quem recebe** (`season_recap_candidates`): tem a retrospetiva ligada, ainda não a tem nessa época e fez
pelo menos um jogo ou um tasco. Sem atividade não há retrospetiva, em vez de uma a lembrar o que não fez.

**Texto.** Modelos de frase com uma frase por facto que existe; nada sobre o que não foi feito. A chamada ao
`claude-opus-5` está preparada mas desligada, com as mesmas regras das dicas (só marcadores, sem algarismos
nem nomes escritos, título até 80 e texto até 600 caracteres, sem repreensão).

**Quando.** De 15 a 20 de junho, às 09:00 UTC (10:00 em Lisboa). Correr em vários dias apanha falhas; a
restrição única garante que ninguém recebe duas.

**App.** Ecrã Retrospetiva com os números (vindos de `stats`, nunca do texto), o texto e Partilhar, que usa a
partilha do sistema só com texto. Cartão no Perfil quando existe retrospetiva; a notificação abre o ecrã.

**Concordância nas frases.** Nomes no plural davam erros como "As Bifanas de Campanhã fica". As frases das
dicas e da retrospetiva foram reescritas para o verbo nunca depender do nome, e há um teste para isso.

**Verificado.** Testes do módulo das frases; teste SQL com dados sintéticos numa transação revertida;
teste real da função publicada (401 sem segredo, nada fora de junho, uma retrospetiva por modelo de frase,
nada na segunda execução).

## 2026-09-14 — Dicas para dias de jogo (fase B)

**Fluxo.** `pg_cron` (de hora a hora) → Edge Function `generate-nudges`, que só trabalha às 10:00 de Lisboa
(assim acerta com a mudança de hora, porque o cron corre em UTC) → `nudge_candidates` em SQL → frase →
tabela `nudge` → push pelo Expo. O endereço do projeto e o segredo do cron estão no Vault e nunca entram no git.

**Quatro tipos, por esta ordem de prioridade.** Todos os factos saem do SQL:
1. `tasco_primeira_visita`: marcou "vou" num jogo nos próximos 3 dias, num estádio onde nunca esteve; o tasco
   mais perto a pé (até 10 minutos).
2. `marco_passaporte`: registou nas últimas 24 horas o 3.º, 5.º, 10.º… estádio diferente.
3. `estadio_novo_em_casa`: o clube da terra (primeiro) ou o que apoia joga em casa em 1 a 6 dias, num estádio
   onde nunca esteve.
4. `clube_perto_de_ti`: o clube que apoia joga fora a 5–60 km da base (o estádio do clube da terra).

Nenhum tipo fala de quem não foi a jogos: sem candidato, não há dica.

**Garantias na base de dados.** No máximo uma dica por utilizador por dia (`unique (profile_id, local_date)`),
nunca repetida para o mesmo jogo (índice único) e com no máximo 140 caracteres (`check`). O utilizador só lê
as suas e só pode marcá-las como lidas. `nudge_candidates` só corre com a `service_role`. `ai_run` guarda só
contagens e tokens, sem dados pessoais.

**Custo zero.** As frases vêm de modelos de frase com três variantes e um recurso curto, escolhidos pela conta e
pelo dia. A chamada ao `claude-sonnet-5` existe mas só é usada com `ANTHROPIC_API_KEY` e
`AI_MONTHLY_BUDGET_USD` maior que zero, que não estão definidos. Mesmo com o modelo ligado, ele escreve só com
marcadores; o texto é recusado se tiver algarismos, nomes do catálogo escritos à mão, marcadores inventados,
mais de 140 caracteres ou tom de repreensão, e aí usa-se o modelo de frase. Uma chamada por mensagem, sem novas
tentativas, com limite de 10 segundos. Não se envia nome, email nem id do utilizador.

**Segurança da função.** Só aceita pedidos com o cabeçalho `x-cron-secret`. As opções `force` e `profile_ids`
servem para testes e também exigem o segredo.

**Push.** Projeto EAS grátis (`@martim03330/AwayDay`) e `expo-notifications`. Funciona no Expo Go em iOS; em
Android precisa de uma development build com FCM, e até lá as dicas ficam nas Novidades. A permissão só é pedida
quando a pessoa liga as dicas em Perfil → Notificações. Ao terminar sessão, o token deste telemóvel é retirado;
tokens que o Expo diz estarem mortos (`DeviceNotRegistered`) são apagados.

**`app.json`.** O `eas init` acrescentou uma lista fixa de permissões Android (microfone e serviços em primeiro
plano); foi retirada, porque os plugins tratam disso na build e não queremos pedir mais do que o necessário.

**Verificado.** Testes dos módulos (artigos e dias em Lisboa, marcadores, modelos de frase com nomes longos,
validação do texto do modelo, respostas do push); teste SQL dos candidatos com dados sintéticos numa transação
revertida; teste real da função publicada (401 sem segredo, nada fora das 10:00, uma dica por modelo de frase
com os factos certos, nada na segunda execução).

**Limitações.** Push em Android; o calendário da demo tem datas fixas, por isso só há dicas enquanto houver jogos
futuros no seed; tocar numa notificação com a app completamente fechada pode não abrir as Novidades.

## 2026-09-14 — Atividade na base de dados (fase A das mensagens com IA)

**Sem custos.** As mensagens (nudges e retrospetiva) vão ser escritas a partir de modelos de frase com
várias variantes, preenchidos com factos apurados em SQL. A API da Anthropic não tem plano grátis, por isso a
chamada ao Claude fica preparada mas só é usada se houver chave e orçamento definidos na Edge Function.

**Tabelas novas, todas com RLS na mesma migração:**
- `place`: os 25 tascos da demo (fictícios), com os mesmos ids dos mocks. Leitura pública.
- `fixture_attendance`: "vou" antes do apito e "fui" depois. É a base de dados que decide pela hora do
  jogo, não o relógio do telemóvel (nem a hora simulada do modo demo).
- `venue_review`: as notas dadas depois do jogo (1 a 5).
- `place_visit`: o histórico pessoal de tascos, só visível ao próprio e nunca agregado. Não é a futura
  tabela `checkin` de presença, que expira às 48h: a retrospetiva precisa de um histórico que dure a época.
- `device_token`: tokens de push. Registo pela função `register_device_token`, para o token passar para
  a conta que entrou por último no mesmo telemóvel.
- `profile.nudges_enabled` e `profile.recap_enabled`: cada pessoa escolhe se recebe.

**Nomes para frases em português.** Artigos (`name_article`), alcunhas conhecidas com o seu artigo (Luz,
Dragão, Alvalade, Pedreira, Barreiros, Restelo, Choupana, Fontelo, Arcos) e distrito. Distrito em vez de
NUTS II, que mudou em 2024 e é menos claro para um adepto.

**A app grava na conta** (só com sessão): check-ins e anulações, "Já estive aqui", avaliações de jogos e
o novo botão "Vou a este jogo". Usa a hora real e não trava a app se falhar. Os dados de demonstração dos
mocks não sobem para a conta, e a UI continua a mostrar a atividade local.

**Verificado** com testes SQL numa transação revertida: regras do "vou" e do "fui", notas fora de 1 a 5,
visitas no futuro, privacidade entre utilizadores, token a mudar de conta, anónimos só leem tascos, e a
atividade a desaparecer com a conta.

## 2026-09-14 — Autenticação e identidade

**Conta opcional.** A app funciona sem conta. A introdução ganhou um 4.º passo ("Guarda o teu passaporte":
criar conta, entrar ou agora não) e o Perfil tem um cartão de conta. Com conta, os clubes ficam guardados.

**Email e password.** Criar conta, entrar, sair (só neste telemóvel), recuperar password e apagar conta.
Apple e Google ficam para depois (precisam de conta de programador e configuração no painel).

**Confirmação por código de 6 algarismos, não por link.** O Expo Go não abre links para a app. Os modelos
de email em português estão em `supabase/templates/`. No plano grátis o Supabase só aceita modelos próprios
com SMTP próprio, por isso os emails saem pelo **Brevo** (`smtp-relay.brevo.com`, grátis até 300 por dia,
sem domínio próprio). As credenciais ficam em `supabase/.env`, fora do git, e o `config.toml` só as refere
com `env()`. O remetente é uma caixa criada só para a app, não um email pessoal. No Brevo, o bloqueio de IPs
desconhecidos tem de estar desligado: o Supabase envia de IPs que mudam, e com o bloqueio ligado o login SMTP
é recusado (`525 5.7.1 Unauthorized IP address`). O limite do Supabase passou de 2 para 30 emails por hora.
A app trata os dois casos, com e sem confirmação (`needsEmailConfirmation`).

**Para quando houver domínio próprio:** autenticar o domínio no Brevo (SPF, DKIM e DMARC) e trocar o
`SMTP_ADMIN_EMAIL`, para os emails não caírem no spam.

**Sessão em AsyncStorage**, que já estava instalado (o guia do Expo usa `expo-sqlite`, que seria uma
dependência nova). O token só é renovado com a app em primeiro plano.

**Regras de password iguais no cliente e no servidor:** 8 a 72 caracteres, com letras a-z e algarismos
(`minimum_password_length` e `password_requirements = "letters_digits"`).

**Criar conta avisa quando o email já tem conta** (mudado no mesmo dia, depois de testar na app). Com a
confirmação ligada, o Supabase responde a um email com conta confirmada como se fosse novo e não envia
código, e a pessoa ficava à espera de um código que nunca chegava. Nesse caso o Supabase devolve um
utilizador sem identidades; a app deteta isso (`signUpOutcome`) e mostra "Já existe uma conta com este
email", com "Entrar com este email" e "Recupera a password". O custo é que passa a dar para saber se um
email tem conta; os limites do Supabase (30 registos ou entradas por 5 minutos por IP) travam tentativas
em massa. Recuperar password continua com resposta neutra.

**`profile`** é criado por trigger quando nasce a conta; o nome vem dos metadados do registo ou fica
"Adepto" (nunca parte do email). Só o nome é editável (privilégio por coluna). Os perfis são legíveis
**só por utilizadores com sessão**, um desvio assumido ao "legível por todos" do §2.3.

**`profile_club`** guarda o clube que apoias (visível a quem tem sessão) e o clube da terra (**só o
próprio o vê**, porque aponta para onde a pessoa vive).

**`club_supporter_counts()`** devolve adeptos por clube só a partir de 5 pessoas (regra dos agregados).
É `security definer` porque os clientes não leem as linhas dos outros; só devolve contagens. A UI
continua a usar os números dos mocks por agora.

**`season` e `fixture.season_id`.** As épocas começam a 1 de julho e são deduzidas da data do jogo pelo
gerador do seed. Os jogos da demo (agosto e setembro de 2026) ficam em `2026-27`; a lista de clubes é a
de 2025/26.

**Apagar conta pela Edge Function `delete-account`.** Usa a `service_role`, que só existe no servidor.
`verify_jwt` está desligado e a função autentica quem chama com `auth.getUser`; recusa pedidos sem
sessão, só com a chave publicável ou com tokens inventados. O perfil e os clubes vão com a conta
(`on delete cascade`).

**Clubes entre o telemóvel e a conta** (`src/state/sincronizar-conta.tsx`): ao entrar, se a conta já tem
clube é a conta que manda (e salta a introdução); numa conta nova, guarda o que foi escolhido no
telemóvel; depois, cada mudança feita no telemóvel vai para a conta. Ao sair, o perfil em cache é esquecido.

**Configuração do Auth por `supabase config push`**, depois de alinhar o `config.toml` com o projeto (o
modelo do `supabase init` estragava definições do pooler, MFA e storage). O Twilio aparece ligado no
projeto sem credenciais e a CLI não o consegue desligar. No `config.toml` fica desligado (ligado exige
`account_sid`, e sem ele o ficheiro nem se lê); para o desligar no projeto, só pelo painel.

**Verificado:** testes SQL das políticas numa transação sempre revertida; teste de ponta a ponta pela API
com a chave publicável (registo, password fraca recusada, entrar, nome, clubes, privacidade do clube da
terra, apagar conta); testes da validação e da tradução dos erros (apanharam um bug: um código
`toString` devolvia uma função em vez de mensagem).

## 2026-09-14 — Dados dos estádios verificados

Capacidade, coordenadas e morada dos 34 estádios foram conferidas contra fontes, uma a uma, e corrigidas
no snapshot e na base de dados (seed com upsert aplicado com `supabase db query --linked -f`, sem migração nova).

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
snapshot, corre `npm run db:seed` e aplica os ficheiros alterados com
`supabase db query --linked -f supabase/seed/<ficheiro>.sql` (o seed faz upsert). O
`supabase db push --include-seed` só corre cada ficheiro de seed da primeira vez: depois de alterado,
limita-se a atualizar o registo do ficheiro sem mexer nos dados.

### Por confirmar

- ~~Capacidades, coordenadas e moradas dos estádios~~: verificadas a 2026-09-14 (ver entrada acima).
- **Preços dos transportes** continuam em euros com casas decimais nos mocks. Quando passarem para a
  base de dados, têm de ser cêntimos inteiros (regra 1).

### Limitações conhecidas

- Alguns módulos calculam listas logo ao carregar (`locais/index.tsx`, `lista-clube-terra.tsx`,
  `modo-demo-card.tsx`, `mocks/avaliacoes.ts`, `mocks/album.ts`) e ficam com o catálogo embutido.
  Enquanto a base de dados tiver os mesmos dados que o snapshot, não se nota.
- ~~O `CLAUDE.md` com as regras do projeto fora do repositório~~: já está na raiz desde 2026-09-14.
