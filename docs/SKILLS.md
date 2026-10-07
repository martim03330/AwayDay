# Skills para desenvolvimento

A base de skills do AwayDay: o que está instalado, quando usar cada uma e um exemplo de pedido. Uma skill é um
conjunto de instruções que o Claude Code carrega quando o trabalho combina com a descrição dela; também se pode chamar
pelo nome («usa a skill X») ou escrevendo `/` na conversa.

**Onde estão:** todas na conta do utilizador (`~/.claude/skills/` e plugins em `~/.claude/plugins/`), por isso
servem em todos os projetos. Aparecem a partir de uma **sessão nova**.

**Manter:** `npx skills update` atualiza as skills instaladas com o `skills`; `claude plugin update superpowers`
atualiza o plugin. Remover: `npx skills remove <nome>` ou `claude plugin uninstall <plugin>`.

Instaladas a 2026-10-07.

## O fluxo recomendado para uma funcionalidade nova

Combina as regras do `CLAUDE.md` (plano antes de código, migração → tipos → api → hooks → UI) com o superpowers:

1. **`brainstorming`** — perceber o que se quer e desenhar a solução, por partes, para aprovares.
2. **`writing-plans`** — o plano passo a passo (é o «propõe um plano e espera aprovação» do projeto).
3. **`supabase-postgres-best-practices`** — antes de escrever a migração e as políticas RLS.
4. **`test-driven-development`** + **`vitest`** — testes primeiro, sobretudo em dinheiro, custo da boleia e acerto de contas.
5. **`subagent-driven-development`** ou **`executing-plans`** — executar o plano.
6. **`verification-before-completion`** — correr typecheck, lint e testes antes de dizer que está feito.
7. **`requesting-code-review`** / **`/code-review`** — rever antes de juntar.
8. **`finishing-a-development-branch`** — decidir como integrar (merge, PR).

Exemplo: «Quero os avisos de meteorologia. Usa o superpowers: brainstorming e plano primeiro.»

## Por área

### Planear e organizar o trabalho (superpowers)

| Skill | Quando | Exemplo para o AwayDay |
|---|---|---|
| `brainstorming` | Antes de qualquer funcionalidade ou mudança de comportamento | «Vamos desenhar a retrospetiva da época.» |
| `writing-plans` | Há requisitos e o trabalho tem vários passos | «Escreve o plano para ir buscar a previsão do tempo a uma API no servidor.» |
| `executing-plans` | Executar um plano nesta sessão, passo a passo | «Executa o plano aprovado.» |
| `subagent-driven-development` | Plano com tarefas independentes, cada uma por um subagente revisto | «Implementa as tarefas 1 a 4 com subagentes.» |
| `dispatching-parallel-agents` | Duas ou mais tarefas sem dependências entre si | «Corrige estes três bugs em paralelo.» |
| `using-git-worktrees` | Trabalho isolado sem mexer na pasta principal | «Faz isto num worktree à parte.» |
| `finishing-a-development-branch` | Tudo pronto e testado, falta integrar | «Terminámos o ranking: como juntamos ao main?» |
| `diagnosing-superpowers` | Uma sessão correu mal (repetiu trabalho, ignorou o plano) | «Porque é que isto demorou tanto?» |

### Qualidade, testes e bugs

| Skill | Quando | Exemplo |
|---|---|---|
| `test-driven-development` (superpowers) | Qualquer funcionalidade ou correção, antes do código | «Muda o arredondamento do custo da boleia com TDD.» |
| `vitest` | Escrever testes, mocks, cobertura, filtros | «Testa os casos limite de `money.ts` com Vitest.» |
| `systematic-debugging` (superpowers) | Bug, teste a falhar ou comportamento estranho, antes de propor a correção | «A conversa do grupo duplica mensagens: investiga.» |
| `verification-before-completion` (superpowers) | Antes de dizer «está feito», fazer commit ou PR | (automática) |
| `requesting-code-review` / `receiving-code-review` | Pedir revisão; avaliar sugestões com rigor antes de as aplicar | «Revê o que fiz hoje.» |
| `/code-review` (incluída) | Revisão do diff atual à procura de bugs | `/code-review` |
| `/security-review` (incluída) | Revisão de segurança das alterações do ramo | `/security-review` antes de cada versão |
| `/simplify` (incluída) | Limpar e simplificar o código alterado | `/simplify` |

### Base de dados e servidor (Supabase)

| Skill | Quando | Exemplo |
|---|---|---|
| `supabase-postgres-best-practices` | **Antes** de qualquer tabela, coluna, migração, índice, RLS, trigger ou função; consultas lentas | «Cria a tabela da previsão do tempo com RLS.» |
| `supabase` | Qualquer tarefa Supabase: Auth, Edge Functions, Realtime, Storage, CLI, erros, logs | «A Edge Function `rides` dá 500: vê os logs.» |

Lembrar as regras do projeto: RLS na mesma migração, nada de `service_role` no cliente, localização individual nunca
exposta, valores calculados só no servidor.

### App (Expo e React Native)

| Skill | Quando | Exemplo |
|---|---|---|
| `vercel-react-native-skills` | Componentes, listas, animações, desempenho, módulos nativos | «A lista de jogos está lenta a deslizar.» |
| `expo-router` | Rotas, separadores, modais, cabeçalhos, ligações | «Põe a sessão da viagem como folha modal.» |
| `expo-dev-client` | Deixar o Expo Go e passar a uma app de desenvolvimento própria | «Cria um dev client para testar as notificações.» |
| `expo-upgrade` | Subir de versão do SDK ou corrigir dependências | «Atualiza para o SDK 58.» |
| `eas-update` | Atualizações por OTA (sem nova versão na loja) | «Configura o EAS Update para corrigir textos sem passar pela Apple.» |
| `eas-app-stores` | Compilar e submeter, eas.json, assinaturas, versões, TestFlight, Google Play | «Envia a versão 1.0.1 para o TestFlight.» |

Antes de escrever código Expo, ler também a documentação da versão em uso (ver `AGENTS.md`).

### Design e interface

| Skill | Quando | Exemplo |
|---|---|---|
| `frontend-design` | Desenhar ou refazer um ecrã com direção visual própria | «Redesenha o ecrã do passaporte.» |
| `ui-ux-pro-max` | Rever ou desenhar UI: paletas, tipografia, acessibilidade, padrões de UX | «Revê o contraste e a hierarquia do ecrã de boleias.» |
| `design-system` | Tokens, especificações de componentes | «Organiza as cores e espaçamentos em tokens.» |
| `design`, `brand`, `banner-design` | Logótipo, identidade, banners para redes | «Faz um banner para o lançamento.» |
| `ui-styling` | Componentes web (shadcn/Tailwind); pouco útil numa app React Native | — |

### Encontrar e melhorar skills

| Skill | Quando | Exemplo |
|---|---|---|
| `find-skills` | Procurar uma skill para uma tarefa | «Procura uma skill para testes com Maestro.» |
| `task-observer` | Observar as sessões e propor melhorias às skills (precisa de ativação, ver abaixo) | «Revê as observações da semana.» |
| `writing-skills` (superpowers) | Criar ou editar uma skill própria | «Cria uma skill com as regras de dinheiro do AwayDay.» |

## Por ativar ou instalar (precisam de ti)

- **`task-observer`** — está instalado, mas só funciona com o bloco de ativação no `CLAUDE.md` (o do projeto ou o
  pessoal `~/.claude/CLAUDE.md`). O texto está em `~/.claude/skills/task-observer/references/environments.md`,
  secção «The activation block». Junta também `skill-observations/` ao `.gitignore`. Custa contexto em todas as
  sessões.
- **`impeccable`** — design para agentes; instala hooks, por isso corre-se no terminal:
  `npx impeccable install --providers=claude --scope=project`, e depois `/impeccable init`.
- **`claude-mem`** — memória entre sessões; instala hooks e um serviço em segundo plano. Por omissão guarda as
  sessões na nuvem deles; para ficar tudo no Mac: `CLAUDE_MEM_ONLINE_OPTIN=false npx claude-mem install --provider host`.

## Candidatas para mais tarde

Encontradas com o `find-skills` (instalações à data da pesquisa). Verificar a fonte antes de instalar.

| Skill | Para quê | Instalar |
|---|---|---|
| `expo/skills@eas-workflows` | Compilar e submeter automaticamente (CI/CD) | `npx skills add expo/skills@eas-workflows -g -y` |
| `expo/skills@expo-native-ui` (25,7K) | Componentes nativos e Liquid Glass | `npx skills add expo/skills@expo-native-ui -g -y` |
| `expo/skills@eas-observe` | Falhas e desempenho em produção | `npx skills add expo/skills@eas-observe -g -y` |
| `addyosmani/web-quality-skills@accessibility` (59K) | Acessibilidade | `npx skills add addyosmani/web-quality-skills@accessibility -g -y` |
| `wshobson/agents@typescript-advanced-types` (84K) | Tipos avançados em TypeScript | `npx skills add wshobson/agents@typescript-advanced-types -g -y` |

Para testes com Maestro não há nenhuma skill com fonte e número de instalações que inspirem confiança; o
`.maestro/LEIA-ME.md` do projeto continua a ser a referência.
