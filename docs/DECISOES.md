# Decisões

Registo das decisões estruturais, com data e razão. A mais recente fica em cima.

## 2026-10-13 — Entrar com Apple e Google

- «Continuar com Apple» e «Continuar com Google» no topo de Entrar e Criar conta, com tokens nativos
  (`signInWithIdToken`, sem browser). Dependências aprovadas: `expo-apple-authentication` e
  `@react-native-google-signin/google-signin`. Passos de configuração em `docs/LOGIN-SOCIAL.md`.
- **Só iOS por agora.** Apple: só onde `isAvailableAsync()` diz que há. Google: só numa build nativa com os dois IDs
  de cliente (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`); o módulo é importado só nessa
  altura, porque no Expo Go não existe e rebentava ao importar. O URL scheme do plugin da Google vem de
  `GOOGLE_IOS_URL_SCHEME` (ou é calculado a partir do ID iOS) no `app.config.js`.
- Apple com **nonce**: SHA-256 em JS puro (`src/features/auth/social.ts`, sem `expo-crypto`) de 256 bits aleatórios
  do gerador seguro do sistema, nunca `Math.random`. Na Google o nonce é do SDK: «Skip nonce checks» no Supabase.
- Contas novas por Apple/Google não pedem código de email. Os termos aceitam-se pela frase acima dos botões
  («Ao continuar, confirmas que tens 18 anos ou mais e aceitas…», com a idade, como na caixa do email) e ficam
  registados como no registo por email (`terms_version`, `terms_accepted_at`), só se a conta ainda não os tiver.
- **Nome do perfil:** o trigger passa a usar `display_name`, depois `full_name` e `name` (a Google manda-os), e
  por fim «Adepto». **Nunca parte do email** (mantém a regra de 2026-09-14, e o formulário promete que ninguém vê o
  email). Um nome vindo da Apple/Google que seja ofensivo dá «Adepto» em vez de falhar a entrada; o nome escrito no
  formulário continua a ser recusado com `bad_name`. A Apple só dá o nome na primeira entrada e não no token: a app
  grava-o logo a seguir (`set_display_name`), só em contas sem nome nos metadados (uma conta de email que passe a
  entrar com a Apple mantém o nome que escolheu).

## 2026-10-13 — Perfis abertos a partir do ranking

- Tocar numa pessoa das tabelas (pontos, estádios, tascos) abre o perfil dela. Para isso, quem aparece no ranking
  passa a ter o perfil visível a qualquer utilizador (`can_see_profile_card`: «já se cruzaram» — agora
  `knows_profile` — ou «está no ranking», sempre respeitando bloqueios). Escolha do Martim: o **concelho** só aparece
  a quem já se cruzou (`public_profile` e `profile_cards`); a desconhecidos aparecem a foto, o nome, o clube, desde
  quando está na app, as boleias e os estádios carimbados. Pedir amizade continua a exigir terem-se cruzado.
- A política de privacidade e o texto de «Aparecer no ranking» dizem-no.

## 2026-10-13 — Plano de jogo automático, movimento e arranque

- **Plano automático:** uma boleia ou uma casa para um grupo põe o plano do jogo nesse grupo (`plan_for_group_game`,
  chamado pelos triggers que já ligavam boleias e casas a planos). Sem plano para o jogo, cria-o (com o «vou» de quem
  o fez e a mensagem no chat); com um plano aberto sem boleia ou casa, entra nele. Planos fechados ficam como estão.
  Apagar um grupo apaga primeiro os seus planos (senão as mensagens eram apagadas duas vezes e o Postgres recusava).
- **Movimento:** botões, chips e linhas encolhem ao carregar (`Premivel`, 0,97 ou 0,98, sem movimento com «Reduzir
  movimento»); números que rolam em 0,2 s nos pontos, níveis e contagens (`NumeroAnimado`), nunca em dinheiro;
  confetti nas cores do clube e vibração de sucesso ao carimbar o estádio, o grande momento da app; skeletons em vez
  de textos de «a carregar»; vibrações iguais em toda a app (`src/lib/vibrar.ts`: seleção, sucesso, erro).
- **Arranque:** o fundo da janela é o verde do ecrã de arranque e, depois, o fundo do tema (`expo-system-ui`); o
  arranque em modo escuro tem o verde escuro. Sem clarão branco.

## 2026-10-13 — Bloqueio com Face ID e «Esconder valores»

- **Bloqueio opcional** (Definições → Privacidade), com `expo-local-authentication` (dependência aprovada; precisa de
  build nativa). Desligado por omissão e guardado só no telemóvel (`bloqueioAoAbrir`). Pede Face ID, Touch ID ou
  impressão digital, sempre com o código do telemóvel como alternativa; sem biometria nem código, não bloqueia (ninguém
  fica fechado fora da própria app). Ligar pede uma confirmação primeiro. Pede ao abrir a app e ao voltar depois de
  mais de 1 minuto fora; enquanto a app está em segundo plano o ecrã de bloqueio tapa o conteúdo (captura do seletor
  de apps). Nunca no modo demo nem sem sessão. O texto do Face ID no `app.json` passa a ser o do
  `expo-local-authentication`, que fica antes do `expo-secure-store` na lista de plugins para ganhar.
- **Esconder valores:** um interruptor (Definições e o olho nas despesas da viagem) que mostra «•••• €» em vez de
  todos os montantes. Tudo o que mostra dinheiro passa por `useFormatarDinheiro`/`<Valor>` (`src/ui/valor.tsx`); o
  leitor de ecrã diz «valor escondido». As contas continuam em `src/lib/money.ts`. Os escalões de preço do filtro das
  casas ficam à vista: são rótulos de filtro, não dinheiro de ninguém.

## 2026-10-13 — Terminar sessão, limites, vizinho barulhento e desempenho

- **Terminar sessão:** as preferências que vêm da conta (clubes, escolhas de avisos, contas já perguntadas) são
  esquecidas ao sair, senão o clube de uma conta era gravado na seguinte. Ao sair apagam-se também as notificações
  entregues e o número no ícone, as fotos em cache, os canais em tempo real e o convite pendente. O telemóvel deixa de
  receber avisos da conta mesmo saindo sem rede (`forget_device_token`, que não precisa de sessão; se falhar,
  repete-se no arranque seguinte). Há «Terminar sessão em todos os dispositivos», e mudar a password termina as outras
  sessões.
- **Limites:** grupos até 100 pessoas (trigger em `fan_group_member`, cobre todas as entradas); chat de grupo 2 000
  por dia e 30 por minuto; edições 60 por hora; convites 30 por dia e 3 por dia da mesma pessoa à mesma pessoa;
  uploads 150 por dia por pessoa (nas políticas do Storage); «mencionou-te» no máximo 5 por hora da mesma pessoa à
  mesma pessoa; tabelas de limites limpas todas as noites. Emails do Supabase: subir para 100 por hora (Brevo, 300 por
  dia).
- **Ranking:** os totais de toda a gente ficam em `ranking_cache`. A linha de cada pessoa é refeita no momento em que
  ganha pontos (triggers nas 7 tabelas que dão pontos); a atualização de 5 em 5 minutos fica como rede de segurança.
- **Desempenho:** saiu o carregamento falso das fichas do jogo e do tasco; «Vou», resposta a planos, pedidos de
  amizade e de boleia mudam logo no ecrã (e voltam atrás se o servidor recusar); o catálogo de jogos é paginado (todos
  os jogos, para o histórico) e uma falha na meteorologia ou nos pontos de encontro já não deita fora o resto; os
  catálogos têm entradas próprias no telemóvel e a app abre logo com a cópia guardada; os chats com o canal em tempo
  real ligado só recarregam de 5 em 5 minutos; edge functions com pedidos em paralelo (boleias, check-in,
  notificações, que passaram de 3 consultas por aviso para 1).

## 2026-10-13 — Segurança, segunda volta (pontos baixos da revisão)

- **Dependências:** atualizações de correção do SDK 57 e `supabase-js` 2.117.3 na app. As edge functions ficam no
  2.116.0 (sem avisos; mudar obriga a refazer o `deno.lock` do `sync-weather`). Os avisos do `npm audit` que
  restam (braces, node-forge, decode-uri-component, uuid, sprintf-js) são de ferramentas de build e não têm versão
  corrigida compatível; não se usa `npm audit fix --force` (faz downgrades).
- **Tarefas automáticas:** `force`, `profile_ids` e `season_id` só valem com `ALLOW_TEST_OPTIONS=true` (nunca em
  produção).
- **Treinador:** a hora simulada da app só conta para administradores; para os outros manda o relógio do servidor.
- **Pontos de encontro:** a decisão de um rascunho muda o estado de `pending` num só passo; dois administradores
  ao mesmo tempo, só o primeiro conta. Se a publicação falhar, o rascunho volta à lista.
- **Despesas em nome de outro:** quem aparece como pagador recebe sempre um aviso («X registou que pagaste N €»),
  mesmo com os avisos de contas desligados, e pode apagá-la.
- **Erros fora dos ecrãs:** `ErrorUtils` e o rastreio de promessas do Hermes vão para os relatórios automáticos.
- **Testes de SQL no CI:** correm em cada push contra um Supabase criado do zero (migrações + seed + um catálogo
  público de teste em `supabase/tests/catalogo.sql`, gerado por `scripts/testes/exportar-catalogo.py`, sem dados de
  pessoas). Localmente continuam a poder correr contra a produção (`npm run test:sql`) ou contra um Supabase local
  (`SQL_ALVO=--local`).
- **Mapillary:** o token saiu do `.env.local` (o Expo copiava-o para os logs) para `scripts/.env`.

## 2026-10-13 — Captcha (Cloudflare Turnstile) nas contas

- **Porquê:** criar conta, entrar e recuperar a password estavam abertos a bots, só com o limite por endereço.
- **Como:** `react-native-webview` (dependência nova, aprovada) com o Turnstile numa WebView escondida
  (`CaptchaProvider`, por cima dos ecrãs de `/conta`). Antes de cada pedido protegido pelo Supabase (criar conta,
  entrar, reenviar o código, recuperar a password, confirmar a password ao apagar a conta) pede-se um código novo, de
  uso único. Normalmente ninguém vê nada; quando a Cloudflare quer um visto, o widget aparece por cima.
- **Chaves:** o site key é público (`EXPO_PUBLIC_TURNSTILE_SITE_KEY`, no `.env.local` e nos ambientes do EAS); o
  secret key fica só no Supabase. O hostname do widget é `martim03330.github.io` (o `baseUrl` da WebView).
- **Ordem:** só se liga o captcha no Supabase depois de o build com captcha (build 10) chegar aos testers; sem isso,
  quem tem o build 9 deixava de conseguir entrar. Sem site key, a app funciona como antes (testes, builds antigos).

## 2026-10-13 — Revisão de segurança (50 pontos)

Revisão completa: segredos, base de dados, edge functions, app, dependências e operação. Sem falhas críticas; o que
mudou:

- **Notificações só com chaves:** os triggers mandam o tipo e a chave da linha; `social-notify` e `ride-notify` releem
  tudo na base de dados e só aceitam `NOTIFY_SECRET` (`x-notify-secret`, Vault `notify_secret`), separado do segredo
  do cron. Razão: com o segredo do cron, alguém podia mandar qualquer texto a qualquer pessoa. A comparação dos
  segredos passou a não revelar o comprimento.
- **«Esta conta existe?»:** o limite por endereço usa `cf-connecting-ip` (posto pela Cloudflare) e, sem ele, a última
  entrada do `x-forwarded-for`; mais um teto de 300 por hora para todos. Antes contornava-se com um cabeçalho
  inventado (confirmado com 25 pedidos seguidos).
- **Administração:** `set_feedback_status` passa por `is_admin()` (pede o segundo fator). Registo `admin_action_log`,
  só de acrescentar, cheio por triggers nas tabelas que a moderação muda (denúncias, fotos, tascos rejeitados,
  feedback, rascunhos de pontos de encontro, mensagens escondidas, fotos de perfil tiradas, quem é admin). Só ids e
  o antes/depois da coluna, nunca texto de mensagens.
- **Edge functions:** `walking-route` só com sessão (era um proxy aberto ao router da comunidade); os links de
  pontos de encontro só do próprio site do clube; o log de `rides` deixa de levar coordenadas.
- **App:** os avisos de boleia agendados apagam-se ao sair da conta; o histórico de tascos visitados deixa de ir para
  o disco do telemóvel.
- **Operação:** verificação diária (`saude`, no workflow de manter acordado) que falha, e manda email, quando uma
  tarefa agendada falha, uma função responde com erro do servidor ou a meteorologia para. Versão do Supabase CLI fixa
  no workflow das cópias.

## 2026-10-12 — Tabela de pontos com toda a gente, mesmo com 0 pontos

- A tabela de pontos (`ranking_leaderboard`) mostra toda a gente que aparece no ranking, também quem ainda tem 0
  pontos; os empates ficam por ordem alfabética. Razão: sem carimbos, a tabela ficava vazia e parecia avariada.
  Vale para os testers e para os utilizadores reais.
- As subidas e descidas de divisão continuam a contar só quem somou pontos na época.

## 2026-10-12 — Administração fora das Definições

- As ferramentas de administração (pontos de encontro, fotos, denúncias, feedback) saem das Definições para um ecrã
  próprio, `perfil/administracao`, que se abre com um toque longo na versão da app, no fundo das Definições, e só
  para contas com `is_admin`. Continua a pedir o código da app de autenticação, e cada ferramenta continua a
  verificar no servidor. Razão: um utilizador normal não deve ver nada disto, nem saber que existe.
- **Aspeto:** só as três opções (Claro, Escuro, Como o telemóvel), sem texto por cima; o texto confundiu um tester.

## 2026-10-12 — Toda a gente no ranking por omissão; Ranking mais simples

- **Aparecer no ranking:** passa a estar ligado por omissão para todos (`show_in_rankings default true`, contas
  existentes incluídas). Os testers não apareciam nas tabelas porque quase ninguém tinha ligado a opção. Desliga-se em
  Definições → Privacidade; a política de privacidade passa a falar em interesse legítimo com direito de oposição.
- **Página do Ranking:** sai a lista do fundo (Tabelas, Missões e distintivos, Quem vai à bola), que repetia o que
  está em cima. Chega-se às missões por «Ver todos os desafios» e às tabelas pela divisão ou por «Ver as tabelas».
- **Tabelas:** «Quem vai à bola» deixa de ser um ecrã à parte e passa a ser o separador «Adeptos». Cada linha mostra
  só o nome, o nível e o número; sem título do nível, divisão nem clube, e sem os textos explicativos por cima.

## 2026-10-12 — «Fui a este jogo» só com o carimbo do estádio

- **Erro corrigido:** marcar «Vou» (ou entrar num plano) e depois avaliar o jogo contava como ter ido: o jogo
  aparecia em «Jogos a que foste», o estádio entrava no passaporte e soava o carimbo. A avaliação gravava
  `fixture_attendance = 'attended'`, e o servidor aceitava-o de qualquer pessoa depois do apito.
- **Regra:** só o carimbo (`stamp_stadium`, verificado no servidor: a menos de 1 km do estádio, de 4 h antes a 5 h
  depois do apito) marca um jogo como ido. A app só pode escrever «vou» antes do apito; avaliar só é possível a quem
  carimbou (`stamped_fixture`). Na app, «Jogos a que foste», «Os teus jogos», o passaporte e o «Avaliar» seguem o
  carimbo; avaliar não dá carimbo nem toca o som.
- O ranking e as missões já só liam `stadium_visit`: não foram afetados. A retrospetiva, o treinador e as dicas liam
  'attended', que agora só existe com carimbo.
- **Dados:** 2 registos «fui» sem carimbo voltaram a «vou». As 2 avaliações sem carimbo ficaram (nunca contaram
  pontos).
- **Sem travessões:** nenhum texto da app usa «—» a meio de frases. O ESLint recusa-o e a IA tem a regra no pedido.

## 2026-10-12 — Menos informação nos ecrãs e apresentação da app

Pedido dos testers: limpar o que estava «amontoado».

- **Boleias:** lugares como «2/4 livres» (lista e ficha). A lista deixa de mostrar o historial do condutor (fica na
  ficha) e a ficha deixa de mostrar o «cheia: X €» junto ao preço (está na conta mais abaixo).
- **Linha de detalhes** (`src/ui/linha-detalhes.tsx`): o «·» fica no fim da parte anterior, para nenhuma linha começar
  com um ponto solto, e há mais espaço entre partes.
- **Estacionamento:** cada parque só com o tempo a pé, se costuma encher e a hora de chegada. Os avisos ficam à vista
  só com a primeira frase. As razões de cada parque, os avisos completos e as fontes ficam juntos, uma vez, em
  «Porquê e fontes» no fim. Nas boleias, cada parque é uma linha («11 min a pé · Pode ser difícil»).
- **Perfil em menu** (referência: Betclic): da parte de baixo, só linhas com ícone, título e um número quando ajuda;
  o resto abre na própria página. Tascos visitados ganharam página.
- **Apresentação com caixinhas** (`src/components/apresentacao-guiada.tsx`): por cima dos separadores reais, o ecrã
  escurece, o separador explicado fica iluminado e uma caixa com seta diz o que lá está. Uma vez a seguir à introdução
  (`apresentacaoVista`) e outra vez em Definições → Ver a apresentação. Nunca em modo demo nem nas capturas. A posição
  dos separadores é estimada (a barra nativa não diz onde está): flutuante no iOS 26, a toda a largura antes e no
  Android. Os textos são para o Martim corrigir.
- **Estacionamento redesenhado:** o recomendado em destaque (hora de chegada e «Como chegar de carro»), os outros numa
  lista com bolinha de cor e um botão redondo para o caminho, avisos atrás de um toque. Saíram as fontes e a legenda
  das cores: cada parque diz o estado por palavras.
- **Perfis em toda a app:** tocar numa pessoa abre o perfil (`useAbrirPerfil`), e no perfil dá para pedir amizade a
  quem se cruzou contigo.

## 2026-10-12 — Navegação: listas sempre por baixo, barras de cor fixa

- **Cada stack das tabs começa na sua lista** (`unstable_settings = { anchor: 'index' }`). Um link (por exemplo, uma
  boleia partilhada) abria a ficha sozinha no separador: «voltar» não tinha para onde ir e tocar no separador voltava
  à mesma ficha. Os testers ficavam presos até reiniciar a app.
- **Sem os efeitos de borda do iOS 26** (`scrollEdgeEffects` escondidos em todas as stacks,
  `src/constants/navegacao.ts`) e a barra de baixo sem transparência no fim da página: as barras pareciam mudar de cor
  com o scroll.
- **«Voltar ao topo»**: botão redondo nas páginas longas. As páginas principais (que começam no 0) voltam ao sítio se
  ficarem presas a meio de um «puxar para atualizar». Nas folhas (formSheet) o `Screen` não leva o botão: o
  contentor com `flex: 1` ficava sem altura e a folha aparecia em branco.

## 2026-10-12 — A app usa-se sempre com conta

- **Decisão do Martim:** deixa de haver «Espreitar sem conta». As boas-vindas só oferecem «Criar conta» e «Já tenho
  conta», e as tabs só abrem com sessão (`NavegacaoRaiz` em `src/app/_layout.tsx`).
- Terminar sessão ou apagar a conta volta às boas-vindas, e a introdução deixa de estar marcada como feita. Ao entrar
  de novo, uma conta com clube salta direto para as tabs; uma sem clube passa pelos passos do perfil.
- Exceções: o **modo demo** (capturas para as lojas) e as builds **sem Supabase** (desenvolvimento) continuam a abrir
  sem conta.
- Enquanto a sessão guardada carrega ao abrir a app, quem já fez a introdução vê as tabs, para as boas-vindas não
  piscarem.
- Ficam no código os ecrãs «precisas de conta» e o modo «telemovel» (dados só no telemóvel). Já não se chega lá, e
  tirá-los é uma limpeza à parte.
- Maestro: saíram os percursos sem conta (01 e 02); os comuns entram com a conta de testes.

## 2026-10-12 — «Esqueceste a password?» diz logo se o email não tem conta

- Antes de enviar o código, a app pergunta ao servidor se o email tem conta (`email_has_account`). Se não tiver,
  aparece a vermelho por baixo do campo «Não há nenhuma conta com este email», com «Criar conta com este email».
- **Troca consciente (decisão do Martim):** isto deixa qualquer pessoa saber se um email tem conta na AwayDay. Preferiu
  a clareza. Para dificultar testar listas de emails, cada endereço de rede só pode perguntar 20 vezes por hora
  (`anon_rate_limit_hit`; não há conta, por isso o limite não pode ser por pessoa).
- Se a pergunta falhar (sem rede, limite atingido), a app envia o código na mesma, como antes.

## 2026-10-12 — Sem nomes ofensivos

- Nomes de pessoas, de grupos e de viagens passam por uma lista de palavrões e insultos (português, algum brasileiro
  e inglês), **no servidor**, com um trigger em cada tabela (`refuse_offensive_name`): recusa com `bad_name` por
  qualquer caminho. A criação de conta pergunta antes (`name_allowed`, aberta a quem ainda não tem conta) para dizer
  «Escolhe outro nome» em vez de falhar.
- O nome é normalizado antes de comparar: sem acentos, algarismos e símbolos lidos como letras («c4br40»), letras
  repetidas juntas («merdaaa»), plurais. As palavras curtas só contam inteiras («Barcelona» não é «cona»); algumas
  longas contam também escritas juntas ou com pontos («f.i.l.h.o d.a p.u.t.a»).
- Ficaram de fora de propósito, por falsos positivos: «caralho» escrito junto (a caralhota de Almeirim), «niger» (um
  país), «dick» (um nome próprio).
- Nomes já gravados ficam até serem mudados. A 2026-10-12 havia um perfil apanhado pela lista; muda-se à mão ou por
  denúncia.
- É uma lista, não moderação a sério: apanha o óbvio. O resto continua a ir pelas denúncias.

## 2026-10-12 — Menções no chat: @Nome e @todos

- Escrever «@» na conversa do grupo ou do carro abre a lista de quem lá está, com **@todos** primeiro. Tocar num nome
  escreve «@Nome». Na bolha, as menções ficam a negrito e uma mensagem que te menciona leva uma marca amarela.
- A app tira as menções do texto pelos nomes de quem está na conversa (`src/lib/mencoes.ts`) e manda os ids. O servidor
  só guarda pessoas que estão mesmo na conversa e nunca o autor (`group_message.mentions`, `mentions_all`).
- **Notificações (decisão do Martim):** quem é mencionado recebe «X mencionou-te», e com @todos todos recebem «X
  mencionou todos», **mesmo com essa conversa silenciada** nas definições, como no WhatsApp. Quem bloqueou o autor
  continua a não receber nada. Para não se abusar disso, cada pessoa só pode usar **@todos 10 vezes por dia**.
- Editar uma mensagem não muda quem foi mencionado (nem volta a notificar).

## 2026-10-12 — Chat como no WhatsApp: responder, reagir, editar, perfis, plano fixado e aviso de mensagem

Pedido dos testers. Vale para a conversa do grupo e para a do carro (`src/ui/conversa.tsx` é a mesma para as duas).

- **Responder:** deslizar a bolha para a direita (vibra quando apanha) ou «Responder» no menu. A resposta leva a
  citação (nome e texto). Se a mensagem citada for apagada, escondida ou de alguém que bloqueaste, fica
  «Mensagem indisponível» — a citação vem do servidor, que aplica as mesmas regras de visibilidade.
- **Reagir:** carregar sem largar abre o menu com 6 reações (👍 ❤️ 😂 😮 😢 ⚽) e as ações. Uma reação por pessoa e
  por mensagem; a mesma outra vez tira-a. **Exceção à regra «sem emojis na interface»**: nas reações usam-se emojis,
  porque é o que toda a gente conhece do WhatsApp (decisão do Martim). As reações de quem bloqueaste não contam.
- **Editar:** só as tuas mensagens de texto e só até **15 minutos** depois de enviadas (como no WhatsApp: corrigir uma
  gralha, não reescrever a conversa depois de os outros responderem). Fica «editada» junto à hora.
- **Perfil público** (`/pessoa/[pessoaId]`): tocar na cara ou no nome numa conversa, ou numa pessoa da lista do
  grupo. Só o que já era público nos cartões (nome, foto, cidade, desde quando, boleias) mais o clube e os estádios
  carimbados. Nunca localização. Só para quem partilha um grupo, uma boleia ou amizade (`can_see_profile_card`).
- **Plano fixado:** o próximo jogo combinado fica numa barra por baixo do cabeçalho da conversa do grupo, até 3 horas
  depois do apito. Com a malta a falar, o cartão do plano deixava de se ver.
- **Aviso de mensagem nova:** com a app aberta, as mensagens de grupos e carros deixam de mostrar o banner do sistema
  e passam a ter um aviso pequeno da app, que desce do topo e desaparece ao fim de 3,5 s. Não aparece se essa
  conversa já estiver aberta. Depende das notificações push: não se vê no Expo Go no Android.
- **Carro com Realtime:** a conversa do carro passou a atualizar logo (canal privado `ride:<id>`, só para quem vai no
  carro); antes só de 15 em 15 segundos.
- **Compatibilidade:** os parâmetros novos têm valor por omissão e as funções de leitura só ganharam colunas, por isso
  as builds já instaladas continuam a funcionar.

## 2026-10-12 — Atualizações sem compilar (EAS Update) e vibração (expo-haptics)

- **Porquê:** cada correção dos testers obrigava a uma build nova no TestFlight (30 a 60 minutos). Com o
  `expo-updates`, as mudanças só de JavaScript, estilos e imagens chegam com `eas update`. Os testers recebem-nas ao
  fechar e reabrir a app (às vezes são precisas duas aberturas: uma descarrega, a seguinte aplica).
- **Canais:** as builds `production` (TestFlight e lojas) ouvem o canal `production`; as `preview` ouvem `preview`.
- **Compatibilidade:** `runtimeVersion` segue a versão da app (`policy: appVersion`, hoje 1.0.0). Uma atualização só
  chega a builds com a mesma versão. **Sempre que entrar código nativo novo (uma biblioteca nativa, um plugin, mudanças
  no `app.json`), sobe-se a `version` e faz-se uma build nova**, senão uma atualização pode chegar a uma build que não
  tem o código nativo de que precisa.
- **expo-haptics:** entra já nesta build para as reações e o deslizar para responder do chat, para que essas mudanças
  possam depois chegar por atualização.

## 2026-10-12 — Sem clube por omissão; voltar atrás sempre visível

- **Clube:** deixou de haver clube por omissão (era o Benfica). Quem salta a escolha na introdução fica sem clube
  (`clubeFavoritoId: null`) e nada é gravado na conta. Antes, saltar gravava o Benfica no servidor como clube apoiado.
  Sem clube, os Jogos mostram todos os jogos com um atalho para escolher o clube, e os Locais abrem num estádio que já
  tem tascos. Contas antigas que saltaram a escolha continuam gravadas como Benfica: não dá para as distinguir de quem
  escolheu mesmo o Benfica, por isso não se mexe nelas.
- **Voltar atrás:** a conversa do grupo, a do carro e a viagem abrem por cima das tabs, num stack próprio. Abertas por
  uma notificação, podiam ficar sem botão de voltar. Agora têm sempre um (`src/ui/botao-voltar.tsx`), que sem
  histórico vai para a Malta ou para os Jogos.
- **Criar grupo:** só a chamada ao servidor conta como falha. O refresh e a navegação a seguir já não mostram «Não deu
  para criar o grupo» com o grupo já criado (tentar outra vez criava um segundo). Erros desconhecidos vão para o relatório
  automático com a mensagem real.

## 2026-10-09 — Fotos até 1 600 px, e plano Pro do Supabase

- **Fotos:** antes de enviar, o lado maior é reduzido a 1 600 px (`src/lib/medida-da-foto.ts`), além de a foto ser
  regravada sem metadados. Uma foto de 12 MP passa de cerca de 500 KB para 150–200 KB. Carrega mais depressa com os
  dados móveis do estádio e gasta menos armazenamento e tráfego, que eram os primeiros limites do plano gratuito.
  Uma foto já pequena nunca é aumentada.
- **Capacidade, medida a 2026-10-09:** base de dados com 43 MB (quase tudo catálogo) e fotos com cerca de 17 MB. No
  plano gratuito, os primeiros limites eram o armazenamento das fotos (1 GB), o tráfego (5 GB/mês) e os 30 emails por
  hora.
- **Plano Pro:** o dono passa para o plano Pro (25 $/mês) em outubro de 2026. Fica com cópias diárias (7 dias), sem
  pausas por inatividade, com proteção contra palavras-passe divulgadas e com limites muito maiores. Deve manter o
  Spend Cap ligado. A cópia semanal no GitHub fica como segunda cópia, fora do Supabase. O workflow para manter o
  projeto acordado deixa de ser preciso, mas não faz mal.

## 2026-10-09 — Lista de segurança final

Cada ponto foi verificado com provas, em vez de ser assumido:
- **Chaves no frontend:** no bundle de produção só está a chave pública do Supabase. O texto `sb_secret_` que lá aparece
  vem da biblioteca, que o usa para reconhecer o tipo de chave; não é uma chave. Não há `.env`, chaves de serviço nem
  certificados no Git (procura em todo o histórico).
- **Tokens:** a sessão fica no Keychain/Keystore (2026-10-08). A cache das consultas (AsyncStorage) não tem tokens.
- **Ids enviados pelo telemóvel:** todas as funções que recebem o id de uma pessoa verificam `auth.uid()`. A exceção
  era `can_share_house`, que dizia a qualquer pessoa se outra estava suspensa das boleias. Deixou de poder ser chamada
  pela app, e a app usa `i_can_share_house()`, que só responde sobre quem pergunta (`20261009160000`).
- **RLS, permissões, SQL:** todas as tabelas têm RLS. Nenhuma função monta SQL com `execute`. Todas as funções
  definer têm `search_path` fixo.
- **Storage:** os buckets privados estão limitados a imagens de 1 a 8 MB. Os dois públicos (estádios e tascos
  aprovados) não têm políticas de escrita: só o servidor escreve.
- **Assinaturas de webhooks:** não há webhooks de terceiros. As chamadas da base de dados às Edge Functions levam o
  segredo do cron, comparado em tempo constante.
- **CORS e cabeçalhos:** a app é nativa e as Edge Functions não respondem com CORS, por isso nenhum site consegue
  chamá-las a partir de um navegador. As páginas públicas (GitHub Pages, sem cabeçalhos próprios) passam a ter
  Content-Security-Policy por `<meta>`: as legais sem scripts nem recursos de fora, a dos convites só com o seu
  script. Testei num Chrome sem janela que a página dos convites continua a funcionar.
- **Stack traces:** as funções devolvem códigos genéricos, o ecrã de erro não mostra o erro, e nenhum ecrã mostra
  mensagens cruas do servidor.
- **Pacotes:** `npm audit fix`, só com correções compatíveis, tirou a falha crítica (`shell-quote`) e 3 altas. As
  restantes são de ferramentas de desenvolvimento (Jest, Metro, CLI do Expo), que não vão dentro da app; as
  «correções» propostas são versões antigas que partiam o projeto. Confirmei com `expo install --check` e um bundle
  de iOS.
- **2FA para administradores:** `is_admin()` exige uma sessão `aal2`, ou seja, um código de uma app de autenticação
  (TOTP do Supabase Auth, gratuito) (`20261009170000`). A Edge Function dos pontos de encontro exige o mesmo. Na app,
  as ferramentas de administração só aparecem depois do código, e da primeira vez a app ajuda a ligar a app de
  autenticação. Os testes SQL passam a usar sessões `aal2`, e há um teste para um administrador sem o segundo fator.
- **Cópias:** cópia semanal cifrada no GitHub, com restauro num Supabase vazio e comparação das linhas tabela a tabela
  (`.github/workflows/copia-base-de-dados.yml`, `docs/COPIAS.md`). Precisa dos segredos `SUPABASE_DB_URL` e
  `BACKUP_PASSPHRASE`, que só o dono tem.
- **Pelo caminho:**
  - O GitHub corria os testes e falhava: o `tsc` via o projeto do vídeo em `docs/` e faltava a declaração de `*.css`.
  - Os preços noutras moedas passam a ter sempre 2 casas decimais: os dados locais novos davam 0 casas ao forint, e
    o `Intl` arredondava.

## 2026-10-09 — Uma hora no estádio antes do apito

A hora de chegada ao parque usava 30 minutos de folga, e a hora de saída sugerida usava 45 (75 nos jogos grandes). Um
jogo às 18:00 com o parque a 20 minutos a pé dava «chega até às 17:10»: à porta às 17:30, sem tempo para filas nem
para o tasco. Agora as duas contas usam a mesma margem: estar no estádio **1 hora antes do apito**, ou **1h30 nos jogos
grandes** (`MARGEM_MINUTOS`, `MARGEM_JOGO_GRANDE_MINUTOS` em `src/lib/hora-saida.ts`). O mesmo jogo dá «chega até às
16:40». O limite do servidor (sair até 30 minutos antes do apito) não muda: o condutor continua a poder escolher mais
tarde, e a app avisa que fica apertado.

## 2026-10-09 — Boleias: canceladas desaparecem, um carro por jogo, e outro grupo entra por convite

- **Boleia cancelada:** desaparece logo de todas as listas, também para o condutor e os passageiros. O quadro de
  boleias só devolve boleias abertas. Quem tinha lugar ou pedido continua a receber «Boleia cancelada» (notificação
  e aviso na app). Se a boleia era de um plano, o grupo recebe um aviso na conversa. A limpeza nocturna continua a
  apagar as canceladas ao fim de 2 dias (migração `20261009130000`).
- **Um carro por pessoa e por jogo:** quem oferece boleia não pede lugar nem entra pelo plano noutra boleia do mesmo
  jogo, e quem tem lugar ou um pedido pendente não oferece boleia para esse jogo. A regra está em triggers
  (`20261009140000`), por isso cobre todos os caminhos. A app explica e esconde «Pedir lugar» a quem já conduz.
- **Grupos apagados com boleias privadas:** apagar um grupo (sai a última pessoa) falhava se houvesse uma boleia só
  para esse grupo. Antes de o grupo desaparecer, as boleias abertas são canceladas e nenhuma fica privada
  (`20261009120000`).
- **Num plano, a boleia é do grupo ou de toda a gente:** ao oferecer boleia a partir de um plano, as opções são «Só a
  malta do «grupo»» ou «Toda a gente». Deixou de dar para escolher outro grupo. Chamar outro grupo é um convite
  feito no plano: «Convidar», «Convidado», «Retirar o convite». No grupo convidado aparece «Convite da malta do
  «X»», e os avisos na conversa dizem «convidou» e «retirou o convite» (`20261009150000`).

## 2026-10-09 — Preparar o teste de 15 de outubro: lacunas fechadas

Depois de uma revisão do que faltava (testes, lançamento e configuração do Claude), sem instalar o Ruflo:
- **Mapa dos tascos:** conta contas com email confirmado, em vez de contas com 3 dias (migração `20261009090000`).
  Os testadores contam no primeiro dia; mantêm-se os múltiplos de 5 e a atualização de 5 em 5 minutos.
- **Dinheiro sem duplicados** (`20261009100000_trip_money_idempotency.sql`): `add_trip_expense` e `add_trip_settlement`
  aceitam `p_client_id`. O id pertence a quem o usou primeiro: repetir devolve a linha que já existe, e outra pessoa
  com o mesmo id recebe `duplicate_request`. A app gera o id uma vez por formulário ou por linha de pagamento e reusa-o
  nas novas tentativas. As fontes, por ordem: `crypto.randomUUID`, `expo.uuidv4` e `crypto.getRandomValues`; nunca
  `Math.random`. Sem nenhuma delas, a app envia sem id, como antes.
- **Acerto de contas:** cada pessoa entra uma vez numa divisão, mesmo que venha repetida. Ids repetidos juntam-se,
  nunca há transferências para si próprio, e os saldos têm de ser inteiros. A ordem dos cêntimos que sobram é a do
  servidor.
- **Datas em Lisboa:** «Hoje», «Amanhã» e «Ontem» comparam dias do calendário, não 24 horas. Uma hora que não existe
  (mudança de hora em março) avança, e uma hora ambígua (outubro) fica com o primeiro instante.
- **Edge Functions:** a leitura das rotas, as regras do check-in, o segredo do cron e a janela de reautenticação
  passaram para módulos puros em `_shared`, todos com testes. Uma rota guardada com defeito é ignorada e calculada
  outra vez, e um erro no preço responde `cost_failed`, com mensagem na app.
- **Notificações:**
  - «Ligar avisos» na introdução pede mesmo a autorização ao telemóvel e regista o aparelho. Sem conta, pede no
    primeiro login.
  - Tocar numa notificação com a app fechada abre o ecrã certo.
  - Os lembretes locais de jogo também (liam `fixtureId` e enviavam `jogoId`).
  - As falhas a registar o aparelho são enviadas, no máximo uma por arranque, pelo formulário de opinião.
- **Erros de ecrã:** `ErrorBoundary` na raiz com «Algo correu mal neste ecrã» e «Tentar outra vez». O erro vai pelo
  formulário de opinião, uma vez por erro.
- **Versão:** a opinião e as Definições mostram «Versão X (build Y)». O número da compilação vem do binário, sem
  dependências novas.
- **Caixa de entrada para administradores:** «Erros e ideias recebidos», em Definições.
- **Sem ligação:** a Malta e a conversa de um grupo mostram «Sem ligação», e não «Ainda sem malta» ou «Já não estás
  neste grupo».
- **Puxar para atualizar** em Jogos e Locais vai mesmo buscar os dados e aplica o catálogo novo. Normalmente só se
  aplica no arranque seguinte, mas aqui é a pessoa que o pede. O carregamento fingido desapareceu.
- **Convites:** a ligação partilhada passa a ser https, para o WhatsApp a deixar tocar
  (`https://martim03330.github.io/awayday-legal/convite/?c=…` ou `?boleia=…&jogo=…`).
  - A página tenta abrir a app; se não der, mostra o código e como instalar.
  - Na Malta há «Tenho um código».
  - Um convite aberto sem sessão é guardado e retomado depois do login.
  - Depois de entrar, espera pela lista de grupos, para nunca piscar «Já não estás neste grupo».
- **Textos legais:**
  - Juntam-se a Brevo (emails dos códigos), o Photon, o IPMA e o MET Norway.
  - Explicam o que fica depois de apagar a conta: fotos de tasco anónimas e fotos de grupo e de viagem.
  - Explicam que se guarda o ponto de encontro da boleia, não a posição.
  - Há uma página pública para apagar a conta (pedida pelo Google Play).
  - As notas para a revisão das lojas estão em `docs/REVISAO-LOJAS.md`, com classificação 18+.
- **Compilações:**
  - Sem áudio em segundo plano.
  - Sem os avisos em inglês do Face ID e do movimento.
  - O Android sem `SYSTEM_ALERT_WINDOW` nem acesso ao armazenamento.
  - Ícone das notificações definido.
  - A pré-visualização Android sai em APK.
  - `app.config.js` junta, só na compilação, a chave do Google Maps para Android e o `google-services.json`, a partir
    das variáveis do EAS. Ficam fora do Git.
  - A chave do Maps é a exceção à regra 3: só desenha o mapa e fica presa à app e ao certificado.
- **Ferramentas:** `npm run check` corre os tipos, o lint e os dois conjuntos de testes. `npm run db:types` regenera os
  tipos. Uma GitHub Action corre `check` a cada envio.
- **Configuração do Claude:**
  - O `CLAUDE.md` passa a ter os comandos reais (projeto remoto, sem `db reset`) e as lições aprendidas.
  - O task-observer passa a correr só a pedido: em quatro sessões não registou nenhuma observação.
  - Saíram 17 skills que não servem o projeto.

## 2026-10-08 — O plano fica parado no apito inicial, aviso nas boleias para as ilhas e sem NIF público

- **Plano depois do jogo:** a partir do apito inicial, o plano é uma recordação de quem foi.
  - **No servidor** (migrações `20261008160000` e `20261008160100`): triggers recusam com `fixture_over` respostas
    novas, mandar o plano a outro grupo, votos na casa, e mudanças de estado, carro ou casa.
  - **Quem é travado:** só pessoas (`auth.uid()` presente, também dentro das RPCs). As tarefas do servidor e as
    cascatas continuam a funcionar, e retirar a resposta ou o plano de um grupo nunca é bloqueado.
  - **Na app:** o cartão e o ecrã do plano usam a hora real (`useRealNow`, não a do modo demo), porque é a que o
    servidor usa. Escondem os botões, mostram «O jogo já começou» ou «O jogo já foi», e resumem o carro e a casa só
    para leitura. «Quem vai» passa a «Quem foi».
- **Boleias para as ilhas:** ao oferecer boleia para um jogo na Madeira ou nos Açores, aparece um aviso: a boleia faz
  sentido para quem já está na ilha. Um ponto de encontro a mais de 80 km do estádio (fora da ilha) não deixa calcular
  o percurso. De qualquer forma, o router não encontraria estrada do continente.
- **Sem NIF nos textos legais:** a app é gratuita e não é um negócio, por isso os deveres de prestador do DL 7/2004
  (art. 10.º) e de comerciante do DSA não se aplicam, e o RGPD só pede identidade e contacto. O NIF saiu da app, das
  páginas geradas e do repositório público `awayday-legal`, cujo único commit foi substituído por um sem NIF. Volta,
  com uma morada comercial, no dia em que a app tiver receitas.

## 2026-10-08 — Correções da revisão de segurança

Revisão completa (base de dados real, 13 Edge Functions e app) antes do teste de 15 de outubro. Migração
`20261008110000_security_fixes.sql`, funções e app:
- **Planos:** só se liga a um plano a boleia ou a casa de alguém que vê o plano (o condutor ou o dono está no grupo
  ou num grupo a quem o plano foi mandado). Isto é verificado ao ligar e outra vez ao entrar, e a sessão de contas
  do plano só adota a sessão de uma boleia nessas condições. Antes, quem criava um plano podia meter-se na boleia
  de um desconhecido sem aprovação e lançar-lhe despesas. Entrar numa casa do plano também exige `can_share_house`.
- **Ponto de partida das boleias:** o quadro de boleias dá o ponto exato só ao condutor e aos passageiros aceites;
  os outros recebem-no arredondado a duas casas decimais (cerca de 1 km). O pin já não começa na posição GPS: o mapa
  centra ali, mas o condutor tem de tocar num sítio, e se usar a posição atual aparece um aviso.
- **Perfis:** `profile_cards` e as fotos de perfil só para quem tem razão para ver a pessoa (`can_see_profile_card`:
  caminhos cruzados, condutor com boleia aberta, alguém num plano que se vê, admin), nunca para quem foi bloqueado.
  A pasta `avatars` deixou de se poder listar.
- **Dinheiro:**
  - Um acerto registado por quem paga não pode passar do que deve: o saldo do pagador tem de ser negativo, o de
    quem recebe positivo, e o valor fica limitado ao menor dos dois.
  - Um acerto confirmado só o pagador o apaga.
  - Uma despesa só a lança quem a pagou ou quem entra nela.
  - Só quem abriu as contas, ou o condutor, tira outras pessoas ou apaga a sessão; cada pessoa pode sair sozinha.
- **Preço das boleias:** consumo entre 3 e 15 L/100 km e combustível entre 1,000 e 2,600 €/L, na app e no servidor.
  Os passageiros já viam a distância, o combustível e as portagens.
- **Mapa dos tascos:**
  - Só contam contas com pelo menos 3 dias.
  - Os números saem arredondados para baixo a múltiplos de 5.
  - O agregado só é publicado pela tarefa de 5 em 5 minutos, já não a cada check-in.
  - Assim, 4 contas falsas já não revelam uma pessoa sozinha nem o clube dela. Custo aceite: contas novas (os
    testadores de dia 15) só aparecem no mapa ao fim de 3 dias.
- **Fotos:** todas as fotos são regravadas em JPEG antes de enviar (`src/lib/foto-para-enviar.ts`,
  `expo-image-manipulator`). No Android o seletor copiava o GPS do EXIF para a foto enviada.
- **Sessão:** guardada no Keychain/Keystore (`expo-secure-store`, em pedaços de 1800 caracteres, só neste aparelho e
  fora das cópias de segurança). Uma sessão antiga em AsyncStorage passa para lá na primeira leitura. O
  `npx expo install` acrescentou o plugin `expo-secure-store` ao `app.json`.
- **Ligações das casas:** só Airbnb (com `abnb.me`) e Booking, na base de dados e na app. O botão diz o site e mostra
  o domínio que vai abrir.
- **Apagar a conta:** apaga também as pastas da pessoa em `avatars` e `place-photos`. As fotos de grupo e de viagem
  ficam, porque são memórias do grupo.
- **Fotos de grupo:** só quem enviou o ficheiro, ou o dono do grupo, o substitui ou apaga.
- **Gastos com IA:** registo à parte (`ai_usage_ledger`), sem ligação ao perfil, preenchido por triggers.
  `ai_usage_since` lê daí, e apagar uma conta já não apaga o que ela gastou.
- **Notificações:**
  - `social-notify` publicada com `verify_jwt = false`. Antes, o gateway recusava as chamadas da base de dados e as
    notificações de conversa, convites, amigos e dinheiro perdiam-se.
  - O envio vai em blocos de 100, para todos os telemóveis.
  - Os pedidos de lugar respeitam os bloqueios.
- **Rotas a pé sem conta:** o limite usa o último endereço de `x-forwarded-for`, que é o que o gateway acrescenta.
- **Ficou de fora, de propósito:**
  - App Links (precisam de um domínio próprio).
  - Proteção contra palavras-passe divulgadas (só no plano pago).
  - O limite comum do formulário de opinião sem conta.
  - «Fui ao jogo» declarado pela própria pessoa (não conta para carimbos nem para o ranking).
  - Passagem de um código de notificações conhecido para outra conta (os códigos não são expostos).
  - Plausibilidade do GPS.

## 2026-10-08 — Meteorologia verdadeira, de graça (IPMA e MET Norway)

A meteorologia dos jogos era simulada (`src/mocks/extras-jogos.ts`), embora a app prometa avisar quando chove. Agora vem
de fontes gratuitas e sem chave. Migração `20261008085417_fixture_weather.sql` e função `sync-weather`:
- **IPMA** nos estádios em Portugal, ilhas incluídas: o ponto de previsão mais próximo (até 40 km) entre os 423 do
  IPMA. Usa o intervalo de hora em hora mais próximo do início do jogo (cerca de 3 dias à frente) e depois os de 3 em 3
  horas (até cerca de 6 dias). Os resumos diários não servem: não têm a temperatura a uma hora certa. O IPMA só dá a
  probabilidade de chuva de 3 em 3 horas, por isso usa-se a do intervalo mais próximo. As horas do IPMA estão em UTC
  (confirmado na documentação).
- **Avisos do IPMA** (amarelo, laranja, vermelho) para a zona do estádio, de 3 horas antes a 3 horas depois do início.
  A agitação marítima é ignorada.
- **MET Norway** no estrangeiro (Lens, por exemplo) e quando o IPMA não tem nada que sirva. É gratuito, permite uso
  comercial com menção da fonte e pede um User-Agent identificado. Fora dos países nórdicos não dá probabilidade de
  chuva, que fica `null`; a app esconde a percentagem e decide só pelo estado do tempo.
- **Rejeitado:** o Open-Meteo, que só é grátis para uso não comercial.
- `fixture_weather` tem leitura pública, como o resto do catálogo; só a Edge Function escreve. O pg_cron chama a função
  de hora a hora (minuto 25). Se uma fonte falhar, fica a última previsão guardada.
- **Notificação** cerca de 3 horas antes do jogo (início entre 2 e 4 horas depois da execução) para quem marcou que vai
  (`fixture_attendance` = `going`), se não desligou o aviso de meteorologia. Envia-se quando há chuva prevista e o
  estádio não é todo coberto, ou quando há aviso laranja ou vermelho, qualquer que seja a cobertura. Vai uma só vez por
  pessoa e jogo (`weather_notice`, sem acesso de nenhum cliente, apagada aos 30 dias). O registo é gravado antes de
  enviar: mais vale perder um aviso do que mandá-lo duas vezes.
- O cartão mostra a fonte («Previsão IPMA» ou «Previsão MET Norway»), como as duas pedem. O modo demo continua com a
  meteorologia simulada.

## 2026-10-07 — Aguentar muitos utilizadores sem pagar

Antes do teste com pessoas reais (15 de outubro), três pontos que podiam obrigar a pagar ou partir com carga. Tudo
fica no plano gratuito. Migração `20261007203402_free_scaling.sql` e função `rides`:
- **43 índices em chaves estrangeiras** que não tinham. Sem eles, as políticas RLS e os `delete` em cascata leem a
  tabela inteira, o que se nota quando há muitos utilizadores.
- **Cache de rotas** (`route_cache`, 30 dias): a chave junta as coordenadas arredondadas a 3 casas (~100 m) e se
  evita portagens. Dois pedidos iguais dão o mesmo preço e só o primeiro chega ao Valhalla. **Sem router de
  reserva de propósito:** o servidor público do OSRM não sabe nada de portagens (dá 0 km de portagem
  Lisboa–Braga e recusa `exclude=toll`), por isso dava preços errados. Se o Valhalla falhar, a boleia mostra o erro.
- **Cache de pesquisas de locais** (`place_search_cache`, 7 dias), e o **Photon** (komoot, gratuito) entra
  quando o Nominatim falha.
- **Cidade de partida sem serviço externo:** `nearest_municipality_name` procura o centro de concelho mais
  próximo na tabela `municipality` (PostGIS). Deixou de se chamar o reverse geocoding do Nominatim.
- As tabelas de cache têm RLS ligado, não têm políticas e não dão acesso a `anon`/`authenticated`. Só a Edge
  Function lá chega. Uma tarefa `pg_cron` (03:47) apaga as entradas que passaram do prazo.
- **O projeto não adormece:** o plano gratuito pausa um projeto depois de 7 dias sem pedidos. O GitHub Actions
  (`.github/workflows/manter-supabase-acordado.yml`, gratuito) lê uma linha pública de `competition` todos os dias.
  Os segredos `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` são os valores públicos que já vão dentro da app. O
  workflow só corre quando estiver no `main`.
- Limites do plano gratuito a vigiar: 500 MB de base de dados (41 MB usados), 1 GB de Storage, 50 mil utilizadores
  ativos por mês, 200 ligações Realtime em simultâneo.

## 2026-10-07 — Mandar um plano a outro grupo, às claras, e voltar atrás

«Mandar a outro grupo» serve para encher os lugares que sobram com gente conhecida (outro grupo meu) sem abrir a
boleia a desconhecidos. Estava confuso: no outro grupo o cartão dizia só «Ana convida», como se o plano fosse de lá,
e o grupo de origem não sabia de nada. Migração `20261007134650_shared_plan_notices.sql`:
- **Avisos de sistema na conversa** (`group_message.kind = 'aviso'`, sempre com plano, só escritos pelo servidor): o
  grupo de origem é avisado quando o plano é mandado e quando deixa de o ser; o outro grupo é avisado quando lho tiram.
- **Voltar atrás** (`unshare_fixture_plan`, só quem convidou): o cartão sai da conversa do outro grupo, quem deixa de
  ver o plano perde o «vou»/«talvez», e os lugares já aceites na boleia e na casa ficam como estão.
- **A que grupos foi mandado** (`fixture_plan_shared_groups`): só quem é do grupo de origem vê a lista.
- **Notificações**: o convite que chega de outro grupo diz de onde vem («A Ana (Malta do café) convida-vos para…»).

Na app: o cartão no outro grupo diz «Ana · Malta do café convida» e «Plano de «Malta do café», aberto a este grupo»;
o plano mostra «Também aberto a «Primos da bola»» com «Deixar de abrir»; a boleia e a casa de um grupo que não é o
meu dizem «Boleia/Casa de «X», aberta ao teu grupo». Testes: `supabase/tests/acesso_planos_partilha.test.sql` (21),
`src/features/groups/partilha.test.ts` e `cartao-do-plano.ui.test.tsx`.

## 2026-10-07 — A casa entra sozinha nas contas, e voos no Google Flights

**A casa nas contas da viagem** (migração `20261007122059_house_trip_expense.sql`), com o mesmo mecanismo da boleia:
- Quando a casa do plano está **reservada** e o plano tem a sessão aberta, entra uma despesa «Casa de …» com o
  preço total. Paga quem propôs a casa (foi quem reservou), se estiver na sessão; senão a despesa não entra.
- **Divide quem tem cama:** quem propôs a casa e as pessoas da sessão com lugar aceite. Se a casa não tiver nenhuma
  cama aceite, divide a sessão toda. Conta-se as camas da casa e não só as da sessão: quem tem cama e sai da viagem
  não faz a casa passar a ser de toda a gente (caso apanhado pelos testes).
- **Segue a casa:** gatilhos refazem-na quando muda a reserva, o preço ou o dono da casa, a casa do plano, as pessoas
  da sessão ou as camas. Não se apaga à mão (`stay_expense`), tal como a da boleia (`ride_expense`).
- Na app aparece com «· segue a casa» (e a boleia com «· segue o carro»). Se também houver uma despesa de casa
  lançada à mão, um aviso diz que a casa está duas vezes.
- Testes: `supabase/tests/acesso_casa_contas.test.sql` (26 verificações) e `src/features/trips/origem.test.ts`.

**Procurar voos** (`src/lib/voos.ts`, `src/components/voos-card.tsx`): nos jogos com mar ou fronteira pelo meio
(ilhas ou estrangeiro, de um lado ou do outro), a página da dormida tem «Procurar no Google Flights». Abre uma
pesquisa de ida e volta com o aeroporto de partida (o mais perto do concelho, ou Lisboa), a cidade do estádio e as
mesmas datas da dormida. Como nas casas, a app não mostra preços nem diz qual é o voo mais barato: o Google Flights
não tem API pública, e mostrar preços na app exigiria uma API de voos paga numa Edge Function (fica para depois).

## 2026-10-07 — Pacotes do Expo, expo-asset e EAS

- **Pacotes do Expo atualizados** para as versões que o SDK 57 espera (`npx expo install --fix`): só versões de
  correção, sem dependências novas.
- **`expo-asset` adicionado** (com autorização): o `expo-audio` exige-o, e sem ele a app pode rebentar fora do Expo
  Go. O `expo-doctor` passa agora as 18 verificações.
- **`eas.json` criado** (com autorização), com os perfis `preview` e `production`. Os passos para compilar estão em
  `docs/LEGAL-E-LOJAS.md`. As variáveis do Supabase vão para os ambientes do EAS, nunca as de demo nem de capturas.
- **Conta de capturas apagada** da base de dados depois de gerado o material; recria-se com os scripts
  `capturas-*.sql` se for preciso tirar capturas novas.

## 2026-10-06 — Material para as lojas e anúncio

- **Capturas reais, não maquetas.** As capturas das lojas e o vídeo usam a app a correr no simulador. A Apple pede
  capturas da app verdadeira, e as maquetas de setembro já não batem com o design. Ficam em `docs/promo/capturas-reais/`
  e `docs/promo/anuncio/clipes/`; tudo o resto é gerado a partir delas (ver `docs/promo/LEIA-ME.md`).
- **`EXPO_PUBLIC_CAPTURAS`** (`src/lib/capturas.ts`): numa compilação feita com esta variável, o modo demo não mostra
  as notas que só o explicam (a etiqueta «Modo demo · dados de exemplo» e a nota do ranking). Serve só para as
  capturas; as compilações das lojas nunca a têm, por isso as pessoas veem sempre a etiqueta.
- **Conta de capturas** com dados inventados (`capturas@teste.awayday.invalid` e dez pessoas fictícias, ids
  `c0000000-…`), para mostrar boleias, Malta, sessão e contas, que pedem conta. Os custos das boleias vieram da Edge
  Function `rides` (cotação real), não foram inventados. Apaga-se com `scripts/dados-de-teste/capturas-apagar.sql`.
- **O anúncio é feito em Remotion**, num projeto à parte (`docs/promo/anuncio/video/`, com o seu `package.json`),
  para não juntar dependências à app. A música é composta por código (`musica.py`), para não haver licenças de
  terceiros. A pré-visualização da App Store continua só com gravações da app, como a Apple exige.
- **Ficha das lojas** em `docs/promo/loja/FICHA.md`: sem nomes de clubes nas palavras-chave (marcas registadas).
- **Os detalhes aumentados nos vídeos e no Instagram são cortes exatos das gravações**, medidos na captura de
  1320 × 2868 num momento em que o ecrã está parado, e aparecem por cima do sítio de onde saem. Antes eram caixas
  postas à vista, que ficavam desencontradas do ecrã. O ecrã mostra-se sempre com a largura toda.
- **Vídeo completo (89 s, 11 capítulos) e um Reel por capítulo**, com a mesma música em modo `longo`. Plano de
  Instagram de 6 semanas em `docs/promo/instagram/PLANO-INSTAGRAM.md`.
- **Nada de meteorologia no material promocional.** A previsão na ficha do estádio só existe no modo demo («Previsão
  simulada»), e a preferência de aviso «weather» existe nas notificações mas nenhuma função a envia. Fica por fazer:
  ir buscar a previsão a uma API no servidor (regra 3) e enviar o aviso quando muda. Só depois entra na publicidade.
- **O anúncio curto passou a 25 s:** futebol desde o primeiro segundo (relvado, bola, «A app de quem vai à bola.») e depois uma ideia forte por cena, com
  o telemóvel inteiro. O vídeo completo também mostra sempre o telemóvel inteiro e sem scroll comprido.
- **Os geradores usam o `chrome-headless-shell` do Puppeteer:** o Chrome completo deixa de desenhar quando o ecrã
  do Mac adormece, e as capturas ficam penduradas.

## 2026-10-06 — Ícone da app: «A caminho do jogo»

Escolhida a proposta A de quatro: a bola branca da app sobre o relvado às riscas (`#187C44` / `#1C8A4D`),
com um caminho amarelo (`#FFCE3A`) pontilhado a sair para longe. Diz o que o nome diz (ir ver o clube
fora) e não usa escudos, cores ou nomes de nenhum clube. Lê-se bem até aos 29 pt.

- **iOS** usa o `assets/expo.icon` (Icon Composer, Liquid Glass): fundo verde sólido e duas camadas,
  `relvado.png` (riscas claras) e `bola.png` (bola e caminho), sem translucidez, para manter o desenho plano.
- **`icon.png`** 1024 × 1024 sem canal alfa, como a App Store pede.
- **Android adaptativo**: fundo às riscas; a bola e o caminho reduzidos a 66 % para caberem na zona segura
  de qualquer máscara (círculo, gota, quadrado). O monocromático é o mesmo desenho só em branco.
- **Ecrã de abertura**: a bola e o caminho sobre verde `#187C44` (era o azul do modelo do Expo), 200 pt de largura.

Os PNG foram desenhados em SVG e convertidos com o `sips` do macOS, sem dependências novas.

## 2026-10-06 — Testes para as lojas, e o que eles apanharam

**Quatro níveis de testes, cada um com o seu comando:**

| Nível | Ferramenta | Comando | Hoje |
|---|---|---|---|
| Lógica pura | Vitest | `npm run test` | 229 testes |
| Ecrãs e componentes | Jest + jest-expo + Testing Library (`*.ui.test.tsx`) | `npm run test:ecras` | 154 testes |
| Acesso à base de dados (RLS e funções), por tipo de pessoa | SQL em transação sempre desfeita | `npm run test:sql` | 29 ficheiros, 1600 verificações |
| Percursos completos no simulador | Maestro + Expo Go | `npm run test:e2e` | 15 percursos (`.maestro/LEIA-ME.md`) |

Os testes de SQL cobrem as 79 tabelas para quem não tem conta, conta nova, dono, membro, alguém de fora,
administrador e pessoa bloqueada. São a especificação: um erro encontrado fica com um teste a vermelho até ser
corrigido.

**O que apanharam e foi corrigido** (migração `security_fixes_from_tests` e app):
- Um grupo ficava sem dono quando o dono apagava a conta. Agora passa ao membro mais antigo.
- Funções auxiliares respondiam sobre outras pessoas (quem é amigo de quem, quem está em que grupo, com que grupo
  alguém vai a um jogo). Ficaram só para o servidor. As regras das fotos usam funções novas que só perguntam pelo
  próprio.
- O nome podia mudar-se sem o limite semanal. O feedback sem conta não tinha limite (agora 30 por hora).
- Boleias:
  - Era possível pedir lugar na volta num carro só do grupo.
  - A suspensão por faltas contornava-se por um plano ou por um convite.
  - Convites e planos podiam encher a volta de um carro já cheio.
- Os nomes de quem fica numa casa só do grupo viam-se com o id da casa. Uma versão antiga e partida de
  `set_stay_plan` ainda existia.
- Quem enviou uma foto de tasco, sugeriu um prato ou um tasco era legível. As fotos novas vão para `anonimas/`, e as
  colunas de quem enviou deixaram de ser legíveis pela app.
- As zonas e as ruas dos adeptos da casa publicavam-se com 3 pessoas. Passou a 5, como todos os agregados.
- Carimbar o estádio aceitava até 1049 m. O limite de 1000 m passou a ser medido antes de arredondar.
- Entrar a partir das boas-vindas ficava preso em «A entrar…». O modal passou a fechar logo.
- O modo demo:
  - mostrava «Jornada de descanso», porque os jogos de exemplo tinham datas passadas; agora são empurrados para os
    próximos dias;
  - não tinha jogos no seletor;
  - o pedido de autorização das dicas escrevia na conta real.
- «Termos» e «Privacidade» nas boas-vindas abriam a página da foto. A caixa de consentimento tinha as ligações lá
  dentro. O menu de denunciar no Android fechava ao tocar entre opções. Os nomes de clube com uma só palavra
  partiam-se a meio.

## 2026-10-06 — Preparar as lojas: legal, denúncias, IA com autorização, dados verdadeiros, acessibilidade

O estado e os riscos estão em `docs/LEGAL-E-LOJAS.md`. Aqui ficam as decisões.

**Textos legais numa só fonte.** Política de privacidade, termos e «sobre e contactos» vivem em `src/lib/legal.ts`.
A app mostra-os no modal `/legal/[documento]` e `npm run legal:paginas` gera as páginas públicas em `docs/legal/`.
Assim a app e as páginas nunca dizem coisas diferentes.

**18 anos ou mais**, declarado numa caixa obrigatória ao criar conta (nunca pré-marcada). A versão dos termos aceite e
a data ficam guardadas na conta. A razão é haver boleias com desconhecidos e álcool.

**Sem página de cookies nem de reembolsos.** A app móvel não usa cookies nem analítica, e a versão web não vai ser
publicada. A app é gratuita e não processa pagamentos. Os termos dizem-no.

**IA só com autorização explícita** (Apple 5.1.2(i), RGPD). A dica do treinador, os avisos e a retrospetiva são
escritos pela Anthropic a partir de factos do dia de jogo, sem nome nem email. Passaram a vir desligados por omissão,
também para as contas que já existiam. Nos Jogos, no lugar da dica, aparece o pedido com o que é enviado e para quem.

**Denunciar e bloquear** (Apple 1.2):
- Denuncia-se uma mensagem do grupo ou do carro, uma pessoa, a foto de alguém ou um grupo.
- As denúncias vão para uma fila que só os administradores veem, sem saberem quem denunciou.
- Bloquear esconde as mensagens dessa pessoa nas conversas e nas notificações, e acaba a amizade e os convites
  pendentes. A pessoa bloqueada não fica a saber.
- As mensagens bloqueadas desaparecem sem deixar marca.

**Só dados verdadeiros fora do modo demo.**
- Os adeptos por clube passaram a ser a contagem real (a partir de 5).
- A sombra, o abrigo, os transportes e a meteorologia de exemplo ficaram só no catálogo demo.
- O combustível deixou de ser atribuído à DGEG.
- Saíram as frases que a app não podia provar e os avisos que ainda não são enviados.
- No modo demo aparece sempre «Modo demo · dados de exemplo».

**Acessibilidade (WCAG AA).** As cores do tema foram ajustadas até todas as combinações usadas passarem no contraste.
As linhas pequenas por cima dos títulos nos cabeçalhos verdes passaram de amarelo a branco: o amarelo não chega ao
contraste em letra pequena. Também:
- As fotos têm descrição e os ícones decorativos estão escondidos do leitor de ecrã.
- Os formulários passam ao campo seguinte com o teclado e anunciam os erros.
- O texto grande respeita o tamanho de letra do telemóvel.

## 2026-10-06 — Revisão do design: menos informação à vista

**O problema.** Os menus principais estavam bem, mas os ecrãs de dentro (estádio, estacionamento, boleias, grupo,
sessão) empilhavam cartões, etiquetas e parágrafos. Ficavam confusos e feios.

**As regras que passam a valer em todos os ecrãs:**
- O título fica no cabeçalho e não se repete no conteúdo.
- Cada secção tem no máximo uma linha de explicação. O resto (regras, fontes, notas legais) abre-se ao tocar:
  «Ver mais», ou uma linha que abre (`src/components/linha-que-abre.tsx`).
- Coisas parecidas ficam num só cartão, em linhas, e não num cartão cada. Nada de cartão dentro de cartão. No máximo
  2 ou 3 etiquetas por item.
- Uma ação principal por secção (botão). As outras são ligações discretas.
- Uma secção sem dados não aparece. O título também não.

**Tirado:**
- As Novidades: a faixa nos Jogos, a linha no Perfil e o ecrã. Fica só a dica do treinador. As dicas continuam a
  chegar como notificação.
- O campo «A tua terra»: fica só «De onde partes para os jogos», que é o que serve às boleias. A terra também deixou
  de aparecer nas boleias.
- Na página da boleia, o cartão para escolher ou criar um grupo: o grupo escolhe-se só ao oferecer a boleia.

**Corrigido:** as iniciais das caras de grupo sem foto apareciam cortadas (a altura da linha não acompanhava a
letra), como antes no perfil.

## 2026-10-06 — Boas-vindas, passos do perfil e de onde partes para os jogos

**Boas-vindas.** A app abre numa foto de estádio à noite, que ocupa o ecrã todo, com «Entrar ou criar conta» e
«Explorar sem conta». A foto é de licença livre (Wikimedia Commons, «Mezokovesd Zsory stadion», de Zemszo, CC BY-SA
4.0) e o crédito aparece no ecrã, com ligação para a página original, como a licença pede. Foi escolhida por não ter
caras nem clube reconhecível. Está em `assets/images/boas-vindas-estadio.jpg` (1400 px, 366 KB).

**Os passos.** Com conta: foto → clube → de onde partes → como vais → avisos. Sem conta: clube → avisos. Todos têm
«Saltar por agora». A ordem vive em `src/lib/introducao.ts` (com testes). Os ecrãs antigos de permissões e de conta
saíram. A localização deixou de se pedir na introdução: pede-se no check-in, quando se percebe para que serve.

**De onde partes: só o concelho, e só o dono o vê.** Nova tabela `profile_home` (concelho e maneira de ir), com RLS
só para o próprio. Não fica na tabela `profile`, porque essa é legível por quem tem conta. Os 308 concelhos estão
em `municipality` (código INE, nome, distrito ou ilhas, e o centro), com os dados da CAOP via geoapi.pt. O centro do
Funchal foi corrigido à mão: o da CAOP cai no mar, por causa das Selvagens.

**Para que serve.** Nas boleias de cada jogo, as que saem mais perto do teu concelho aparecem primeiro, com «Sai a
12 km de ti». As tuas, as que pediste e as de amigos ficam sempre em cima. Para quem diz que vai de carro, «Oferecer
boleia» passa para o topo. A distância é em linha reta, entre o centro do concelho e o ponto de partida do carro,
que já era público na boleia. A ordem está em `src/lib/boleias-perto.ts`, com testes.

**Não se pede** data de nascimento, telefone nem género: nada na app os usa.

## 2026-10-05 — Ranking: aba própria, pontos, níveis, missões, desafios da semana e divisões

**Uma aba só para isto.** A barra de baixo passa a ter cinco abas: Jogos, Malta, Locais, Ranking e Perfil. Os
rankings e as missões saíram do Perfil (o pódio, a linha «Rankings», a secção «Missões do passaporte», e os ecrãs
`perfil/rankings` e `perfil/missoes`). O interruptor «Aparecer nos rankings» saiu das Definições e vive agora na aba,
onde se percebe o que quer dizer. O Perfil fica só com uma linha («Nível 7 · Adepto») que abre a aba. O Passaporte e
o Álbum continuam no Perfil, porque são a coleção de cada um.

**Só conta o que a app confirmou.** Estádios carimbados no local, check-ins nos tascos, fotos de tasco aprovadas,
avaliações de sítios onde se esteve (estádio carimbado nesse jogo, ou tasco com check-in) e fotos de prova
verificadas pelo servidor. O que é só declarado fica de fora. As boleias não dão pontos: era fácil inventá-las entre
amigos.

**Os pontos (XP) não se guardam: calculam-se.** O plano previa uma tabela `xp_event` com triggers. Em vez disso,
`ranking_activity()` lê as tabelas de origem e `ranking_xp()` dá os pontos. Assim, um check-in desfeito ou uma foto
rejeitada saem sozinhos, o histórico não precisa de preenchimento inicial e uma regra mudada aplica-se a todos. Com
o volume atual chega; se ficar lento, passa a vista materializada sem mudar a app. Tabela: carimbo 100, primeira vez
nesse estádio +150, jogo fora +50, check-in 20 (até 2 por dia), foto aprovada 15, avaliação 10, missões o que valem.

**Níveis para a vida.** Passar do nível L para o L+1 custa 100 + 50 × (L − 1): nível 5 aos 700, 10 aos 2 700, 20 aos
10 450, 40 aos 40 950, máximo 99. Os títulos são genéricos (Estreante, Adepto, Habitual, Viajante, Bancada Fiel,
Veterano, Lenda) e ficam na app (`src/features/ranks/labels.ts`); o número vem do servidor.

**Missões no servidor** (`mission`): conquistas em bronze, prata e ouro, missões da época e desafios da semana. As 7
missões do telemóvel passam para o servidor com os mesmos ids (as fotos do álbum continuam ligadas). Ficam de fora a
«jogo à chuva» (a meteorologia ainda não está na base de dados) e a «cerveja com um rival» (obrigava a cruzar
check-ins de outras pessoas). As conquistas antigas que contavam coisas declaradas passam a contar só as confirmadas.

**Desafios da semana:** três por semana (um de jogo, um de tasco, um dos outros), escolhidos ao acaso pelo
`plan_weekly_challenges()`, todos os dias às 03:07, para a semana atual e as duas seguintes, evitando repetir os da
semana anterior. A app mostra os desta semana e os da próxima, para dar tempo de planear. As semanas sem jogos no
calendário não têm desafios.

**Série:** jornadas seguidas com um estádio carimbado. As semanas sem jogos (pausas para seleções) não contam nem a
quebram, e a semana atual só conta como falhada quando acabar.

**Divisões da época:** Distrital, Campeonato de Portugal, Liga 3, Liga 2 e Liga. Toda a gente começa na Distrital.
Quando a época fecha (`close_finished_seasons()`, todos os dias às 04:27, só depois de existir a época seguinte em
`season`): sobem os primeiros 20 % de cada divisão (arredondado para cima) com pelo menos 500 pontos, descem os
últimos 20 % (arredondado para baixo, e só em divisões com 5 ou mais pessoas com pontos), e quem não fez pontos desce
uma. As posições contam toda a gente da divisão; as tabelas só mostram quem escolheu aparecer.

**Afluência:** quantos adeptos foram a cada estádio esta época e que clubes levam mais gente fora. São só totais e
só aparecem a partir de 5 pessoas diferentes, como todos os agregados da app.

**Testes:** a lógica do servidor tem testes em SQL (`supabase/tests/ranking.test.sql`, 246 verificações) que correm
numa transação sempre desfeita: `supabase db query --linked -f supabase/tests/ranking.test.sql`. As palavras e
contas de apresentação têm testes em Vitest (`src/features/ranks/labels.test.ts`).

## 2026-09-18 — Histórico com álbum, um plano fechado por jogo, e a conversa do carro igual à do grupo

**Histórico = recordação.** Passa a ter só viagens já feitas (jogo passado) em que foram pelo menos duas pessoas do
grupo (`group_history`). Cada viagem é um cartão com capa (a primeira foto do álbum, ou o relvado com os escudos),
o jogo, a data e a cidade, quem foi, as fotos e quanto se gastou. Abre a recordação: os números (quantos foram,
quanto se gastou, quanto deu por cabeça), a maior extravagância (só cervejas, petiscos, refeições e «outro» — os
bilhetes e as portagens não têm graça) e o álbum.

**O álbum.** Nova tabela `trip_photo` e balde privado `trip-photos`, uma pasta por sessão. Só quem foi põe fotos;
vêem-nas quem foi e a malta dos grupos que tiveram pelo menos duas pessoas na viagem (`can_see_trip_memories`) —
quem ficou em casa vê o que perdeu.

**Um plano fechado por pessoa e por jogo.** Quem já disse «vou» num plano fechado para um jogo não pode dizer que
vai noutro plano para o mesmo jogo (`already_going`, também ao entrar direto no carro). Nesse outro plano o cartão
diz «Já vais a este jogo com a Malta do café», e aos outros aparece «Vai com Malta do café».

**«Planos em aberto» passa a «Planos».** Tinha abertos e fechados, e o nome enganava.

**A conversa do carro fica igual à do grupo:** ecrã inteiro (fora dos separadores), bolhas, caixa de escrita em
baixo. As peças comuns vivem em `src/ui/conversa.tsx`. O botão de enviar passa a ser um avião de papel e a entrada
na conversa, na boleia, uma linha com o balão, a última mensagem e as por ler (o megafone saiu).

**A boleia no plano** foi redesenhada como `CartaoDaBoleia`: condutor e preço por pessoa em cima, a hora de saída
grande, os lugares desenhados como bancos, uma só ação principal, e o resto discreto.

**Na página dos Jogos**, o aviso «Tens lugar na boleia de…» esconde-se quando a sessão dessa boleia já abriu: a
informação passa para dentro da sessão, que ganhou «Ver a boleia». **Na sessão**, «Quem vai» passou a lista (uma
pessoa por linha, quem leva o carro assinalado, «Não veio» alinhado à direita).

## 2026-09-18 — Dentro do grupo não se pede, entra-se; e o jogo com o mais importante em cima

**Boleia do plano: «Vou nesta boleia».** Pedir lugar e esperar resposta é para as boleias públicas, entre
desconhecidos. No plano do grupo entra-se direto no carro (`join_plan_ride`), fica-se logo como «vou», e se a
sessão já existir entra-se nas contas e na despesa do carro. Sai-se com «Sair do carro».

**Casa do plano: escolher, fechar a escolha, entrar.** Com a escolha aberta a malta diz qual prefere; quem convidou
fecha a escolha na casa do plano (`set_plan_stay_locked`). Fechada, só se vê essa casa, com quem já lá está e quanto
fica a cada um agora e com a casa cheia — e cada um entra com um toque (`join_plan_stay`), vendo o preço descer. A
escolha reabre-se se alguém encontrar melhor.

**Na sessão, «Algum deles não veio?»** ao lado de «Veio mais alguém?». No grupo não há os cuidados das boleias
públicas: quem estava na lista e não veio sai com um toque (se não tiver despesas lançadas).

**O tasco do check-in, sozinho nos grupos — com um sim.** Pedido: aparecer em todos os grupos o tasco onde a pessoa
está, sem ter de o dizer grupo a grupo, com opção para desligar. Fica assim: depois do primeiro check-in com conta,
a app pergunta **uma vez** se a malta dos grupos deve passar a saber; a resposta fica no perfil
(`share_checkins_with_groups`) e muda-se em Definições → Privacidade. Com o sim, é a Edge Function do check-in que
põe «estou no Tasco do Zé» em cada grupo (não repete o mesmo tasco no mesmo grupo em três horas). Sem resposta, não
se partilha nada: as regras de privacidade não deixam a localização de alguém chegar a outros sem essa pessoa o
dizer, e a app continua sem ler check-ins. Com o sim, o cartão «Estás aqui? Diz à malta» sai da ficha do tasco.

**A página do jogo por ordem de importância:** «Vou», depois **Com quem vais** (com «Combinar com a malta» num
cartão em destaque), **Antes de ir**, o carimbo e o barulhómetro, e no fim as horas do plano e os avisos (a chuva
por último). O relógio do dia de jogo continua colado ao cabeçalho.

**Pontos do mapa:** a área de toque passa de 34 para 48 pontos (transparente) e o ponto cresce um pouco (18 → 22;
selecionado 26 → 30), com uma sombra leve para se ver melhor sobre o mapa.

## 2026-09-18 — A sessão da viagem, e as despesas só lá dentro

Terceira parte do plano de simplificação. As contas abriam-se de três maneiras (da boleia, do grupo, do nada) e
viviam na página do jogo, misturadas com tascos e estacionamento.

**A sessão nasce do plano fechado.** Quando um plano fecha (à mão, ou porque o carro encheu), o servidor cria a
sessão da viagem — ou reaproveita a da boleia do plano, se já existir — e põe lá quem convidou, quem disse «vou», o
condutor e quem tem lugar no carro (`ensure_plan_session`, num trigger). Com boleia, a sessão é da boleia, e a
despesa do carro entra sozinha como já entrava.

**Aparece na página dos Jogos na véspera** (00:00 de Lisboa), ou dois dias antes nos jogos fora do país, e fica até
três dias depois do jogo (`trip_session_opens_at`, `my_open_trip_sessions`). A regra está no servidor; as sessões que
já existiam seguem a mesma regra.

**A sessão é simples:** as horas (saída do carro e apito), com o aviso para estarem a horas; quem deu a boleia e
quanto fica a cada um, com o lembrete para não se esquecerem de lhe pagar; quem vai; e as despesas. Tascos e mapas
ficam no jogo. As despesas **só existem na sessão**: saíram a linha «Contas da viagem» da página do jogo, os ecrãs
`jogos/contas` e `jogos/contas-do-jogo` e o cartão «Viagem a decorrer».

**Despesas numa página própria**, com um título com graça conforme o que já se gastou e um interruptor em cima:
**Lista** (linhas compactas, para caberem várias sem deslizar; tocar sem largar apaga as tuas) e **Acertar contas**
(«O Rui deve-te 12,50 €», com «Já paguei» / «Já recebi», e os pagamentos por confirmar). Em baixo, fixo: na lista,
«Adicionar despesa», que abre um ecrã próprio; no acerto, o estado — «Contas acertadas» ou «Contas por acertar». As
contas continuam a ser feitas no servidor e o acerto em `src/lib/acerto.ts`, sem mudanças.

Novo em `src/ui`: `Segmentado`, para duas ou três vistas do mesmo ecrã.

## 2026-09-18 — Onde dormir: primeiro procurar, e pelo que cada um quer pagar

O ecrã «Onde dormir» começava pelas casas propostas e deixava a pesquisa para o fim, e a pesquisa pedia logo o
número de pessoas. Para quem quer dividir casa com desconhecidos isso é ao contrário: não se sabe quantos vão ser,
sabe-se quanto se quer gastar.

**A pesquisa vem primeiro**, depois as casas propostas, e no fim «Viste uma casa? Propõe-na».

**Pergunta-se quanto cada um quer pagar pela dormida toda**, em escalões de 50 € (até 50, 50–100, 100–150,
150–200, mais de 200), e o tamanho da casa sai daí: a app mostra uma pesquisa para casas de 2, 4 e 6 pessoas, cada
uma já com o preço filtrado para que, dividida por essa gente, caiba no escalão («Casa para 4 · 200–400 € ao
todo»). A conta está em `pesquisasPorOrcamento` (`src/lib/dormida.ts`), com testes, em cêntimos inteiros.

**Porque não calculamos com as casas do Airbnb:** o Airbnb não tem API pública e ler as páginas deles
automaticamente vai contra os termos. A app faz a conta ao contrário e deixa o Airbnb filtrar. O filtro de preço do
endereço (`price_min`/`price_max`) conta **por noite** — confirmado a 2026-09-18 com uma pesquisa real no Funchal
(filtro 100–200 €/noite, 2 noites, casas de 219 € a 415 € ao todo). O total divide-se pelas noites; o máximo
arredonda para cima e o mínimo para baixo, para não deixar de fora nenhuma casa que caiba. O Airbnb filtra antes
das taxas, por isso uma ou outra casa pode passar um pouco do limite.

**Nos grupos continua o número de pessoas.** Vindo de um plano, a pesquisa é para quantos disseram «vou» (e pode
mudar-se), porque aí já se sabe quem vai.

Novo em `money.ts`: `formatarCentimosCurto` («50 €» para valores redondos, «3,50 €» para o resto), com testes.

## 2026-09-18 — Planos: combinar um jogo dentro do grupo

Segunda parte do plano de simplificação. Até aqui, combinar um jogo era oferecer uma boleia e esperar que a malta a
visse. Passa a haver **planos**.

**O convite.** Na página do jogo, «Combinar com a malta» → escolhe-se o grupo, e cai na conversa um cartão com o
jogo, a hora, o estádio e dois botões: **Vou** e **Estou a pensar** (tocar outra vez tira a resposta). Quem convida
fica logo como «vou». **Um plano por grupo e por jogo**: convidar outra vez volta a pôr o mesmo plano na conversa.

**O plano** (a partir do cartão, ou de «Planos em aberto») mostra quem vai, a boleia e a dormida. Os planos futuros
e os em aberto ficaram a mesma coisa, como combinado: no rodapé da conversa só há «Planos em aberto» e «Histórico».

**A boleia e a casa ligam-se sozinhas.** Quem está no plano oferece a boleia para o grupo (o ecrã de oferecer já
vem com o grupo escolhido) e ela passa a ser a do plano. Também se escolhe à mão, entre as boleias do grupo para
esse jogo. O mesmo para a casa.

**Sempre à mão:** abrir a boleia ao público (só o condutor, como até aqui), deixar a volta aberta a quem precisar
(só o condutor, só em ida e volta) e mandar o plano a outro grupo (só quem convidou, só para grupos onde está).

**Misturar grupos.** Mandar o plano a outro grupo põe o cartão na conversa desse grupo, e essa malta passa a ver a
boleia e a casa do plano mesmo que sejam «só do grupo» — senão não podia pedir lugar. Para isso, as cinco funções
que decidem quem vê uma boleia ou casa privadas (`ride_board`, `ride_return_board`, `request_ride_seat`,
`fixture_stay_plans`, `request_stay_place`) foram reescritas a partir das que estão em produção, com uma única
mudança: «é do grupo» passa a ser `can_see_private_ride` / `can_see_private_stay` (é do grupo **ou** de um grupo a
quem o plano foi mandado). Quem é de fora continua sem ver.

**Fechar o plano.** Fecha sozinho quando o carro enche (trigger nos lugares aceites). Quem convidou também o fecha
à mão; se ainda houver lugares, aparece o aviso «Ainda sobra 1 lugar no carro» com as saídas (abrir ao público,
mandar a outro grupo) e «Fechar mesmo assim». Sem boleia, pergunta se quer fechar na mesma. Um plano fechado pode
voltar a abrir, e quem convidou pode desistir dele. **É o plano fechado que abre a sessão na véspera do jogo** —
isso é a parte seguinte.

**Na conversa, em direto.** As respostas e o fecho avisam o canal de cada grupo do plano (`plans`), e os cartões
atualizam-se sem sair do ecrã. As notificações de convite dizem «O Rui convida-te para Benfica x Porto. Vais?».

**As casas à vista no plano.** Não fazia sentido ter de sair do plano para «Onde dormir» para ver se já havia casa.
As casas do jogo propostas no grupo (ou nos grupos do plano, ou por quem respondeu) aparecem em lista no próprio
plano, com quanto fica a cada um. Cada pessoa diz **qual prefere** — uma preferência por pessoa e por plano, que
muda com um toque —, e a lista ordena-se pela casa escolhida e depois pelas mais preferidas. Quem não gostar propõe
outra (o formulário abre logo, já com o grupo). Quem convidou escolhe «a casa do plano»; a primeira proposta fica
escolhida sozinha. A secção só aparece nos jogos fora do país e nas ilhas, que é onde o servidor aceita casas.

## 2026-09-18 — A Malta: o grupo passa a ser uma conversa

Primeira parte de um plano maior para simplificar a app (grupos → planos → sessão e despesas → pedir boleia →
histórico e álbum → entrada na app → Top e pontos). Os grupos estavam escondidos no perfil e eram uma lista de
pessoas com um link; a malta não combina nada numa lista, combina a falar.

**Um separador próprio, «Malta».** Fica entre Jogos e Locais. Mostra os grupos em cartões — foto, nome, última
mensagem e quantas estão por ler — e os convites por responder. O perfil perdeu a linha «Os teus grupos», e os
ecrãs `perfil/grupos` e `perfil/grupo` saíram.

**Dentro do grupo é uma conversa** (`/grupos/[grupoId]`), fora dos separadores para ocupar o ecrã todo e o teclado
se portar bem. Por baixo da caixa de escrita há dois atalhos: **Planos em aberto** e **Histórico**. Por agora
mostram o que o grupo já tinha (as boleias e casas do grupo, e as viagens); passam a ser os planos e o álbum nas
partes seguintes. O que estava no ecrã do grupo (pessoas, convite, nome, sair) foi para as definições do grupo, que
se abrem a tocar no título.

**Cara e fundo.** Cada grupo pode ter uma foto e um fundo de conversa: cinco que vêm com a app (relvado, bancada,
jogo à noite, cachecol, liso) ou uma foto da galeria. Qualquer pessoa do grupo os muda — o grupo é de todos. As
fotos ficam num balde privado (`group-photos`), numa pasta por grupo, e só quem é do grupo as abre.

**Quem está online.** Não havia Realtime nenhum na app; tudo era perguntar de x em x segundos. A conversa passa a
entrar num canal privado `group:<id>`: a presença diz quantas pessoas a têm aberta, e um trigger avisa o canal
quando há mensagem nova (o aviso leva só o id; a conversa volta a pedir as mensagens pela função de sempre, que é
quem verifica se a pessoa é do grupo). Só entra no canal quem é do grupo — políticas em `realtime.messages`. Não
entrou dependência nova: o Realtime vem no `supabase-js`. O intervalo de 30 s fica como rede de segurança.

**«Estou aqui» em vez de pintar o tasco no mapa.** A ideia era mostrar no mapa, com outra cor, os tascos onde está
alguém do grupo. Isso mostrava onde uma pessoa está sem ela o ter dito, e as regras de privacidade não o permitem
(localização individual nunca exposta; o mapa só lê agregados). Em vez disso, na ficha do tasco há «Estás aqui? Diz
à malta»: um toque manda para a conversa do grupo escolhido «O Rui está no Tasco do Zé». É a própria pessoa que o
diz, quando quer; vai só o nome do tasco, nunca coordenadas, e os check-ins continuam sem ser lidos pela app.

**Notificações.** Cada mensagem avisa os outros do grupo (`social-notify`, tipo `group_message`), e pode
desligar-se em Notificações → «Conversa do grupo». Tocar no aviso abre a conversa.

## 2026-09-16 — Reportar um erro, de dentro da app

Não havia porta nenhuma: quem encontrasse um erro tinha de o dizer a alguém ou calar-se. Passa a haver, em
Definições → Ajudar a melhorar: duas naturezas («alguma coisa não está bem» e «tenho uma ideia»), o sítio da app
onde aconteceu, e o texto.

**Não é preciso ter conta.** Um erro não espera por um registo, por isso o `send_feedback` também aceita `anon`.
Com conta há limite de dez por dia.

**Vai o modelo do telemóvel e a versão da app**, e está escrito no ecrã. Metade dos erros são de um aparelho só e
sem isso não se reproduzem. Não vai localização, nem nada que a pessoa não tenha escrito.

Para quem administra: `feedback_inbox` e `set_feedback_status` (novo / visto / resolvido). O ecrã de administração
ainda não existe — é a mesma dívida que ficou das fotos denunciadas, e vão as duas juntas.

## 2026-09-16 — Modo escuro

A app era só de dia («light only», decidido a 2026-09-14). Passa a ter as duas paletas, com as mesmas chaves:
`Colors` e `ColorsEscuro`.

**Segue o telemóvel por omissão.** Quem tem o sistema em escuro abre a app em escuro; quem quiser fixar um dos dois
fixa-o em Perfil → Definições → Aspeto, e aí o sistema deixa de mandar. A escolha guarda-se no telemóvel com as
outras preferências. O `app.json` passou a `userInterfaceStyle: "automatic"` — sem isso o sistema nunca reportaria
escuro.

**A paleta de noite mantém o que a app é:** o relvado continua verde e o cartão continua amarelo. O que muda é o
chão — a cal dá lugar a um verde quase preto — e a tinta, que clareia. O verde dos botões é mais fundo do que o do
fundo, senão um cartão verde por cima do fundo desaparecia.

**Como os ecrãs a usam:** ninguém escolhe entre as duas. Pede-se a paleta ao `useTheme()`, que sabe a escolha e o
estado do telemóvel; quem precisa só de saber se está escuro (barra de estado, tema da navegação) usa
`useEstaEscuro()`. As cores fixas que estavam em `StyleSheet.create` passaram para estilos em linha, porque uma
folha de estilos é criada uma vez e não muda de tema.

Uma simplificação assumida: os ecrãs que são **um relvado inteiro** (cabeçalho do perfil, retrospetiva, introdução)
continuam a pintar o verde e o branco fixos. São verdes nos dois modos, e branco sobre verde lê-se bem em qualquer
um.

## 2026-09-16 — Um jogo, uma página (fora o «o meu jogo»)

Havia dois sítios para o mesmo jogo: a ficha do jogo e «o meu jogo», o plano pessoal. Depois de o ecrã do jogo
passar a átrio, a separação deixou de fazer sentido — e obrigava a escolher em qual deles se ia buscar cada coisa.

**«O meu jogo» acabou.** O ecrã do jogo é o único sítio: marcas que vais (o botão continua lá, e é ele que conta
para as estatísticas), e a partir daí aparece o teu plano — as horas e os avisos — por cima das linhas das secções.
As notificações e o botão de «vou» passam a abrir o jogo.

**As horas seguem o check-in, não uma escolha à frente.** Enquanto não há check-in, contam até ao estádio. Quando
fazes check-in num sítio, a hora de sair passa a contar a partir de lá, com os minutos a pé desse sítio: «Sair do
Tasco do Zé para o estádio — 16:20».

Também saiu o cartão «O teu próximo jogo» da lista: o jogo já está na lista, uma linha abaixo.

## 2026-09-16 — Fora o «teu tasco»: um dia de jogo não é um tasco

«O meu jogo» obrigava a escolher **um** tasco, e a partir daí tratava o dia como se fosse só aquele sítio — as horas
eram para lá chegar e de lá sair. Mas ninguém combina o dia assim: vai-se a um café, depois a uma tasca, depois ao
estádio.

A escolha sai do plano. Os tascos veem-se no **mapa do jogo**, abre-se o que interessa, e é lá — na página do sítio —
que se faz check-in e se vê o caminho a pé. As horas do plano passam a contar até ao estádio: «ir para o estádio» e
«apito», com os 15 minutos da entrada e 10 de folga.

## 2026-09-16 — O ecrã do jogo deixa de ser uma página infinita

Abrir um jogo dava uma página com tudo lá dentro: barulhómetro, carimbo, estádio, WC, cuidados, mapa, meteorologia,
como chegar, boleias, contas, dormida, estacionamento e avaliação. Havia uma barra de secções no topo a saltar de
uma para a outra, mas o problema não era a navegação: era a quantidade. Quem abre um jogo quer saber a que horas é,
e depois **escolher** o que vai ver.

O ecrã do jogo passa a ser um **átrio**: o cabeçalho com o apito, as duas ações de um toque («vou a este jogo» e o
carimbo), e uma lista de linhas — cada uma com o que lá está dentro, em números, e a seta para abrir.

- *Chegar e estacionar* → `jogos/chegar`
- *O estádio* (ficha, ponto de encontro, WC, meteorologia) → `jogos/estadio`
- *Mapa e sítios* → `jogos/mapa`
- *Boleias* → `jogos/boleias` — com «3 carros com lugar · desde 6,10 €» à vista
- *Contas da viagem* → `jogos/contas-do-jogo` — com «62,90 € lançados · deves 6,13 €»
- *Onde dormir* → `jogos/dormir`
- *Barulhómetro* → `jogos/barulho`, e só em dia de jogo

O resumo de cada linha é o que evita o toque: quem só quer saber se há boleias já sabe, sem abrir nada.

«O meu jogo» ganha a mesma lista, em «Tudo deste jogo», logo a seguir ao cabeçalho — e deixa de repetir as secções
pesadas, que agora vivem nas páginas do jogo.

**As zonas de adeptos da casa passam a desenhar-se só nos clássicos.** Num jogo qualquer, marcar no mapa onde está a
claque da casa é mais um convite do que um aviso; nos clássicos, onde há notas de segurança a sério, serve para
evitar sarilhos.

E o **WC ganhou o «como chegar a pé»**, que faltava.

## 2026-09-16 — Limpeza antes dos testes a sério

Apagada toda a atividade de desenvolvimento: o jogo de teste (`teste-carimbo-agora`), os perfis fictícios, as
boleias, grupos, contas de viagem, despesas, pagamentos, mensagens, amizades, convites, casas, avaliações, visitas a
locais, presenças, fotos de missões e os contadores de limites. Também os ficheiros dessas fotos, que saem pela API
do Storage (a base de dados recusa apagá-los diretamente, e ainda bem).

Ficaram as quatro contas com o clube, as definições e a foto de perfil, e o catálogo todo: 343 jogos, 156 estádios,
1501 locais, parques, WC, pontos de encontro e notas de segurança.

O `supabase/seed-dev/contas-de-teste.sql` fica no repositório para quando for preciso montar um cenário outra vez.
Não corre sozinho.

**As boleias canceladas passam a ser apagadas** (`delete_cancelled_rides`, cron diário): dois dias depois de
canceladas, que é o tempo de quem tinha lugar ler o aviso «o condutor cancelou». Exceção: uma boleia que chegou a
ter contas com despesas fica — apagá-la levava as contas atrás dela, e o dinheiro de uma viagem que aconteceu não se
apaga por arrumação.

**Fora o cartão «Distância»** do ecrã do jogo: dizia o mesmo que o «Como chegar» logo abaixo, que já leva ao mapa
com o caminho.

## 2026-09-16 — As notificações do resto da app

As boleias já avisavam (pedido de lugar, aceite, recusado, cancelamento). Passa a avisar tudo o que foi entrando
depois, pela mesma estrada: trigger na base de dados → `pg_net` → a função `social-notify` → serviço de push do Expo.

O que avisa e a quem:

| Aconteceu | Quem recebe |
|---|---|
| Mensagem na conversa do carro | os outros que vão no carro |
| Convite para uma boleia / para um grupo | quem foi convidado |
| Pedido de amizade / aceitação | o outro lado |
| Despesa lançada nas contas | quem entra na divisão (menos quem a lançou) |
| Pagamento registado | o outro lado — quem tem de confirmar, ou quem fica a saber que recebeu |

**Uma notificação nunca trava o que a originou.** Todos os `notify_*` apanham o erro e seguem: se o envio falhar, a
mensagem, o convite ou a despesa ficam escritos na mesma. Está testado.

**O aviso da despesa sai das partes, não da despesa.** A despesa é escrita primeiro e as pessoas que entram nela
logo a seguir; um trigger na despesa avisaria sem saber a quem. Por isso o aviso sai de `trip_expense_share`, num
trigger por instrução (com transition table), já com a lista toda. A despesa da boleia, que entra sozinha, não
avisa: não é novidade para ninguém.

**Cada tipo desliga-se** nas definições (`notification_preference` com quatro tipos novos), e é o servidor que
respeita isso — não a app.

**Limitação assumida, e é da plataforma:** desde o SDK 53 o **Expo Go no Android já não recebe push**; é preciso uma
development build. No iOS continua a funcionar no Expo Go. Onde não dá, o registo do telemóvel não faz nada.

## 2026-09-16 — A conversa do carro

Combinar uma boleia pela «nota» da ficha não dá: quem entra quer perguntar se o carro passa em Mangualde, a que
horas sai mesmo, onde é o ponto de encontro.

**Uma conversa por boleia, do carro todo** — condutor e quem já foi aceite. Foi esta a escolha em vez de conversas
separadas com o condutor: assim toda a gente lê o mesmo e o condutor não repete quatro vezes a mesma coisa.

**Só entra quem já tem lugar.** Quem pediu e ainda não teve resposta não escreve — senão um condutor com o carro
cheio ficava com mensagens de dez desconhecidos, e o pedido de lugar já leva um recado escrito. Quem ainda não foi
aceite, ao abrir a conversa, vê porquê.

**Fecha-se à escrita um dia depois do jogo** (`ride_chat_closes_at`): o que havia a combinar já foi combinado. Quem
lá esteve continua a poder ler.

**Cada um apaga o que escreveu; o condutor apaga o que for do carro dele** — é a única moderação que aqui faz
sentido, porque o carro é dele e são cinco pessoas que se escolheram.

O que está por ler conta-se em `my_ride_chats` e aparece no botão da ficha da boleia; abrir a conversa marca-a como
lida. Sem notificações por agora: entram quando houver notificações a sério para boleias.

## 2026-09-16 — Um perfil com cara

Uma pessoa era um nome e umas iniciais. Para quem vai meter-se num carro com um desconhecido, ou dividir contas com
ele, isso é pouco. O perfil ganha **foto**, **a terra de onde se é**, e o nome deixa de ficar preso ao que se
escreveu no registo (`set_display_name`, com limite de 5 mudanças por semana).

**Quem vê a foto:** quem tem conta na app. É isso que a torna útil no quadro das boleias, onde ainda ninguém se
conhece. **Não é pública na internet**: o balde `avatars` é privado, cada pessoa só escreve na sua pasta, e as
imagens só se abrem com um link assinado de uma hora, dado a quem está autenticado. Ninguém é obrigado a ter foto —
sem ela ficam as iniciais, e a app não põe lá boneco nenhum.

**Há uma porta para o abuso:** qualquer pessoa pode denunciar uma foto (`report_profile_photo`) e quem administra
tira-a (`admin_clear_profile_photo`). A pessoa não é apagada nem bloqueada, fica só sem foto. Falta o ecrã de
administração para estas denúncias — está no servidor e ainda não na app.

**Como chega aos ecrãs:** uma função só, `profile_cards(uuid[])`, devolve nome, foto, terra e os sinais das boleias
de várias pessoas de uma vez, e o cliente assina os links todos num pedido. Foi por aqui em vez de acrescentar
colunas às dez funções que já devolvem pessoas.

Também: **a contagem de gente passa a aparecer no cartão do tasco no mapa** («já lá estão 7»), com a mesma regra de
sempre — só a partir de 5 pessoas, e a localização de ninguém é guardada.

## 2026-09-16 — A sessão é que manda (correção de desenho)

Estava mal pensado por mim: as contas eram **do grupo** ou **da boleia**, e quem tivesse as duas coisas para o mesmo
jogo via duas contas separadas sem saber para qual olhar. Mas quem paga o jantar não é um grupo nem um carro: é a
malta que foi àquela viagem — alguns do grupo, alguns do carro, e às vezes um amigo que apareceu por lá.

**A sessão passa a ter a sua própria lista de pessoas** (`trip_session_member`). O grupo e a boleia deixam de ser
donos das contas e passam a ser **maneiras de começar**:

- abrir a partir da boleia traz a malta do carro (e a despesa da boleia);
- abrir a partir de um grupo traz a malta do grupo;
- `start_trip_session` abre umas contas do zero, só contigo.

A lista só é preenchida **quando as contas nascem**: reabrir não volta a meter lá quem foi tirado de propósito. Só se
acrescenta quem já se conhece — um amigo, alguém de um grupo teu, ou alguém do carro desta viagem (`cannot_add`).

**Quem tem dinheiro nas contas não se tira** (`has_money`): primeiro apagam-se as despesas dessa pessoa. E umas
contas **sem nada lançado** podem ser apagadas por quem está nelas — é a saída para quem abriu duas por engano; a
partir da primeira despesa, não, que apagar dinheiro de outras pessoas por atalho não é coisa que se faça.

**A despesa da boleia divide-se por quem vai no carro E está nas contas**: um amigo que foi noutro carro entra no
jantar mas não paga a gasolina desta boleia.

No ecrã do jogo, «Contas da viagem» passa a mostrar as contas onde entras (normalmente umas só), e, quando não há
nenhumas, os botões para as abrir a partir da boleia, de um grupo, ou do zero.

Verificado com testes em transação revertida: as contas nascem com a malta certa; quem não foi no carro entra à mão
mas não paga a boleia; um desconhecido não entra; quem não está nas contas não as vê; quem tem dinheiro não se tira;
quem não tem sai; e umas contas vazias apagam-se, com despesas não.

## 2026-09-16 — A boleia entra nas contas

A boleia tinha a conta dela (combustível + portagens, dividido por quem vai no carro) e as contas da viagem tinham a
delas. Quem abria as contas via o jantar e as cervejas mas não via a viagem — e se alguém lançasse «portagens» à mão,
ficava a pagar duas vezes.

Ao abrir as contas de uma boleia, entra logo uma **despesa da boleia** com o custo que ficou definido quando a
boleia foi publicada: paga pelo condutor, dividida por quem vai no carro. É a mesma divisão que a boleia já fazia,
mas agora à vista ao lado de tudo o resto e a contar para o «quem paga a quem».

**Segue o carro.** Não se escreve à mão nem se apaga: `sync_ride_trip_expense` refá-la sempre que o carro muda —
alguém aceite, alguém que sai, alguém que entra por convite — e quem abre as contas traz o valor atual. As contas
que já estavam abertas foram preenchidas de uma vez (migração `20260916550000`).

Fica por decidir uma coisa que se vê no ecrã do jogo: quem tem grupo **e** boleia para o mesmo jogo vê duas contas
separadas. São mesmo duas coisas — o grupo pode ter gente que não foi no carro —, mas convém perguntar ao
utilizador se prefere uma só.

## 2026-09-16 — Amigos, e o que a amizade serve

Convidar alguém para um grupo logo a seguir a uma boleia é demasiado direto: um grupo é um compromisso, e quem deu
boleia uma vez pode não querer entrar na malta de ninguém. Primeiro fica-se amigo.

**Os dois têm de querer.** Um pedido só vale quando o outro aceita. Se os dois se pedirem ao mesmo tempo, ficam
amigos na hora, em vez de ficarem dois pedidos pendurados.

**Só se pede a quem já se cruzou contigo** (`have_crossed_paths`): mesmo grupo, mesmo carro ou mesmas contas. Sem
isto, a app tinha uma lista de pessoas para qualquer um chatear — e ninguém precisa disso num dia de jogo. Não há
pesquisa de pessoas, de propósito.

**Serve para três coisas**, que foi o que se decidiu:

1. **Convidar direto.** Para um grupo (`group_invite`) ou para o carro (`ride_invite`). Um convite nunca mete
   ninguém em lado nenhum: fica à espera que a pessoa aceite. No carro, quem aceita entra sem pedir — o lugar já era
   dele —, e o servidor confirma que ainda há lugar nessa altura.
2. **Ver as viagens juntos** (`trips_together`): jogos em que foram no mesmo carro ou dividiram as mesmas contas.
3. **Aparecer primeiro.** As boleias de amigos vêm à frente no quadro do jogo, com etiqueta.

**Onde se adiciona:** no resumo da viagem, ao lado de quem foi contigo. É onde a pessoa tem contexto para decidir —
e é por isso que o botão não está numa lista de estranhos.

Verificado com testes em transação revertida: não se pede a quem nunca se cruzou contigo; um pedido não faz amizade
sozinho; só quem recebe aceita; tirar um amigo tira dos dois lados; pedidos cruzados dão amizade; não se convida
para o grupo nem para o carro quem não é amigo; um convite não mete ninguém no grupo antes de aceitar; não se
convida para um carro cheio; e as boleias de amigos vêm à frente.

## 2026-09-16 — O dinheiro que já mudou de mãos

As contas só sabiam o que se gastou. Mas a meio da viagem há sempre quem mande um MB Way, e as contas continuavam a
dizer que essa pessoa devia tudo.

Passa a haver **pagamentos** (`trip_settlement`): quem pagou a quem, e quanto. Entram nos saldos como dinheiro que
já se moveu — `trip_balances` ganhou `settled_cents` — e o «quem paga a quem» encolhe.

**Quem recebe** regista «já recebi» e fica confirmado na hora, que quem recebe sabe bem se recebeu. **Quem paga**
regista «já paguei» e fica **por confirmar** até o outro dizer que recebeu. Conta nos saldos nos dois casos: a
alternativa era a app dizer a alguém que ainda deve o que já pagou. Mas vê-se quando falta a confirmação, e
qualquer uma das duas pessoas pode apagar um pagamento que não aconteceu.

A app continua a não mover dinheiro nenhum: isto é um registo do que as pessoas fizeram entre elas.

## 2026-09-16 — A viagem a decorrer, e o que fica dela

Três mudanças que vêm da mesma ideia: as contas de uma viagem fazem-se **durante** a viagem, não no fim.

**As contas podem nascer de uma boleia, sem criar grupo nenhum.** Um grupo é malta que anda junta de jogo para
jogo; uma boleia é um dia. Se cada viagem criasse um grupo, ao fim de uma época havia trinta grupos mortos. Por isso
`trip_session` passa a ter um dono e só um: ou um grupo (e um jogo), ou uma boleia. Quem entra nas contas deixa de
ser «quem é do grupo» e passa a ser `trip_session_people` — os do grupo, ou os do carro (condutor e quem foi aceite;
quem só pediu lugar não conta). Todas as funções das contas passaram a perguntar por aí.

**A viagem aparece no topo da lista de jogos enquanto acontece** (`my_live_trips`): quem vai, a que horas saiu, o
que já está lançado e como está o teu saldo. A janela vai de **uma hora antes de sair até ao dia seguinte ao jogo** —
tempo para a estrada, o jogo e a volta. É aqui que se lança a rodada quando ela acontece, em vez de à noite, quando
já ninguém sabe quem pagou o quê.

**O histórico deixa de ser só uma nota.** «Os meus jogos» passa a abrir um **resumo da viagem**: com quem foste, o
que se gastou (com botão para as contas, que continuam abertas) e o que achaste, com as três notas e o comentário em
vez de um número solto. Na lista, cada jogo ganha uma linha — «Foste com o Zé e a Rita · 127,41 € em contas» —, toda
ela de uma consulta só (`my_trip_history`), porque uma lista não pode perguntar jogo a jogo.

O resumo é privado: ninguém vê com quem foste nem o que gastaste.

Verificado com testes em transação revertida: quem só pediu lugar não abre as contas, não as vê e não pode entrar
numa despesa; abrir duas vezes devolve a mesma sessão; não se cria grupo nenhum; a viagem só aparece «a decorrer» a
quem vai nela; e o histórico só conta a viagem a quem foi.

## 2026-09-16 — As contas da viagem: quem pagou o quê e quem paga a quem

A viagem acaba sempre da mesma maneira: um pagou o jantar, outro as portagens, outro a casa, e no
fim ninguém sabe bem as contas. A app passa a fazê-las.

**Uma sessão por grupo e por jogo** (`trip_session`, único em `group_id` + `fixture_id`). Abre quando
alguém a abre — a app propõe-na a partir da véspera do jogo, que é quando a viagem começa — e nunca
fecha: fica lá para consulta muito depois do apito. As contas são sempre de um grupo, porque é o
grupo que sabe quem foi à viagem.

**Cada despesa é dividida por igual entre quem entra nela.** Nem todos bebem, nem todos dormem na
casa: quem lança a despesa escolhe quem entra (sem escolher ninguém, entra o grupo todo) e diz quem
pôs o dinheiro, que pode não ser quem está a escrever. As categorias são as de um dia de jogo:
cervejas, petiscos, refeição, bilhetes, casa, boleia, portagens, outro.

**Os cêntimos que sobram têm dono.** 10,01 € por duas pessoas dá 5,01 € e 5,00 €, e o cêntimo a mais
vai sempre para os primeiros por ordem do identificador — a mesma ordem no servidor
(`trip_balances`) e na app (`dividirCentimos`). Assim a soma das partes é **exatamente** o que foi
pago, e a conta não muda de um dia para o outro.

**Quem divide é o servidor** (regra 6). `trip_balances` diz quanto cada um pôs e quanto lhe coube; a
app só desenha. O que a app calcula é a lista de transferências (`src/lib/acerto.ts`), e essa tem
testes, como manda o `CLAUDE.md`.

**O «menor número de transferências» tem um limite honesto.** O mínimo absoluto é um problema sem
solução rápida conhecida (é preciso descobrir todos os grupos de pessoas cujos saldos se anulam
entre si). O que fazemos: primeiro fecham-se os **pares que se anulam exatamente** — duas pessoas,
uma transferência — e só depois o maior devedor paga ao maior credor. Nunca sai mais do que uma
transferência por pessoa menos uma, e nas contas de uma viagem sai quase sempre o mínimo mesmo.

**Quem sai do grupo não leva o dinheiro com ele.** Os saldos começaram por ser feitos a partir de
quem está no grupo *agora*; quem pagasse o jantar e saísse a seguir levava o dinheiro consigo e os
saldos deixavam de somar zero. Passam a entrar nas contas todos os que aparecem nas despesas, mesmo
já fora do grupo (migração `20260916440000`). Ver continua a ser só para quem é do grupo.

**A app não move dinheiro nenhum.** Só diz quem paga a quem. Está escrito no ecrã.

Verificado com testes em transação revertida: quem não é do grupo não abre a sessão, não vê as
despesas nem os saldos; ninguém de fora entra numa despesa; só quem lançou ou quem pagou apaga; os
saldos somam zero e as partes somam o que foi pago; e quem sai do grupo continua nas contas.

## 2026-09-16 — O passaporte ganha a Europa

O passaporte tinha os 57 estádios nacionais e os 22 onde as equipas portuguesas já jogaram fora.
Faltavam os que qualquer adepto quer visitar um dia e que não aparecem em jogo nenhum da app.
Entraram mais **76**: Camp Nou, Wembley, Bernabéu, Signal Iduna Park, Old Trafford, Allianz Arena,
San Mamés, Celtic Park, Ibrox…

**De onde vêm:** Wikidata (nome, capacidade, país, coordenadas) e Nominatim (a cidade, em
português). Só entram estádios **com 40 000 lugares ou mais**, que são **casa de um clube** e que
**não foram demolidos**. Cinco recintos que passavam nesse crivo mas que ninguém visita hoje — o
Cathkin Park é uma ruína desde 1967, o Parkstadion está desativado — estão excluídos um a um, com a
razão escrita no script.

**Entram sem clube associado.** As cores de um clube estrangeiro não se adivinham, e inventá-las
seria pôr na app informação que não temos. O `toVenue` passa a aceitar estádios sem dono, e o
carimbo desses fica com a cor neutra da app.

Uma limitação assumida: as etiquetas em português do Wikidata ficam por vezes um nome de patrocínio
atrás (Amsterdam ArenA, Türk Telekom Arena). É o nome que a fonte dá; corrige-se quando alguém
reparar.

## 2026-09-16 — A volta, no dia do jogo

Depois do apito, uma boleia de ida não serve para nada: o que interessa é **quem volta e para onde**.

- **A secção das boleias muda de cara com o apito.** Passa a mostrar quem volta com lugar, agrupado
  **por destino** — «Para Viseu», «Para Mangualde» —, e diz de frente a quem não tem carro: «Não tens
  maneira de voltar? Vê aqui quem ainda tem lugares.» Quem já tem lugar no regresso vê outra coisa:
  o convite a abrir os lugares que lhe sobram.
- **O destino é o concelho de onde a boleia saiu** (`origin_city`), escrito na criação pela função
  `rides` com uma chamada ao Nominatim. Se não se souber, a boleia aparece em «Sem destino indicado»
  — nunca se inventa um destino.
- **Os pedidos de volta abrem com o apito** (abriam ao intervalo): é à chegada que se percebe quem
  ficou sem transporte. A regra mudou no servidor e na app ao mesmo tempo.
- **Dá para abrir lugares na volta a meio do jogo** (`set_ride_return_requests`): quem publicou uma
  boleia de ida e volta carrega em «Abrir os lugares da volta» e passa a receber pedidos. Também dá
  para voltar a fechar.

Regras verificadas com teste SQL revertido: com os lugares fechados não aparece nada, quem não é o
condutor não os abre, e ao abrir o carro aparece com o destino e o preço por pessoa.

## 2026-09-16 — Ecrã do jogo: índice no topo, barulhómetro coerente e aviso do carimbo

**Índice no topo.** A ficha do jogo tem uma dúzia de secções e era preciso rolar para descobrir o que
lá estava. Agora abre com uma fila de secções — Barulhómetro, Estádio, Mapa, Boleias, Onde dormir,
Estacionamento… — e tocar leva a página até lá. A fila mostra só as secções que aquele jogo tem.

**Barulhómetro coerente.** Exigia check-in num tasco perto do estádio — regra escrita antes de
existir o carimbo, e que deixava de fora exatamente quem está na bancada a fazer o barulho. Agora
vale qualquer prova de presença nesse dia: **carimbo do estádio ou check-in no tasco**
(`noise_needs_presence`). E o cartão passa a dizer o que falta, em vez de mostrar um botão desativado
sem explicação.

**Aviso do carimbo.** Quinze minutos depois do apito, para quem marcou que vai: «Já estás no
estádio? Carimba-o enquanto cá estás. Depois de sair já não dá.» O carimbo é a única coisa que prova
a visita, e ninguém se lembra dele sozinho.

## 2026-09-16 — «Hoje há jogo ao pé de ti»

Para quem não marcou nada na app: um aviso de manhã, no próprio dia, quando há jogo num estádio perto
de casa. Não é preciso abrir a app nem dar permissão nenhuma nova.

**Porque não é geofencing.** Reparar que o telemóvel está a 2 km do estádio com a app fechada exige
localização em segundo plano (permissão «Sempre»), a dependência `expo-task-manager` e um
*development build* — **não funciona no Expo Go**, e a Apple pede justificação para essa permissão.
Fica para quando houver build própria; até lá, isto dá quase o mesmo efeito sem pedir nada a
ninguém.

**Como sabe que é «ao pé de ti»** sem ler a localização: pelo estádio do **clube da terra** (ou, sem
ele, do clube do coração), que a pessoa já escolheu. Um jogo conta como perto até **40 km** em linha
reta.

**Quando toca:** às 10:00 do dia do jogo — com tempo para decidir, combinar boleia e ver onde
almoçar — ou três horas antes do apito, se o jogo for de manhã. Jogos já marcados ficam de fora:
esses têm os avisos do plano. E continua a não haver avisos na véspera.

Regras em `src/lib/avisos-perto.ts` com 7 testes.

## 2026-09-16 — O jogo, o bilhete, o carimbo e o ranking

**O jogo mostra tudo o que é do jogo.** As boleias só apareciam depois de abrir o bilhete à mão,
enquanto as casas apareciam logo — uma incoerência que não se explicava a ninguém. Agora a ficha do
jogo tem as duas coisas.

**O bilhete abre-se sozinho.** Oferecer boleia, pedir lugar, propor ou entrar numa casa e pedir
boleia de volta passam a marcar «vou» (`garantirVou`): quem faz isso já disse, por atos, que vai. O
bilhete deixa de ser um botão a carregar e passa a ser o sítio onde estão as tuas coisas.

**O carimbo do estádio passa a valer alguma coisa.** Era declarado — bastava marcar que se esteve no
jogo. Agora, em dia de jogo e perto do estádio (das 4 h antes às 5 h depois do apito, até 1 km), a
app lê a posição uma vez e o servidor confirma a distância (`stamp_stadium`). Fica o estádio, o jogo
e o dia; a posição **não** é guardada. Os carimbos antigos continuam a contar no passaporte, mas
como **declarados**, e o passaporte diz quantos são de cada tipo.

**Passaporte com a Europa.** Os 22 estádios onde as equipas portuguesas jogaram fora deixaram de
estar na base de dados sem uso: passam a ser um grupo do passaporte, ao lado das divisões nacionais.

**Rankings públicos** (`stadium_ranking`, mais o de tascos que já existia): qualquer pessoa com conta
os vê — não é preciso ser amigo de ninguém. Aparecer neles continua a ser escolha de cada um, mas a
app pergunta de frente no primeiro carimbo, em vez de esconder a opção nas definições. **Só conta o
que a app confirmou**: carimbos no estádio e check-ins no tasco. Um ranking onde se pontua marcando
coisas à mão não vale nada.

Regras verificadas com teste SQL revertido: carimbar do Porto um jogo em Viseu é recusado, carimbar
um jogo de anteontem é recusado, e o carimbo marca também presença no jogo.

## 2026-09-16 — A app a respirar: espaçamento e hierarquia

A app estava amontoada, e não era por falta de margens: era por **todas as distâncias serem iguais**.
Um título de secção estava tão perto do bloco de cima como do seu próprio cartão, e dentro dos
cartões o texto andava a 8 px de tudo. Sem distâncias diferentes não há agrupamento, e sem
agrupamento o olho não sabe o que pertence a quê.

**A escala ganhou os dois degraus que lhe faltavam** (`Spacing`): 12 («ar entre linhas dentro de um
cartão») e 20 («ar entre blocos de um ecrã»). Os nomes antigos não mudaram, por isso nenhum ecrã
teve de ser reescrito.

**As três mudanças que valem por todas as outras**, porque estão nos componentes base:
- **Ecrã**: 20 px entre blocos, em vez de 16;
- **Cartão**: 20 px de margem interior e 12 px entre linhas, em vez de 16 e 8;
- **Título de secção**: 32 px acima e 12 abaixo (era 32 e 16). É a distância que diz «este cartão é
  deste título».

Depois disso, o detalhe: as linhas com moldura (uma casa, uma boleia, um parque, um carro de volta)
passaram a ter 12 px de margem interior e 8 entre linhas, as filas de etiquetas deixaram de estar
coladas, e os blocos separados por um fio ganharam mais ar por cima.

**O cartão da dormida deixou de ser uma parede**: era um cartão único com quatro secções lá dentro;
passou a ser um cartão por assunto — o resumo, cada casa, o aviso, propor uma casa e procurar no
Airbnb. O mesmo assunto, mas cada coisa no seu sítio.

## 2026-09-16 — Primeiro entre a malta, depois para toda a gente

Uma boleia ou uma casa criadas dentro de um grupo começam **privadas**: só as vê quem é do grupo.
Quando o carro não enche (ou sobram camas), quem as ofereceu carrega em «abrir a toda a gente» e
elas passam a aparecer no quadro do jogo como quaisquer outras, com os lugares já ocupados à vista —
quem entra vê que vai com malta que já se conhece.

**O nome do grupo não aparece a quem é de fora.** Vê-se «Boleia do João · 2 lugares ocupados ·
2 livres». O nome de um grupo privado não é da conta de estranhos; quem é do grupo continua a ver a
etiqueta. A regra está nas funções do servidor (`ride_board`, `fixture_stay_plans`), que devolvem o
nome do grupo a `null` para quem não é membro.

Enquanto está fechada, uma boleia também **não recebe pedidos de lugar nem de boleia de volta** de
quem não é do grupo: `request_ride_seat`, `request_stay_place` e `ride_return_board` tratam-na como
se não existisse.

Regras verificadas com teste SQL revertido: um estranho não vê a boleia privada nem consegue pedir
lugar; quem é do grupo vê-a com o nome do grupo; depois de aberta, o estranho vê a boleia mas sem o
nome do grupo.

**A seguir:** a sessão da viagem (abre no dia do jogo) com as despesas — quem pagou o quê, quem entra
em cada uma — e o acerto de contas.

**O grupo mostra o que tem em mãos** (`group_plans`, 2026-09-16). De nada serve marcar uma boleia
como sendo do grupo se depois é preciso ir à ficha de cada jogo para a encontrar. O ecrã do grupo
passa a listar as boleias e as casas do grupo, do jogo mais próximo para a frente, com os lugares
por encher, o que fica a cada um agora e se está fechada ao grupo ou aberta a toda a gente. Quem a
ofereceu tem ali mesmo o «Não enche? Abrir a toda a gente» — que é a decisão que se toma a olhar
para os lugares que faltam, não noutro ecrã qualquer.

## 2026-09-16 — Uma boleia não é um grupo: as viagens é que se ligam aos grupos

**O erro.** Ao criar um grupo por cada boleia, a app produzia grupos que ninguém pediu — e, pior,
duplicava malta: se alguém do meu grupo aparecesse por acaso numa boleia minha, nascia um segundo
grupo com as mesmas pessoas. Um grupo é gente que anda junta e dura; uma boleia é uma viagem que
acaba no domingo à noite.

**O modelo certo.** Nenhum grupo nasce sozinho (o gatilho `group_for_ride` foi removido). Em vez
disso:
- uma **boleia** ou uma **casa** podem ser «de um grupo» (`ride.group_id`, `stay_plan.group_id`),
  escolhido por quem as oferece, entre os grupos em que está. A boleia continua aberta a qualquer
  adepto: o grupo é uma etiqueta, não uma fechadura;
- o grupo ganha assim o **histórico das viagens** (`group_trips`): os jogos em que teve boleia ou
  casa, com quantos lugares foram dados;
- quem andou com gente nova cria um grupo **quando quiser**, com um toque, e recebe o link para
  mandar a quem foi consigo.

Se ligar a boleia ao grupo falhar, a boleia fica publicada na mesma e o condutor escolhe depois: uma
etiqueta nunca deve estragar uma viagem.

Regras verificadas com teste SQL revertido: só o condutor liga a sua boleia a um grupo, e só a
grupos onde está; aceitar um passageiro já não cria grupo nenhum.

## 2026-09-16 — Grupos: a malta que anda junta

**Porquê.** A app servia para encontrar desconhecidos. Faltava o contrário: ir com quem já se conhece,
e levar mais um ou outro que se conhece menos. Um grupo é um conjunto de pessoas que se mantém de
jogo para jogo, e é dentro dele que vão passar a viver a boleia, a casa e (a seguir) as contas.

**Como se entra.** Por convite: um link com um código, como a partilha da boleia. **Quem tem o link
entra** — sem pedidos nem aprovações, porque um grupo de amigos não precisa de burocracia. Em troca,
quem criou o grupo pode trocar o link (o antigo deixa de servir) e tirar alguém de lá.

**Grupos que nascem sozinhos.** Quando a primeira pessoa é aceite numa boleia, fica criado o grupo
dessa boleia com o condutor e ela, e cada pessoa aceita a seguir entra nele (gatilho
`group_for_ride`). Se alguma coisa correr mal ao criar o grupo, o pedido de lugar segue na mesma: um
grupo nunca estraga uma boleia.

**Sair.** Quem sai, sai. Se sair quem criou o grupo, ele fica com o membro mais antigo; se sair o
último, o grupo acaba.

**O que se vê de cada um**: o mesmo que nas casas — desde quando tem conta, quantas boleias fez e
quantas faltas tem. Sem fotos de perfil: não verificam nada.

**Também se simplificou a regra das casas**: a semana de conta saiu. Travava quem acabou de instalar
a app e não trava ninguém de má-fé (basta esperar sete dias). Fica a suspensão por faltas, que
significa mesmo alguma coisa.

Regras verificadas com testes SQL revertidos: quem não é dono não muda o nome, o link trocado deixa
o antigo sem efeito, a saída do dono passa o grupo ao membro mais antigo, e a primeira pessoa aceite
numa boleia cria o grupo com duas pessoas lá dentro.

**A seguir:** as despesas da viagem dentro do grupo (cerveja, petiscos, casa, bilhetes e o que se
quiser acrescentar), divididas por igual entre quem entra em cada despesa, e o acerto de contas a
dizer quem paga a quem com o menor número de transferências.

## 2026-09-16 — Dormir fora: casas propostas pelos adeptos, divididas como as boleias

**O que não dá.** O Airbnb não tem API pública e a de parceiros é fechada. Verifiquei a 2026-09-16
que um anúncio inventado (`/rooms/1234…`) devolve **HTTP 200** na mesma — a página só diz que não
existe depois de carregar no browser. Não há forma honesta de a app saber se uma casa continua
disponível, e raspar a página viola os termos do Airbnb.

**Por isso a app não guarda disponibilidade: guarda pessoas.** Funciona como as boleias:
- **propor uma casa**: quem encontra uma casa no Airbnb propõe-na com o **custo total**, as noites e
  quantos lugares tem. O preço por pessoa é calculado no servidor (`stay_share_cents`, a mesma regra
  da boleia: total a dividir por quem lá dorme, arredondado para cima ao cêntimo) e **desce a cada
  pessoa que entra**;
- **pedir lugar**: como na boleia, quem propôs é que aceita ou recusa (`stay_place`);
- **convicção de quem propõe**: «reservo de qualquer maneira» ou «só reservo se encher» — é o que
  diz aos outros se podem contar com aquilo;
- **precisar de cama**: quem ainda não viu nada diz só isso, sem preço nenhum, para os outros saberem
  quanta gente há;
- **marcar como reservada** quando a casa for fechada.

O link do anúncio é guardado com o nome de quem o viu e a **data** em que o viu, e a app diz à frente
que pode já não estar disponível: é de quem o propôs, não uma garantia nossa. O botão de pesquisa
continua a abrir o Airbnb com a cidade e as datas do jogo, e esse nunca fica desatualizado.

**Duas correções ao desenho anterior, vindas do teste na app:** pedia-se «quanto pagaste» (ninguém
pagou nada ainda) e depois «até quanto pagas por pessoa e por noite» (ninguém pensa assim, e não
havia forma de entrar na casa de alguém). As escolhas de noites e pessoas também estavam no topo,
onde pareciam parte da resposta de cada um; agora vivem dentro do bloco da pesquisa.

Só aparece em jogos no estrangeiro e nas ilhas, e é o servidor que confirma isso
(`fixture_needs_stay`). Regras verificadas com teste SQL revertido: pedir lugar na própria casa é
recusado, responder a pedidos de casa alheia é recusado, e a casa de 300 € passa de 300 € para 150 €
por pessoa quando alguém entra — e volta a 300 € quando sai.

**Fora o «preciso de cama» (2026-09-16, depois de testar).** Dizer que se precisava de cama não
levava a lado nenhum: quem propunha uma casa não tinha como convidar ninguém e a lista enchia-se de
gente à espera. A dormida passou a ser só uma coisa: casas propostas, com lugares, que a malta
divide.

**Quem pode propor ou entrar numa casa** (`can_share_house`): conta com mais de uma semana **ou**
pelo menos uma boleia terminada, e nunca quem está suspenso por faltas. Não é verificação de
identidade — a app não faz isso e não o vai fingir. Uma foto de perfil também não verifica nada
(qualquer um descarrega uma da internet), por isso o que se mostra é o que a app sabe mesmo: desde
quando a pessoa tem conta, quantas boleias fez e quantas faltas tem, ao lado de cada nome e de cada
pedido. A regra está no servidor, não só na app.

**Avisos.** O cartão diz, sem rodeios, que a app não trata de dinheiro nem reserva nada: paga-se
pelo Airbnb e não se fazem transferências a desconhecidos antes de a reserva existir e de se ver a
confirmação. Quem já foi aceite numa casa é visível a toda a gente que a vê — é com essas pessoas
que se vai dormir.

**«O teu grupo neste jogo»** (`src/components/grupo-do-jogo.tsx`). Em vez de criar grupos com
convites e permissões, a app junta o que já existe: a boleia em que vais (com quem), a casa que vais
dividir (e quanto fica a cada um) e o tasco escolhido. Aparece no «O meu jogo» e desaparece sozinho
quando não há nada combinado.

## 2026-09-16 — Tascos sugeridos pelos próprios adeptos (e os que ficam mais longe)

**O buraco.** Todos os tascos vinham do OpenStreetMap ou da pesquisa. Quem conhecia um sítio que não
estava em lado nenhum não tinha como o pôr na app — e os sítios a mais de 20 min a pé eram escondidos
da lista, por bons que fossem.

**Sugerir um tasco** (`suggest_place`, ecrã `/locais/sugerir-tasco`). Nome, tipo, pino no mapa (começa
onde a pessoa está) e, se quiser, porque é que vale a pena. As travas, todas no servidor:
- é preciso conta; no máximo 3 sugestões por dia e 10 por mês;
- até 45 minutos a pé de um estádio com jogos — mais longe do que isso já não é um sítio de dia de
  jogo;
- nada de duplicados: não entra se já houver um tasco a menos de 60 m ou com o mesmo nome nesse
  estádio (nomes comparados sem acentos nem pontuação);
- links, emails e números de telefone no nome são anúncios, não tascos: recusados;
- nasce como sugestão e só fica confirmado com **5 adeptos diferentes** a dizer que sim, como
  qualquer outra sugestão. Quem sugere não vota no seu próprio tasco: a política de RLS recusa o voto
  e a contagem ignora-o;
- uma sugestão que ninguém votou em 60 dias é apagada por um cron diário.

A app mostra sempre de onde vem: etiqueta «De um adepto», a nota de quem sugeriu e quantos
confirmaram. As fotos continuam a passar pela moderação que já existia.

**Mais longe, mas vale a caminhada.** A lista continua a mostrar primeiro os que ficam a menos de
20 min, mas passa a ter uma secção com os que ficam para lá disso **e** foram confirmados ou
sugeridos por adeptos (`valeACaminhada`, com testes). Um sítio longe que ninguém recomendou continua
de fora: longe *e* desconhecido não é uma dica.

**Correção de fundo: não havia `npm run typecheck`.** O script nunca existiu no `package.json`, por
isso o comando não verificava nada. Foi acrescentado (`tsc --noEmit`) e os **71 erros de tipos** que
estavam escondidos foram corrigidos — mocks dos estádios e dos locais, tipos da navegação da conta,
um ícone em falta e um tom de ícone que não existia. O projeto passa agora o `tsc` sem erros.

## 2026-09-16 — Ruas dos adeptos da casa e hora de chegada pelo parque

**Ruas dos adeptos da casa.** Até agora a app só sabia onde estavam os adeptos da casa *durante* um
jogo: alguém assinalava uma célula, três pessoas concordavam, e 48 h depois estava tudo apagado.
Nada se transformava em «costuma ser aqui».

Passa a haver três camadas no mapa, com origens diferentes e cores diferentes:
- **ruas** (linha laranja): o que os adeptos assinalaram, jogo após jogo, encostado à rua onde
  aconteceu. `venue_street` guarda as ruas com nome até 1,5 km de cada estádio (OpenStreetMap,
  13 814 troços em 19 estádios) e `home_fan_cell` guarda a contagem por célula e por estádio —
  só números, nunca quem assinalou. Uma rua só aparece a partir de **5 pessoas diferentes e
  2 jogos diferentes**, a mesma regra de todos os agregados da app;
- **zonas conhecidas** (círculo laranja escuro): as notas pesquisadas que nomeiam um sítio real ao ar
  livre. Quatro ficaram com coordenadas (Pavilhão João Rocha, Avenida Padre Cruz, Praça Cosme Damião,
  Alto dos Moinhos); as outras três não eram inequívocas e ficaram sem pino, como deve ser. As notas
  sobre bancadas, portas e setores continuam só em texto: um mapa de ruas não as sabe mostrar;
- **adeptos agora** (o que já existia): os sinais do próprio jogo.

A conversão é feita por `roll_up_home_fan_reports()`, de hora a hora, antes de os sinais em bruto
serem apagados — o apagamento continua igual.

**Hora de chegada conforme o parque.** Dizer «enche cedo» não chega: agora cada parque diz a que
horas é preciso lá estar (`chegadaRecomendada`). Um parque vermelho pede mais 45 min, um amarelo mais
20, um verde nada, e nos jogos grandes tudo o que está perto do estádio sobe um nível. Na boleia,
escolher um parque que enche cedo puxa a hora de saída sugerida para trás e explica porquê.

## 2026-09-16 — Boleia de volta para quem perdeu o transporte

**O problema.** Acaba o jogo e há sempre quem fique sem maneira de voltar: perdeu o autocarro, o
comboio já foi, o grupo desfez-se. Quem tem carro está ali ao lado e vai fazer o caminho de volta
vazio.

**Como funciona.** Ao publicar a boleia, quem vai e volta pode ligar «Aceito pedidos de boleia de
volta». Depois do jogo, no ecrã do jogo aparece «Perdi o transporte: pedir boleia de volta», com os
carros que voltam e ainda têm lugar. O condutor recebe notificação e decide na hora.

**Janela** (`ride_return_opens_at` / `ride_return_closes_at`, e `src/lib/regras-volta.ts` para a UI):
dos 60 minutos depois do apito (por volta do intervalo) até 3 h 30 depois (cerca de uma hora depois
do fim). O condutor tem mais uma hora para responder. Antes disso ninguém perdeu nada; depois disso
os carros já foram.

**Preço: a parte de metade do custo.** Metade da viagem é a volta. Essa metade é dividida por todos
os que voltam no carro — condutor, quem já tinha lugar e quem entra agora — e arredondada ao cêntimo
para cima, como todas as divisões da app. Quantos mais voltarem, menos cada um paga. A conta é feita
no servidor (`ride_return_share_cents`), com testes em SQL e em `returnShareCents`.

**Privacidade.** O adepto manda a posição só para se calcular a distância ao carro; o que fica
guardado é apenas essa distância, arredondada a 100 m, e é isso que o condutor vê. A posição não é
guardada nem mostrada a ninguém, como em toda a app.

**As mesmas regras de fiabilidade.** Quem está suspenso não pede. Um lugar na volta conta como
qualquer outro lugar: `ride_role` e `settle_rides` passam a incluí-lo, por isso faltar depois de
aceite é uma falta, com direito a imprevisto e a votação como nas outras boleias.

**Limite.** Só boleias de ida e volta: pedir lugar de volta a quem não volta não faz sentido.

## 2026-09-16 — Hora de saída pela distância, parques com estimativa de lugar e partilha da boleia

**Hora de saída sugerida, não fixa** (`src/lib/hora-saida.ts`). As opções fixas («3 h antes») não
serviam: a viagem pode ser de 20 minutos ou de três horas. A sugestão é o apito menos o tempo de
viagem do percurso escolhido, menos os minutos a pé do parque, menos a margem: 45 minutos nos jogos
normais e 75 nos jogos grandes (Benfica, FC Porto ou Sporting em campo, ou jogos europeus), porque
há mais trânsito, mais filas e mais polícia. O condutor ajusta de 15 em 15 minutos dentro da janela
que o servidor aceita (pelo menos 3 h a partir de agora, no máximo 3 dias antes, até 30 minutos
antes do apito) e é avisado quando escolhe menos margem do que a sugerida.

**Mais parques, com uma cor honesta** (`src/lib/facilidade-estacionamento.ts`,
`scripts/importar-parques-osm.mjs`). Aos parques pesquisados juntam-se os parques públicos do
OpenStreetMap até 3 km do estádio (sem estacionamento na rua nem parques privados; sem nome no
OpenStreetMap, ficam com o nome da rua onde estão, pelo Nominatim). A coluna `source` separa os dois:
os pesquisados têm fontes de dia de jogo, os do OpenStreetMap não têm, e a app diz sempre de onde
vêm.

A cor é uma **estimativa**, nunca lugares livres em tempo real — isso ninguém publica de graça:
- verde, costuma haver lugar: longe do estádio, ou perto mas grande (300+ lugares);
- amarelo, pode ser difícil;
- vermelho, enche cedo: colado ao estádio, ou fechado em dia de jogo;
- cinzento, sem dados.
Num jogo grande, tudo o que fica a menos de 1,2 km desce um nível. O parque recomendado passou a ser
o de melhor estimativa, e não o mais perto: o mais perto é o primeiro a encher. Regras testadas em
`src/lib/facilidade-estacionamento.test.ts`.

**Localização ao oferecer boleia.** O ponto de partida diz agora em que estado está: à procura,
encontrada, recusada (com atalho para as Definições) ou indisponível, e «Usar a minha localização»
mostra quando o pino já está lá.

**Quantos adeptos vão** (`fixture_going_count`). O número só aparece a partir de 5 pessoas, como
todos os agregados da app; abaixo disso a app explica-o em vez de mostrar um número.

**Partilhar boleia por link.** O botão partilha um link `Linking.createURL('/jogos/boleia')` com o
id da boleia e do jogo, que abre a boleia dentro da app a quem já a tem instalada.

## 2026-09-16 — Avisos das boleias: notificações e destaque ao abrir a app

**Porquê.** No teste com duas contas, o pedido de lugar só aparecia a quem abrisse a boleia. Um
pedido sem resposta caduca 2 h antes da saída, por isso o condutor tem de saber logo.

**Notificações** (`ride-notify`, chamada por gatilhos em `ride_passenger` e `ride` com o segredo do
cron, pelo `pg_net`):
- pedido de lugar: vai para o condutor, com a hora-limite para responder;
- aceite: vai para o passageiro, com o ponto de encontro e a hora;
- recusado ou sem resposta: vai para o passageiro;
- passageiro saiu: vai para o condutor;
- boleia cancelada: vai para quem tinha lugar ou tinha pedido.

Tocar na notificação abre a boleia. Se o envio falhar, o pedido ou o cancelamento não são afetados (o
gatilho engole o erro).

**Telemóvel registado para toda a gente com conta.** Antes só se registava com as sugestões do
treinador ligadas. As sugestões continuam a ir só a quem as ligou, porque o filtro está no servidor.
A permissão para notificações é pedida ao publicar uma boleia e ao pedir lugar.

**Destaque ao abrir a app** (`my_ride_alerts`, topo dos Jogos, atualiza de minuto a minuto):
- pedidos por responder, com a hora-limite;
- «Tens lugar», até à saída;
- pedido recusado ou sem resposta, e boleia cancelada, durante 24 h.

**Correção.** Depois de publicar, atualizar as consultas das boleias tentava correr as que estavam
desligadas (`skipToken`) e dava erro. A atualização passou a ignorá-las.

## 2026-09-16 — Estacionamento limpo, adeptos da casa para visitantes e fotos dos adeptos

**Estacionamento mais limpo e ligado às boleias.**
- Na ficha do jogo aparece primeiro o parque «Recomendado» (aberto em dias de jogo, com localização
  e mais perto do estádio), com os minutos a pé.
- Os avisos de dia de jogo, os outros parques e as fontes ficam atrás de um toque.
- No mapa do jogo, os parques aparecem com um «P» azul, como a sinalização de estrada, e o cartão tem
  «Como chegar de carro».
- Ao oferecer boleia, o condutor escolhe «Onde deixamos o carro» entre os parques verificados abertos
  em dias de jogo, e os passageiros veem-no na boleia com os minutos a pé até ao estádio.
- Um parque só é chamado «seguro» se uma fonte o disser.

**Localização dos parques.** Procurámos os parques no OpenStreetMap pelo nome e pelo operador e
confirmámos cada correspondência à mão. Entraram 4:
- Parque exterior do Estádio Cidade de Barcelos, a 142 m;
- EMEL Cosme Damião, a 277 m;
- Fonte Nova, a 650 m;
- EMEL Estrada da Luz, a 1171 m.

Rejeitámos as correspondências só pela palavra da cidade, por exemplo um parque privado da Câmara de
Guimarães ou um parque em Monsanto para «Benfica Estádio». Ficaram 7 de 32 parques com pino. Os
outros mostram a morada.

**Adeptos da casa, para visitantes, em todos os jogos.** A pesquisa com fontes (PSP, clubes, jornais,
guias) quase não encontrou bares identificados; só um, a «casinha» da Juventude Leonina em Alvalade.
Encontrou sobretudo bancadas e portas onde não se aceitam cores do visitante, zonas a evitar e os
percursos oficiais dos visitantes. Com isso:
- `venue_safety_note` ganhou os tipos `zona_adeptos_casa` e `percurso_visitantes`;
- foram importadas 22 zonas e 14 percursos, em 16 estádios (`npm run db:adeptos-casa`, só confiança
  alta ou média);
- aparecem em «Cuidados para adeptos visitantes» em todos os jogos, e não só nos clássicos.

**Adeptos da casa assinalados no mapa** (`home_fan_report`). Perto do jogo (de 6 h antes a 3 h
depois), quem tem conta pode carregar em «Assinalar adeptos da casa aqui».
- **Anonimato:** a app usa a localização só para marcar a célula de cerca de 150 m à volta; o servidor
  guarda a célula e nunca a posição, e ninguém vê quem assinalou.
- **Visibilidade:** a zona só aparece no mapa, a laranja, com pelo menos 3 pessoas diferentes, e só até
  6 h depois do apito. Os avisos são apagados 48 h depois.
- **Proteção:** de propósito, só se assinalam adeptos da casa e nunca visitantes, porque isso ajudaria
  a encontrá-los. Não se consegue assinalar a mais de 3 km do estádio, e cada pessoa faz no máximo 10
  por hora.
- **Testado:** 2 pessoas não mostram a zona e 3 mostram; ninguém lê quem assinalou; recusa longe do
  estádio e sem conta.

**Fotos dos tascos enviadas pelos adeptos, com aprovação.** Os adeptos já podiam enviar fotos, mas
ninguém as aprovava. Agora:
- os administradores têm o ecrã «Fotos por aprovar» (`moderate_place_photo`);
- a regra para aprovar é mostrar o tasco e não ter pessoas reconhecíveis em destaque;
- a foto aprovada aparece no cartão do mapa e na ficha dos tascos sem foto própria, como «Foto de um
  adepto», sem dizer quem a enviou, através de um endereço temporário, porque o bucket é privado;
- a missão «Fotografa o teu tasco» fica concluída quando uma foto é aprovada, e a foto aprovada serve
  de prova.

## 2026-09-16 — Boleias em que se pode confiar: prazos, compromisso, faltas e imprevistos

**Porquê.** Sem pagamentos na app, não há caução. A confiança vem de regras claras, de uma reputação
visível e de suspensões, mas sem castigar quem tem um azar real.

**Prazos** (iguais no servidor e em `src/lib/regras-boleia.ts`, com testes):
- a boleia é publicada pelo menos 3 h antes da saída (Edge Function);
- os pedidos de lugar fecham 2 h antes da saída, e os que o condutor não respondeu caducam (tarefa
  de 10 em 10 minutos);
- até esse prazo, qualquer pessoa cancela sem falta.

**Compromisso.** Publicar e pedir lugar passam por um ecrã de aviso grande. Nada avança sem marcar
«Percebi: se cancelar tarde ou não aparecer, fico com uma falta e posso ser suspenso». O servidor
recusa sem essa confirmação (`rules_not_accepted`). Há lembretes no telemóvel na véspera, 3 h antes
(com o aviso das faltas) e 4 h depois da saída, para confirmar quem apareceu.

**Depois da saída.**
- Durante 48 h, quem foi na boleia diz quem apareceu; ninguém vê o que cada um respondeu.
- Desde 2 h antes até 24 h depois, qualquer pessoa pode registar «Tive um imprevisto» com um motivo:
  doença, avaria, acidente ou trânsito, trabalho ou família, ou outro.
- Os outros votam «Aceito» ou «Não aceito» até 72 h depois.
- O imprevisto só é recusado se houver mais votos contra do que a favor; com empate ou sem votos, é
  aceite.

**Fecho das contas** (`settle_rides`, de hora a hora, 72 h depois da saída). Cada pessoa fica com um
resultado:
- **Não apareceu:** a maioria das respostas diz que não apareceu.
- **Cancelou tarde:** o passageiro saiu depois do prazo, ou o condutor cancelou depois do prazo.
- **Falta perdoada:** as duas situações acima, com um imprevisto aceite, não contam como falta.
- **Disputa, sem falta:** duas pessoas só se acusam uma à outra.
- **Boleia feita:** nenhum dos casos acima.

As boleias canceladas dentro do prazo, ou em que ninguém entrou, não dão resultado a ninguém.

**Suspensões.** 2 faltas em 180 dias suspendem as boleias durante 30 dias; 3 faltas, durante 180
dias. A suspensão impede publicar (Edge Function) e pedir lugar (`request_ride_seat`). A reputação
só aparece como contagem, «14 boleias · 1 falta», na lista de boleias, no detalhe e ao aceitar
pedidos.

**Testado** numa transação desfeita:
- falta por maioria (e o condutor sem falta com uma só acusação);
- imprevisto aceite com empate;
- cancelamento tarde;
- disputa;
- suspensão com 2 faltas;
- recusa de pedidos depois do prazo e sem aceitar as regras.

**Ainda não.** Um administrador rever quem tem mais de 3 imprevistos em 3 meses. Por agora os dados
ficam guardados (`ride_incident`) para uma consulta à mão.

## 2026-09-16 — Estacionamento em dia de jogo

**O quê.** A ficha do jogo tem a secção «Estacionamento» com:
- os avisos de dia de jogo (estradas cortadas, parques fechados, reboques, conselho para ir de metro);
- um resumo por estádio;
- os parques, cada um com o tipo, se abre em dias de jogo, preço quando publicado, notas, morada e
  fontes.

Quando há localização, tem «Como chegar de carro».

**Lugares livres em tempo real: não há, de graça** (pesquisa de 2026-09-16).
- **Lisboa:** a EMEL não publica ocupação.
- **Porto:** os dados abertos listam os parques mas não os lugares livres.
- **Guimarães:** é a exceção, com o Parque Central Estádio a cada 5 minutos, mas os ficheiros
  pararam em agosto e a licença não permite uso comercial.
- **Operadores e outros:** os operadores (Saba, Telpark, Placegar) não têm API pública e o Google
  não dá ocupação.
- **Pago:** a única fonte com dados em tempo real é a Parkopedia, sem preço publicado.

Por isso esta versão mostra o que se sabe com fontes. Mais tarde pode vir um sinal dos próprios
adeptos («está cheio»), com o mínimo de 5 pessoas.

**Pesquisa e importação** (`parking_spot`, `venue_parking`, `npm run db:estacionamento`). Cobre os
18 estádios com jogos da Liga: sites dos clubes, câmaras, PSP, operadores e jornais. Só entram parques
com confiança alta ou média. Muitos guias do adepto da Liga parecem escritos com IA (um diz «Os
conteúdos gerados por IA podem estar incorretos») e nunca foram a única base de um parque. Um parque
só tem pino no mapa quando o Nominatim encontra o próprio parque ou o edifício; quando só encontra a
rua, fica sem pino e com a morada. Na primeira importação ficaram:
- 32 parques, 3 deles com pino;
- 25 avisos;
- informação em 17 estádios (nada verificável no do Moreirense);
- 14 parques de fora por confiança baixa.

**Por confirmar à mão.** Um edital de Famalicão (153/2025) fecharia o parque junto ao estádio de 24 h
antes a 3 h depois de cada jogo, mas a página já não abre e não foi usado.

## 2026-09-16 — Boleias: uma por jogo e pesquisa de ruas; fotos do Mapillary postas de parte

**Uma boleia aberta por pessoa por jogo.** Duas ofertas da mesma pessoa não fazem sentido e dividiam
os passageiros. Há um índice único parcial em `ride (fixture_id, driver_id) where status = 'open'`,
e a Edge Function responde `already_offering` antes de calcular percursos. Cancelar e abrir outra
continua a funcionar. Quem já oferece vê a sua boleia em vez do formulário.

**Ponto de encontro perto de quem conduz.**
- O mapa abre na localização de quem conduz; antes esperava o estádio.
- O movimento só é feito quando o mapa está pronto (`onMapReady`), porque antes disso perdia-se sem
  aviso.
- Há «Usar a minha localização» e pesquisa de rua ou sítio.

A pesquisa usa o Nominatim (OpenStreetMap) através da Edge Function `rides`, com 30 pesquisas por
hora por conta. Só pesquisa ao carregar em «Procurar», porque as regras do Nominatim não permitem
pesquisar enquanto se escreve.

**Jogos fora de Portugal.** As boleias continuam disponíveis, com o aviso de que a maioria vai de
avião. Um jogo perto da fronteira pode justificar ir de carro.

**Fotos de rua do Mapillary: testadas e postas de parte.** O script procurava, para cada tasco sem
foto, a imagem mais próxima tirada a 6–35 m, com a câmara virada para o tasco (menos de 30°), a
partir de 2018 e sem panorâmicas. Encontrou candidatas para cerca de metade dos tascos dos estádios
da Liga, mas nenhuma das cinco vistas a olho servia. Eram imagens de câmaras de carro (uma de noite)
com a estrada, carros estacionados ou contentores, e o tasco não se reconhecia. Uma foto que não
mostra o sítio engana mais do que ajuda, por isso não aplicámos nenhuma e retirámos o script. A chave
fica só no `.env.local` para uma nova experiência. O caminho mais promissor para as fotos dos tascos
são as que os adeptos já podem enviar (`place_photo`), com um ecrã de moderação.

## 2026-09-16 — Fatia 3: boleias com lugares e preço por pessoa

**O quê.** Em «O meu jogo», um condutor abre uma boleia para o jogo com:
- o ponto de encontro;
- a hora de saída;
- os lugares livres;
- o consumo do carro, o combustível e se é ida e volta.

Antes de publicar vê até três percursos (mais rápido, equilíbrio e sem portagens), cada um com o
tempo, os km, o combustível, as portagens e o preço por pessoa com cada lugar ocupado. Os outros
adeptos pedem lugar e o condutor aceita ou recusa. Cada pessoa paga o total a dividir por todos no
carro, incluindo o condutor, por isso o preço desce à medida que a boleia enche. Precisa de conta.

**Percursos sem API paga.** Usamos o Valhalla do FOSSGIS (OpenStreetMap), que é gratuito e não
precisa de chave, sempre a partir da Edge Function `rides` e com limites (30 cotações por hora e 10
boleias por dia por conta). O parâmetro `use_tolls` dá as três opções: 1 é o mais rápido, 0,2 o
equilíbrio e 0 sem portagens. Em Coimbra–Lisboa (2026-09-16) deu:
- A1 inteira: 202 km, 2 h 12;
- equilíbrio: 197 km, 2 h 53, só 49 km pagos;
- A13 sem portagens: 219 km, 3 h 47.

Quando o equilíbrio coincide com outra opção, só aparece uma vez.

**Portagens: tabela nossa, como estimativa** (`toll_rate`). Tem os preços oficiais de 2026 (classe 1)
de três viagens de referência, a dividir pelos km pagos que o Valhalla mede nessas viagens:
- A1 Lisboa–Porto: 25,05 €, 287,8 km;
- A2 Lisboa–Algarve: 23,80 €, 241,1 km;
- A2/A6 Marateca–Caia: 15,40 €, 158,6 km.

Dá cerca de 9,3 cêntimos por km pago, numa taxa nacional única. O router nem sempre diz em que
autoestrada está cada troço pago (a A1 vem sem nome), por isso uma taxa por autoestrada ainda não
seria fiável. A tabela já aceita linhas por autoestrada para quando houver dados melhores. As ex-SCUT
sem portagens desde 2025 (A4 Transmontana, A13 Pinhal Interior, A22, A23, A24, A25 e troços da A28)
também não estão marcadas como pagas no OpenStreetMap. A app diz sempre «estimativa».

**Dinheiro.** O cálculo usa só números inteiros e está em
`supabase/functions/_shared/ride-cost.ts`, partilhado pela Edge Function e pelos testes
(`src/lib/boleia-custos.test.ts`, 20 casos: arredondamentos, várias peças da mesma autoestrada, taxa
por omissão, ida e volta, divisão e escada de preços). As unidades são:
- distância em metros;
- consumo em centilitros por 100 km;
- preço do combustível em milésimas de euro por litro;
- dinheiro em cêntimos.

A parte de cada pessoa é arredondada para cima ao cêntimo, para o condutor nunca pagar mais do que a
sua parte; o que sobra, poucos cêntimos, fica com ele. A mesma regra está em SQL
(`ride_share_cents`). O custo é sempre calculado no servidor: a app manda o ponto de partida e as
definições do carro, nunca valores.

**Preço do combustível sugerido.** É a média da DGEG na semana de 14 a 20 de setembro de 2026:
gasolina 95 a 2,072 €/L e gasóleo a 2,152 €/L. O condutor pode mudar.

**Privacidade e segurança.**
- O ponto de partida é um sítio público escolhido pelo condutor, e a app pede para nunca ser a casa.
- `ride` e `ride_passenger` estão fechadas à app e tudo passa por funções que verificam quem chama:
  `ride_board`, `ride_people`, `request_ride_seat`, `answer_ride_request`, `leave_ride` e
  `cancel_ride`.
- Só o condutor e os passageiros aceites veem quem vai.
- Aceitar nunca passa dos lugares oferecidos (a boleia fica bloqueada durante a verificação).
- Cada pessoa faz no máximo 20 pedidos de lugar por dia.
- Testado numa transação desfeita.

**Ainda não.** Pagamentos e acertos entre as pessoas (fatia 4), mensagens dentro da app e boleias
para jogos nas ilhas (não há estrada).

## 2026-09-16 — Fotos dos tascos, mapa no separador Locais e estrelas do Google

**Fotos dos tascos** (`place.photo_*`, bucket público `tasco-photos`, `npm run db:fotos-tascos`). Uma
foto ajuda a perceber logo se um sítio é pub, café ou tasca. Só entram fotos com licença livre do
Wikimedia Commons, e cada uma tem de cumprir três condições:
- ter o nome do tasco;
- estar a menos de 150 m, quando o Commons tem coordenadas;
- ser confirmada a olho antes de ser enviada.

A foto aparece no cartão do mapa (miniatura) e no topo da página do tasco, sempre com autor, licença
e ligação à origem.

Na primeira passagem (2026-09-16) o script encontrou 8 fotos para os tascos pesquisados:
- **Aplicadas (6):** The Sandon, The Townley, Mary D's, Grove Inn, The Corner Shop e Café Vianna,
  todas confirmadas a olho.
- **Recusadas (2):** «The Albert» deu uma foto das docas Albert Dock e «The Park» deu o Stanley Park.

Desde então, uma foto sem coordenadas só conta se o título começar pelo nome do tasco. O Commons só tem fotos de sítios conhecidos (por exemplo The Arkles, em Anfield).
As tascas portuguesas quase nunca lá estão e ficam com o ícone até haver foto.

**Porque não usamos já as fotos e as estrelas do Google.** As fotos e a nota do Google (Places API)
obrigam a:
- uma conta de faturação no Google Cloud, com cartão;
- chamadas a partir de uma Edge Function;
- respeitar os termos, que não deixam guardar a nota nem as fotos: têm de ser pedidas de novo, dentro
  do limite gratuito mensal, e mostradas com a marca do Google.

Isto contraria o «sem custos» desta primeira versão, e a decisão fica para o dono. Até lá, as notas
são as dos adeptos (Cervejómetro e Petiscómetro).

Duas alternativas gratuitas ficam por decidir:
- fotos de rua do Mapillary (licença CC BY-SA), que precisam de uma chave gratuita de conta;
- as fotos que os adeptos já podem enviar (`place_photo`), que precisam de um ecrã de moderação.

**Mapa no separador Locais.** Quem só quer ver o que há à volta do estádio escolhe o clube e vê logo
o mapa, já aproximado ao estádio, com os tascos, os WC e os cartões para deslizar. A lista longa
continua disponível no botão «Ver em lista».

## 2026-09-16 — Cartões pequenos nos mapas, WC do tasco e tascos de dia de jogo

**Cartões nos mapas.** O cartão do tasco tapava quase todo o mapa. Os dois mapas (o do estádio e o de
escolher o tasco em «O meu jogo») têm agora uma fila de cartões pequenos em baixo
(`CarrosselLocais`). Desliza-se com o dedo, os cartões do lado espreitam e o mapa acompanha. Tocar
num ponto leva a fila até ao cartão desse tasco. Cada cartão mostra, antes de escolher:
- o tipo e os minutos a pé;
- o Cervejómetro e o Petiscómetro;
- se o tasco é referido por adeptos e se é sítio de adeptos da casa.

No mapa de escolha, o cartão tem «Escolher» e «Ver tasco». As setas grandes saíram dos mapas e ficam
só no cabeçalho da página do tasco.

**WC do tasco.** O OpenStreetMap quase nunca diz se um café tem WC: nenhum dos 202 à volta da Luz o
indica. Por isso a pergunta «Tem WC para clientes?» é respondida pelos adeptos
(`place_toilet_answer`: uma resposta por pessoa por tasco, que se pode mudar). A contagem fica em
`place.toilet_yes` e `place.toilet_no` e a app mostra quantos disseram o quê. Por baixo continua o
WC público mais próximo.

**Sem restaurantes de centros comerciais** (`npm run db:centros-comerciais`). As praças de
alimentação não são sítio de dia de jogo. Os locais sugeridos dentro de um centro comercial
(`shop=mall` no OSM) ficam rejeitados com `rejection_reason = 'shopping_centre'`: desaparecem para
todos e uma nova importação não os traz de volta. Só contam centros com mais de 8000 m². Em Portugal
«Centro Comercial» também dá nome a galerias antigas de rua, e os cafés virados para a rua dessas
galerias são tascos a sério. Os WC públicos dentro dos centros comerciais ficam, porque são úteis.

Na primeira passagem (2026-09-16) o OSM tinha 360 sítios de comer e beber dentro de centros
comerciais perto dos estádios. Destes, 60 estavam na app e ficaram escondidos: 21 na Luz (Colombo e
Fonte Nova), 19 no Leça (MarShopping), 8 em Coimbra, 5 em Viana do Castelo, 2 no Dragão (Alameda) e
alguns lá fora.

**Associações da pesquisa confirmadas à mão.** A primeira versão da importação juntou mal dois
tascos:
- o Bago de Arroz a um homónimo a 2,25 km;
- o Restaurante Alameda à Farmácia Alameda.

Por isso a procura por nome ficou limitada a sítios de comer e beber a menos de 1,5 km, a morada só
conta ao nível do edifício (nunca da rua) e cada associação ao OSM é confirmada nas etiquetas antes
de ser aplicada.

**Tascos de dia de jogo pesquisados.** Pesquisámos na web (jornais, fóruns e Reddit, guias de
estádios, blogues de groundhopping) onde os adeptos vão antes do jogo, nos 38 estádios com jogos
visíveis. Um tasco só entra com uma fonte aberta que o ligue ao dia de jogo. Fica com:
- `matchday_note`: uma frase com a razão;
- `matchday_sources`: as páginas, que a app mostra com ligação;
- `home_fans_heavy`: quando as fontes dizem que é sítio de adeptos da casa.

Uma restrição não deixa haver razão sem fontes. Estes tascos aparecem primeiro. Onde não se encontrou
nada, ficam os do OpenStreetMap.

## 2026-09-16 — Pratos honestos, WC reais e fotografias dos estádios

**Pratos: não inventamos.** Tirámos a sugestão «Costuma haver» (bifana, tosta mista…) por tipo de
casa. Não correspondia à realidade: a H3 num centro comercial não tem nenhum desses pratos. Um tasco
sem menu conhecido mostra agora «Ainda não sabemos o que há aqui» e pede aos adeptos que sugiram um
prato com o preço. Só aparecem pratos de menus publicados (com fonte e data) ou sugeridos por
adeptos.

**Erros das Edge Functions.** O `supabase-js` lança um erro quando a resposta não é 2xx. No React
Native, o `instanceof FunctionsHttpError` / `Response` nem sempre funciona, e por isso um «demasiado
longe» aparecia como «verifica a ligação». `src/lib/erros-funcoes.ts` lê o corpo do erro sem
`instanceof` e é usado nas funções de caminho a pé, check-in e pontos de encontro.

**Escolher o tasco num mapa.** Em «O meu jogo», o tasco escolhe-se num mapa como o do estádio
(`MapaEscolherTasco`), com o cartão a deslizar entre tascos. No mapa do jogo, o cartão do tasco
selecionado também desliza para o seguinte e o mapa acompanha.

**WC reais** (`restroom`, `npm run db:wc`). Importámos do OpenStreetMap as casas de banho públicas
(`amenity=toilets`) a menos de 1,2 km de cada estádio, sem as privadas. Cada WC fica associado ao
estádio mais próximo. O que o OSM não diz (preço, acesso adaptado, horário) aparece como
«por confirmar» e nunca é adivinhado. Os WC dentro dos estádios quase nunca estão no OSM, e há
estádios sem nenhum WC registado: nesses casos a app diz isso e lembra que os cafés costumam deixar
usar a quem consome. O modo demo continua com os WC de exemplo.

Na primeira importação (2026-09-16) ficaram 412 WC em 60 dos 80 estádios. O preço é conhecido em
227, o acesso adaptado em 187 e o horário só em 36. Os outros 20 estádios, entre eles Anfield e
De Kuip, não têm nenhum WC no OSM (confirmado diretamente no Overpass) e mostram o estado vazio.

**Fotografias dos estádios** (`npm run db:fotos`). A imagem principal (P18) do item da Wikidata que
é mesmo um estádio, e só com licença livre do Wikimedia Commons (CC BY, CC BY-SA, CC0 ou domínio
público). As fotos ficam no bucket público `venue-photos` (JPEG com 1280 px, até 2 MB), para não
dependermos do Commons em cada abertura. O autor, a licença e a ligação à origem ficam no `venue`
(há uma restrição que não deixa haver foto sem crédito) e aparecem sobre a foto, como a licença
exige. Os estádios sem foto livre mantêm a capa com as cores do clube.

**Confirmar que a foto é do estádio certo.** A pesquisa por nome enganou-se em estádios com nomes
repetidos:
- «Allianz Stadium» deu o de Sydney, e não o de Turim;
- «Raiffeisen Arena» deu o Waldstadion de Pasching;
- «Campo da Mata» deu o emblema de um clube de Caranguejeira.

Tirámos essas fotos. Agora um resultado só conta se as coordenadas da Wikidata (P625) ficarem a menos
de 3 km do nosso estádio. Os que a pesquisa não acerta ficam com o item fixado em `KNOWN_ITEMS`.
Todas as fotos aplicadas foram verificadas por distância e as que não tinham coordenadas, a olho.

## 2026-09-16 — Fatia 2: «O meu jogo»

**O quê.** Marcar «Vou a este jogo» abre um ecrã só desse jogo (`/jogos/o-meu-jogo`). Chega-se lá pelo
botão do jogo, pelo cartão «O teu próximo jogo» no topo da lista de Jogos ou tocando num aviso. O ecrã
mostra:
- a contagem decrescente, ou «hora por definir»;
- o tasco escolhido num mapa (pela mesma ordem da lista de Locais), com «Ver o tasco» e
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
