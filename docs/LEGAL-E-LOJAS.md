# Legal e lojas: o que está feito, o que falta e os riscos

Estado a 9 de outubro de 2026. Este documento não é aconselhamento jurídico. Os textos legais (`src/lib/legal.ts`)
descrevem o que a app faz de facto, mas devem ser revistos por um jurista antes da publicação.

## Feito

| Tema | O quê | Onde |
|---|---|---|
| Política de privacidade | Dados, finalidades, bases legais, fornecedores, transferências, prazos, direitos, CNPD, idade | `src/lib/legal.ts`, ecrã `/legal/privacidade` |
| Termos de utilização | Serviço, idade, boleias só com partilha de custos, sem pagamentos, conduta, moderação, responsabilidade, lei aplicável | `/legal/termos` |
| Sobre e contactos | Identificação do responsável (DL 7/2004, art. 10.º), sem ligação oficial a clubes/Liga/FPF/PSP, créditos de dados e imagens | `/legal/sobre` |
| Páginas públicas | Os mesmos textos em HTML, para os links da App Store e do Google Play | `npm run legal:paginas` → `docs/legal/*.html` |
| Consentimento ao criar conta | Caixa obrigatória, nunca pré-marcada: 18+ e aceitar termos e privacidade; versão e data guardadas na conta | `src/components/consentimento-termos.tsx` |
| IA de terceiros | Dicas e retrospetiva desligadas por omissão; pedido explícito com o que é enviado e para quem (Apple 5.1.2(i)) | migração `ai_tips_opt_in`, `src/components/convite-treinador.tsx` |
| Dados inventados | Tirados ou limitados ao modo demo: adeptos por clube, sombra/abrigo/transportes/meteorologia dos estádios, «DGEG» no combustível, «confirmado por adeptos», «houve incidentes», «mais recomendado» com 0, avisos prometidos que não existem | ver `docs/DECISOES.md` |
| Modo demo | Etiqueta permanente «Modo demo · dados de exemplo» | `src/app/(tabs)/_layout.tsx` |
| Conteúdo de utilizadores | Denunciar e bloquear, fila de denúncias para o administrador | migração `report_and_block` |
| Apagar conta | Dentro da app, e uma página pública que explica como apagar (na app ou por email) e o que fica — o Google Play pede este link | `src/app/conta/apagar-conta.tsx`, `docs/legal/apagar-conta.html` |
| Fornecedores e fontes (9 out.) | Brevo (emails com códigos) nos fornecedores; Photon, IPMA e MET Norway nos serviços sem dados pessoais; o que fica depois de apagar a conta (fotos de tascos aprovadas, anónimas; fotos de grupo e de viagem, nas memórias do grupo) | `src/lib/legal.ts` (sem mudar `VERSAO_DOS_TERMOS`: não pede nova aceitação) |
| Notas para a revisão | Notas em inglês, conta e modo demo, classificação etária, etiquetas de privacidade e segurança dos dados | `docs/REVISAO-LOJAS.md` |
| Cookies | Não se aplica: a app móvel não usa cookies nem analítica, e a versão web não vai ser publicada | — |
| Reembolsos | Não se aplica: a app é gratuita e não processa pagamentos (dito nos termos) | — |

## Falta decidir ou fazer (por ordem)

1. **Morada.** Não aparece em lado nenhum: o contacto é o email, que chega para o RGPD numa app gratuita feita por uma
   pessoa. Quando houver um apartado dos CTT ou um domicílio profissional, põe-se em `RESPONSAVEL.morada`
   (`src/lib/legal.ts`) e corre-se `npm run legal:paginas`. Na App Store, declarar «não comerciante» (app gratuita, sem
   atividade comercial) para a morada não ser mostrada.
2. **Páginas públicas — feito.** Estão no repositório público `martim03330/awayday-legal`, com GitHub Pages:
   - Política de privacidade (link para a App Store e o Google Play): https://martim03330.github.io/awayday-legal/privacidade.html
   - Termos: https://martim03330.github.io/awayday-legal/termos.html
   - Sobre e contactos (suporte): https://martim03330.github.io/awayday-legal/sobre.html
   - Apagar a conta (link do Google Play, «Eliminação de dados»): https://martim03330.github.io/awayday-legal/apagar-conta.html
     — página estática (`docs/legal/apagar-conta.html`), não é gerada: se «Quanto tempo guardamos» mudar em
     `src/lib/legal.ts`, mudar também esta página.
   - Convites (abrem a app a partir do WhatsApp): https://martim03330.github.io/awayday-legal/convite/?c=CÓDIGO
     (`docs/convite/index.html`, vai para a pasta `convite/` do repositório). Trocar `TODO_TESTFLIGHT_URL` e
     `TODO_ANDROID_URL` antes de publicar.
   - Para atualizar: `npm run legal:paginas`, copiar `docs/legal/*.html` (com `apagar-conta.html`) e a pasta
     `docs/convite/` para esse repositório e fazer push.
3. **Textos de permissões no `app.json` — feito** (com autorização). Ficaram assim:
   - Câmara: «O AwayDay usa a câmara para tirares a tua foto de perfil, a do grupo, fotos da viagem e de tascos, e
     as provas das missões.»
   - Localização: «O AwayDay usa a tua localização no momento em que fazes check-in num tasco, carimbas o estádio,
     escolhes o ponto de partida de uma boleia ou procuras a casa de banho mais perto. A tua posição não fica
     guardada.»
4. **Identificadores da app — feito:** `com.martimhenriques.awayday` em iOS e Android. Não muda depois da primeira
   submissão.
5. **Ficha da App Store**: classificação etária **18+** (álcool frequente, conteúdo de utilizadores e conversa, e
   a idade mínima dos termos) e etiquetas de privacidade — respostas completas em `docs/REVISAO-LOJAS.md`.
   Contacto de suporte: o email do responsável.
6. **Ficha do Google Play**: «Segurança dos dados», questionário IARC e público-alvo 18+ em
   `docs/REVISAO-LOJAS.md`; link para eliminar a conta: `apagar-conta.html` (acima).
7. **Mapillary**: a chave `MAPILLARY_ACCESS_TOKEN` está em `scripts/.env` (fora do Git). Saiu do `.env.local` a
   2026-10-13 porque o Expo copiava todas as variáveis desse ficheiro para os seus logs locais. Nenhum código a usa.

## Riscos assinalados

- **Boleias e TVDE.** A partilha de custos sem lucro é legal; com lucro passa a ser transporte remunerado (Lei
  45/2018). A app só calcula custos (combustível e portagens), e os termos dizem-no. Não deixar o condutor pôr um
  preço livre.
- **Preço do combustível.** O valor de partida é só uma referência e já não é atribuído à DGEG. Ideal: ir buscá-lo a
  uma fonte oficial no servidor, com data.
- **Agregados de «adeptos da casa aqui»** aparecem a partir de 3 pessoas, enquanto a regra do projeto para agregados
  é 5. Rever se o mínimo deve subir para 5.
- **Segurança de adeptos.** A informação sobre percursos e zonas é indicativa e com fontes. Manter sempre as fontes e
  a frase «segue sempre a PSP no dia»; nunca mostrar onde estão adeptos visitantes.
- **Nomes e cores de clubes.** Usados só para identificar (uso nominativo). Os escudos são desenhos genéricos com
  iniciais. Não usar emblemas oficiais nem sugerir parceria.
- **Fotos.** Fotos de tascos de terceiros vêm da Wikimedia com autor e licença; as fotos enviadas por pessoas são
  moderadas antes de aparecer. As imagens em `docs/promo/ecras` são maquetas com dados inventados: não servem como
  capturas da App Store (a Apple pede capturas reais).
- **Modo demo** acessível a qualquer pessoa (5 toques no perfil). Agora tem etiqueta permanente; confirmar que a
  ligação de demo (`EXPO_PUBLIC_DEMO_MODE`) não está ligada na versão de produção.
- **Livro de Reclamações Eletrónico.** Obrigatório para quem presta serviços a consumidores como atividade económica.
  Uma app gratuita feita por uma pessoa singular, sem atividade comercial, provavelmente está fora; se a app passar a
  ter receitas, aderir.
- **Idade mínima de 18 anos**, escolhida por causa das boleias com desconhecidos e do álcool. Não há verificação
  (só a declaração ao criar conta), o que é o habitual.
- **Carregamento artificial.** `src/hooks/use-simulated-loading.ts` ainda junta um atraso falso de 0,6–0,9 s em alguns
  ecrãs (do tempo dos dados de exemplo). Não é um problema legal; vale a pena tirar.

## Compilar e submeter (EAS)

O `eas.json` tem dois perfis: `preview` (instalação interna, para testar no telemóvel) e `production` (lojas, com o
número da compilação a subir sozinho). A sessão no EAS é a conta `martim03330`.

1. **Variáveis do Supabase no EAS** (uma vez). O `.env.local` não vai para a compilação, por estar fora do git:
   ```bash
   npx eas-cli env:create --environment production --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value "<o valor do .env.local>" --visibility plaintext
   npx eas-cli env:create --environment production --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "<o valor do .env.local>" --visibility plaintext
   ```
   **Nunca** criar `EXPO_PUBLIC_DEMO_MODE` nem `EXPO_PUBLIC_CAPTURAS` nestes ambientes.
2. **Compilar para iOS** (a primeira vez pede a conta Apple Developer, para criar os certificados):
   ```bash
   npx eas-cli build --platform ios --profile production
   ```
3. **Enviar para o App Store Connect** (TestFlight e depois revisão):
   ```bash
   npx eas-cli submit --platform ios --latest
   ```
4. **Android**, quando houver conta Google Play: `npx eas-cli build --platform android --profile production`.
