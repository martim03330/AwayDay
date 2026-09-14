# Decisões

Registo das decisões estruturais, com data e razão. A mais recente fica em cima.

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
