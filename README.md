# AwayDay

App móvel para adeptos em dia de jogo: próximos jogos, como chegar ao estádio, tascos à volta,
check-ins e um passaporte de estádios.

> **Estado: demo navegável.** Jogos, estádios, clubes e competições vêm do Supabase, com conta opcional (email e password),
> com cache local para a app abrir já com dados e funcionar sem rede. Tudo o resto continua em `src/mocks/` e o
> estado vive em memória: ao recarregar a app, volta ao início.

## Funcionalidades

**Onboarding**
- Quatro ecrãs antes das tabs: clube que apoias, clube da terra (sugestão pela localização simulada, sempre com confirmação e opção de saltar), permissões de localização e notificações (simuladas, nada é pedido ao sistema) e, no fim, criar conta, entrar ou continuar sem conta.
- Como o estado vive em memória, aparece em cada arranque da app. Pode ser revisto em Perfil → Definições → Rever a introdução.

**Jogos**
- Próximos jogos agrupados por dia (hora de Lisboa), com filtros por competição e pelo teu clube.
- Liga Portugal Betclic, Liga 2, Liga 3, taças e competições europeias.
- Estados "a decorrer" e "terminado", com carregamento e vazios simulados.

**Ficha do jogo**
- "Vou a este jogo" (com conta), para as dicas do dia de jogo.
- Relógio do dia de jogo, fixo no topo e só no próprio dia (até 3 h depois do apito final): contagem decrescente e uma sugestão por fase — tasco para almoçar, check-in onde há mais gente, hora de sair a pé com aviso de meteorologia, bloco discreto durante o jogo e, no fim, avaliação e último transporte de regresso.
- Estádio com cobertura, sombra e abrigo, e aviso quando há chuva prevista e a cobertura não é total.
- WC mais próximo do estádio, com distância a pé, horário, preço, acessibilidade e tipo de acesso.
- Mapa da cidade com o escudo do clube da casa; ao tocar no escudo, faz zoom e mostra os tascos e os WC à volta.
- Meteorologia simulada, distância e tempo de carro a partir de uma localização simulada, e três opções de transporte.
- Ponto de encontro oficial para visitantes nos jogos europeus.
- Avaliação da visita (estádio, ambiente, acessos) a partir do fim do jogo.
- Barulhómetro no dia do jogo: com o jogo a decorrer e check-in feito perto do estádio, ouve a bancada durante 10 segundos e dá um nível de 0 a 100 numa escala genérica (de "Biblioteca" a "Estádio a ferver"), com um ranking de adeptos. Uma medição a cada 5 minutos.

**Locais**
- Tascos a menos de 20 minutos a pé do estádio, ordenados por distância.
- Cervejómetro, petiscómetro, contador de pessoas, check-in e a tua nota ao tasco.
- Menu com recomendações dos adeptos e três destaques: mais recomendado, mais barato e mais rápido, com um lembrete de água ou de algo quente conforme a meteorologia do próximo jogo.
- WC mais próximo do tasco.

**Perfil**
- Retrospetiva da época em junho: jogos, estádios novos, quilómetros, tasco onde mais voltaste, nota média e distrito mais visitado, com botão para partilhar.
- Dica ao abrir a app, no topo dos Jogos: uma mensagem por contexto (dia de jogo por fase, check-in ativo, marco do passaporte, estádio novo nos próximos 7 dias). Sem contexto, a app fica calada. As dicas ficam também nas Novidades, e há um push diário só quando há contexto (no iOS). Ligam-se e desligam-se em Perfil → Notificações.
- Conta opcional: criar conta com código de confirmação por email, entrar, recuperar password, terminar sessão e apagar conta. Com conta, o clube que apoias e o clube da terra ficam guardados e vêm contigo para outro telemóvel.
- Clube que apoias e clube da terra (a sugestão pela localização exige sempre confirmação).
- Passaporte de estádios com missões e distintivos. Cada missão fecha com uma foto tirada na hora, só com a câmara; cumprida mas sem foto, fica "por comprovar".
- Álbum de recordações com as fotos das missões: distintivo, estádio, data e se a foto está verificada (tirada em dia de jogo, com check-in perto do estádio).
- Histórico de avaliações editáveis e de tascos verificados, e ranking.
- Definições de sons (desligados por omissão) e de notificações (só interface, nada é enviado).

## Stack

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) com React Native 0.86 e React 19.2
- TypeScript em modo strict, sem `any`
- Expo Router com tabs nativas
- Supabase (Postgres + PostGIS) com TanStack Query e cache persistida em AsyncStorage
- `react-native-maps`, `react-native-reanimated`, `expo-audio` (sons e barulhómetro) e `expo-image-picker` (fotos das missões)

## Requisitos

- Node 24: a versão está fixada em [`mise.toml`](mise.toml); com o [mise](https://mise.jdx.dev) instalado, basta `mise install`.
- npm
- No telemóvel, a app [Expo Go](https://expo.dev/go) compatível com o SDK 57. No iOS, é preciso ter sessão iniciada com a mesma conta Expo no terminal (`npx expo login`) e no Expo Go.
- Opcional: Xcode para o simulador iOS.

## Como correr

```bash
mise install
npm install
npx expo start
```

Lê o QR code com a câmara (iOS) ou com o Expo Go (Android). O telemóvel tem de estar na mesma rede que o computador.

## Supabase

A app lê jogos, estádios, clubes e competições de um projeto Supabase. Sem as variáveis de ambiente, usa o catálogo
embutido na app.

1. Copia `.env.example` para `.env.local` e preenche `EXPO_PUBLIC_SUPABASE_URL` e
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Só a chave publicável: nunca a `service_role` nem a password da base de dados.
2. Com a [CLI do Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started):

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push --include-seed        # aplica as migrações e o seed
supabase gen types typescript --linked > src/lib/database.types.ts
```

- As tabelas `competition`, `venue`, `club` e `fixture` têm RLS: leitura pública e nenhuma escrita a partir da app.
- O seed (`supabase/seed/`) é gerado a partir de `src/features/fixtures/snapshot.ts` com `npm run db:seed` e faz
  upsert, por isso pode correr outra vez. Num projeto que já tem o seed, o `db push --include-seed` não volta a
  correr ficheiros alterados: aplica-os com `supabase db query --linked -f supabase/seed/<ficheiro>.sql`.
- Para mudar o esquema, cria uma migração nova (`supabase migration new <nome>`), nunca edites uma já aplicada, e
  volta a gerar os tipos.
- **Autenticação:** as regras (password, código de 8 algarismos válido 15 minutos, reautenticação para mudar a password) estão no `config.toml` e vão com `supabase config push`. Corre antes `supabase config diff` e confirma que só muda o que queres.
- **Emails (SMTP):** o Supabase só envia emails próprios com SMTP próprio. Os emails saem pelo Brevo; põe as credenciais em `supabase/.env` (fora do git): `SMTP_USER` (login SMTP do Brevo), `SMTP_PASS` (chave SMTP, começa por `xsmtpsib-`) e `SMTP_ADMIN_EMAIL` (remetente verificado). No Brevo, desliga o bloqueio de IPs desconhecidos, porque o Supabase envia de IPs que mudam.
- **Apagar conta:** Edge Function `delete-account`, publicada com `supabase functions deploy delete-account --use-api`. A app pede a password outra vez e a função só aceita sessões que entraram há menos de 10 minutos.
- **Dica ao abrir a app:** Edge Function `coach-message`, chamada pela app com a sessão da pessoa. Não precisa de segredos. No máximo 12 mensagens novas por pessoa por hora (`take_rate_limit`).
- **Perfis fictícios para testar mensagens e retrospetiva:** `supabase/seed-dev/perfis-ficticios.sql` (só para desenvolvimento; os comandos para os apagar estão no topo do ficheiro).
- **Push diário das dicas:** Edge Function `generate-nudges`, chamada de hora a hora pelo `pg_cron` (só envia às 10:00). Precisa do segredo `CRON_SECRET` na função (`supabase secrets set`) e dos segredos `project_url` e `cron_secret` no Vault, com o mesmo valor. As frases saem de modelos de frase; para usar o Claude, define `ANTHROPIC_API_KEY` e `AI_MONTHLY_BUDGET_USD` na função (tem custos).
- **Retrospetiva da época:** Edge Function `generate-season-recaps`, chamada pelo `pg_cron` de 15 a 20 de junho, com o mesmo segredo das dicas. Para usar o Claude, as mesmas variáveis (tem custos).
- **Edge Functions novas:** todas têm `verify_jwt = false`, por isso cada uma verifica quem chama antes de tocar em dados, com `authenticatedCaller` (chamadas da app) ou `hasCronSecret` (chamadas do `pg_cron`), de `supabase/functions/_shared/auth.ts`.
- As decisões desta ligação estão em [`docs/DECISOES.md`](docs/DECISOES.md).

## Modo demo

A hora da app é injetável, para testar todas as fases do relógio do dia de jogo sem esperar por um jogo.

- **No Perfil:** toca 5 vezes seguidas no cartão do perfil para abrir a secção "Modo demo". Escolhe o jogo e a fase; "Hora real" volta ao normal. Enquanto a hora estiver simulada, aparece a etiqueta "Hora simulada".
- **Por deep link:** acrescenta `?demoFase=<fase>&jogo=<id>` a qualquer rota. Fases: `almoco`, `check-in`, `a-caminho`, `a-decorrer`, `depois` ou `real`. Este link também salta o onboarding. Só funciona em desenvolvimento ou em builds com `EXPO_PUBLIC_DEMO_MODE=true`, porque qualquer página pode abrir um deep link. Exemplo no Expo Go:

  ```
  exp://<ip-do-computador>:8081/--/jogos/benfica-moreirense?demoFase=depois
  ```
- **Barulhómetro:** simula a fase `a-decorrer` e faz check-in num tasco perto do estádio desse jogo para desbloquear a medição.

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Arranca o servidor de desenvolvimento |
| `npm run ios` | Arranca e abre o simulador iOS |
| `npm run android` | Arranca e abre o emulador Android |
| `npm run web` | Arranca a versão web (sem mapa) |
| `npm run lint` | Corre o ESLint |
| `npm run db:seed` | Gera o seed SQL a partir do catálogo embutido |
| `npx tsc --noEmit` | Verifica os tipos |

## Estrutura

```
src/
  app/          Ecrãs e navegação (Expo Router): jogos/, locais/, perfil/
  components/   Componentes da app (cartões, mapa, passaporte, formulários)
  ui/           Componentes base (texto, cartões, botões, chips, estados vazios)
  features/     Feature slices; fixtures/ lê jogos, estádios e clubes do Supabase (api, hooks, store, snapshot)
  mocks/        Dados tipados que ainda não estão na base de dados: locais, avaliações, pontos de encontro, extras
  lib/          Funções puras (datas, formatos, distâncias, meteorologia), cliente Supabase, cache e tipos gerados
  state/        Estado em memória (React Context) e sons
  hooks/        Hooks partilhados
assets/
  sounds/       Sons curtos de check-in e carimbo (placeholders)
supabase/
  migrations/   SQL versionado (esquema e RLS)
  seed/         Dados iniciais gerados (npm run db:seed)
  functions/    Edge Functions (delete-account)
  templates/    Emails de confirmação e recuperação, em português
scripts/        Gerador do seed
docs/           DECISOES.md: registo de decisões estruturais
```

## Sobre os dados

- **Clubes e estádios** são reais e vêm do Supabase. Capacidades, coordenadas e moradas foram conferidas a 14/09/2026 contra a Liga Portugal, os clubes e o OpenStreetMap; o que ficou por confirmar está em `docs/DECISOES.md`. A Liga 2 e a Liga 3 têm uma seleção ilustrativa de clubes. As horas dos jogos são fixas (geradas a 13/09/2026).
- **Tascos e bares são fictícios**, para não atribuir notas nem contadores inventados a negócios reais. Os pratos, as recomendações e os adeptos presentes em cada tasco também são mock.
- **Casas de banho** são mock: posições, preços e horários servem só a demo.
- **Missões** nunca pedem para trocar objetos pessoais nem contacto físico. Na foto com um adepto rival, a app lembra que é preciso pedir autorização antes de abrir a câmara. As duas recordações que a demo já traz são ilustrações, sem ficheiro de imagem.
- **Barulhómetro:** o som do microfone é analisado em memória e deitado fora; não se cria ficheiro de áudio e só fica o número. Os outros adeptos do ranking são fictícios.
- **Meteorologia, distâncias, tempos e preços** são simulados.
- **Pontos de encontro dos jogos europeus** usam informação real, publicada pelos clubes para jogos já disputados, e indicam sempre a fonte e o jogo original:
  - [FC Porto em Roma](https://www.fcporto.pt/pt/noticias/20250219-pt-informacoes-aos-adeptos-que-vao-a-roma-apoiar-o-fc-porto) (Liga Europa, fev. 2025)
  - [SL Benfica em Turim](https://www.slbenfica.pt/pt-pt/agora/noticias/2025/01/29/futebol-benfica-informacoes-adeptos-jogo-juventus-8-jornada-fase-de-liga-liga-dos-campeoes) (Liga dos Campeões, jan. 2025)
  - [FC Porto em Salzburgo](https://www.fcporto.pt/pt/noticias/20250924-pt-informacoes-aos-adeptos-que-vao-a-salzburgo-apoiar-o-fc-porto) (Liga Europa, set. 2025)
- Os escudos são gerados com as cores e a sigla de cada clube; não são os oficiais.

## Limitações conhecidas

- O fundo do mapa vem do Apple Maps (iOS) ou Google Maps (Android) e precisa de internet; os pontos são todos da demo.
- Uma build de produção para Android vai precisar de uma chave da Google Maps. No Expo Go não é preciso.
- Na web, o mapa é substituído por um aviso.
- Os sons são placeholders e as notificações são só interface.
- O simulador iOS não tem câmara: aí as missões podem fechar com uma foto de exemplo, que nunca fica verificada.
- O microfone do telemóvel não dá decibéis calibrados, por isso o barulhómetro usa uma escala relativa. As regras contra batota (micro saturado, som aos solavancos, check-in obrigatório, espera entre medições) são heurísticas a afinar com medições reais em estádio. No futuro, um servidor pode comparar cada medição com as de outros adeptos no mesmo estádio e ao mesmo minuto.
- A presença no estádio conta pelo check-in num tasco perto: a demo não usa localização real.
- As fotos e as medições vivem em memória, como o resto do estado.
- Os dados que chegam do Supabase em fundo ficam guardados na cache e só aparecem no arranque seguinte da app.
