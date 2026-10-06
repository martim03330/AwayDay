# Testes de ponta a ponta (Maestro)

Percursos completos no simulador de iOS, com a app a correr no Expo Go. Um ficheiro por percurso; os pedaços
repetidos (abrir um ecrã, voltar às boas-vindas, entrar com a conta de testes) estão em `comum/`.

**Correr tudo:** `maestro test .maestro` (ou `npm run test:e2e`), com o ambiente da conta de testes carregado:

```bash
set -a; . .maestro/env; set +a      # MAESTRO_E2E_EMAIL e MAESTRO_E2E_PASSWORD (o Maestro lê as variáveis MAESTRO_*)
npm run test:e2e
```

## Antes de correr

1. **Maestro** (`curl -Ls "https://get.maestro.mobile.dev" | bash`). Precisa de Java 17 ou mais recente: se o Java do
   sistema for mais antigo, aponta `JAVA_HOME` para um JDK 17 (por exemplo `export JAVA_HOME=~/.maestro/jdk/jdk-17…/Contents/Home`).
2. **Simulador** «iPhone 17 Pro» ligado, com o Expo Go instalado:
   `xcrun simctl boot FAAC2997-09B5-4EE7-B104-5132D7816277; open -a Simulator`.
3. **Metro** a servir a app em `exp://127.0.0.1:8081` (`npx expo start --go`; confirma em http://localhost:8081/status).
4. **Conta de testes** criada de fresco na base de dados de desenvolvimento (apaga e recria `e2e@teste.awayday.invalid`;
   o percurso 06a precisa de uma conta sem clube guardado):

   ```bash
   set -a; . .maestro/env; set +a
   sed "s/'__E2E_PASSWORD__'/'$MAESTRO_E2E_PASSWORD'/" scripts/dados-de-teste/e2e-conta.sql > /tmp/e2e-conta.sql
   supabase db query --linked -f /tmp/e2e-conta.sql; rm /tmp/e2e-conta.sql
   ```

   No fim, para apagar a conta e o que os testes criaram (grupos, convites): 
   `supabase db query --linked -f scripts/dados-de-teste/e2e-apagar.sql`.

`.maestro/env` não vai para o git. Se não existir, cria-o com
`MAESTRO_E2E_EMAIL=e2e@teste.awayday.invalid` e `MAESTRO_E2E_PASSWORD=<uma password com letras e números>`.

Um percurso só: `maestro test .maestro/05-modo-demo.yaml`. Só os sem conta: `maestro test --include-tags sem-conta .maestro`.
Capturas e registos de cada corrida: `maestro test --test-output-dir <pasta> .maestro`.

## Os percursos

| Ficheiro | Quem | O que verifica |
| --- | --- | --- |
| 01-primeira-abertura | sem conta | boas-vindas → «Espreitar sem conta» → clube → avisos («Agora não» e «Ligar avisos») → tabs |
| 02-navegar-sem-conta | sem conta | todas as tabs, filtros, o jogo, boleias e «Combinar» a pedir conta, estádio sem meteorologia inventada, chegar, mapa |
| 03a-legal-boas-vindas | sem conta | «Termos» e «Privacidade» das boas-vindas abrem os documentos |
| 03b-legal-definicoes | sem conta | Definições → Sobre o AwayDay: privacidade, termos, sobre e contactos; documento inexistente |
| 04-formularios-conta | sem conta | criar conta e entrar: erros de cada campo, consentimento, mostrar password, sem submeter |
| 05-modo-demo | sem conta | cinco toques no perfil, etiqueta «Modo demo · dados de exemplo» em todas as tabs, hora simulada |
| 06a-entrar-boas-vindas | conta | password errada, depois a certa: o modal fecha e seguem os passos do perfil |
| 06b-introducao-com-conta | conta | os cinco passos da introdução com conta e o perfil com sessão |
| 07-perfil-editar | conta | nome, distrito → concelho, como vai à bola; fica guardado |
| 08-malta-criar-grupo | conta | criar grupo (nome obrigatório), escrever na conversa, grupo na lista |
| 09-combinar-jogo | conta | convidar o grupo para um jogo; segundo convite → aviso «Calma, que este jogo já está convocado» |
| 10-ranking-missoes | conta | Ranking, missões, tabelas, «Quem vai à bola» |
| 11-definicoes-com-conta | conta | partilha do tasco (desligada por omissão), bloqueados, notificações |
| 12-apagar-conta-sem-confirmar | conta | o ecrã de apagar conta, sem password não apaga, fechar mantém a sessão |
| 13-terminar-sessao | conta | terminar sessão; Malta e Ranking voltam a pedir conta |

Notas:
- O estado do Expo Go (introdução vista, clube, modo demo) não se limpa a partir do Maestro: cada percurso parte de um
  ponto conhecido pelos ecrãs da própria app (`comum/boas-vindas.yaml`, `comum/entrar-e2e.yaml`).
- No simulador, o campo «nova password» do criar conta é ocupado pela sugestão de password forte do iOS e o texto não
  entra; por isso o percurso 04 não escreve password. As regras da password estão nos testes de `validation.ts`.
- Os `testID` usados: `interruptor-modo-demo`, `interruptor-partilhar-checkins`, `interruptor-<título>` (notificações) e
  `caixa-consentimento`.
