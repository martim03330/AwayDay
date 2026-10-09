# Revisão das lojas: o que pôr no App Store Connect e na Play Console

Estado a 9 de outubro de 2026. Textos para colar, respostas aos questionários e o que tem de estar feito antes de
submeter. As notas para quem revê estão em inglês (é o que a Apple e a Google leem); o resto em português.
Ver também `docs/LEGAL-E-LOJAS.md` (legal) e `docs/promo/loja/FICHA.md` (textos da ficha).

## Antes de submeter

1. **Criar a conta de demonstração** numa compilação de produção: email e password novos, só para a revisão, com o
   email confirmado. Entrar uma vez, escolher um clube, criar um grupo («Malta de teste») e oferecer uma boleia para
   um jogo próximo, para quem revê não encontrar tudo vazio. Pôr o email e a password em baixo, onde diz
   `<DEMO_EMAIL>` e `<DEMO_PASSWORD>`, **só no App Store Connect e na Play Console**, nunca neste repositório.
2. **Publicar as páginas** no repositório público `martim03330/awayday-legal` (ver «Páginas públicas» em
   `docs/LEGAL-E-LOJAS.md`), incluindo `apagar-conta.html` e a pasta `convite/`.
3. Confirmar que `EXPO_PUBLIC_DEMO_MODE` e `EXPO_PUBLIC_CAPTURAS` **não** existem nos ambientes `production` e
   `preview` do EAS.

## Notas para quem revê (App Review Information / instruções de acesso)

Campo «Notes» no App Store Connect e «Instruções de acesso» na Play Console (Política da app → Acesso à app). Colar
tal como está, depois de trocar os dois marcadores:

```text
AwayDay is a free app for football (soccer) fans in Portugal on match day: the fixture list of the Portuguese
leagues, a page for each stadium (parking, getting there, nearest toilets, weather), bars and cafés ("tascos")
near the stadium rated by fans, cost-sharing car rides to the match (the app only splits fuel and tolls; no
payments are processed in the app), fan groups with chat, and splitting trip expenses ("who owes whom").

All content is in European Portuguese and about Portuguese football (Liga Portugal and Portuguese stadiums).
The app has no ads, no in-app purchases and no tracking. It is for adults (18+): rides are shared with other
users and many venues serve alcohol.

DEMO ACCOUNT (email already confirmed)
  Email:    <DEMO_EMAIL>
  Password: <DEMO_PASSWORD>
  Sign in: Perfil (Profile) tab > "Entrar".

DEMO MODE (sample data, no account needed)
Real activity depends on real matches and on being physically at a stadium, so the app has a hidden demo mode
with sample data and a simulated match day:
  1. Open the "Perfil" (Profile) tab.
  2. Tap the green header at the top of the screen 5 times quickly (within 3 seconds).
  3. Settings ("Definições") opens with a "Modo demo" section. Turn the "Modo demo" switch on.
  4. A permanent label "Modo demo · dados de exemplo" shows while it is on. Turn it off in the same place.
Demo data never leaves the phone and is never mixed with a real account's data.

FEATURES THAT NEED LOCATION
Check-in at a tasco and stamping a stadium only work within a short distance of the place on match day, so they
cannot be tested from outside Portugal; demo mode shows what they look like. Location is read once, when the user
taps the action, and is optional.

USER-GENERATED CONTENT (Guideline 1.2)
Users accept the Terms (no objectionable content, zero tolerance for abuse) when creating an account. Every
message, profile, ride and photo can be reported (long-press a message or use the "..." menu), and users can block
other users. Tasco photos are moderated before they are public. Reports are reviewed by the developer within 24
hours; offending content is removed and accounts can be suspended.

ACCOUNT DELETION
Perfil > account card > "Apagar conta" (asks for the password). Web: 
https://martim03330.github.io/awayday-legal/apagar-conta.html

AI
Optional coach tips and a season recap are written by Anthropic's Claude. They are off by default and the app asks
for explicit permission, saying what is sent (club, fixtures, places and in-app activity; never name or email).

Contact: martim565@gmail.com
```

> Confirmar antes de colar: a forma de denunciar (pressão longa na mensagem ou menu «…») e o prazo de 24 horas. Se
> o caminho na app for outro, corrigir o texto. A Apple pede um prazo de resposta às denúncias e cumpri-lo.

## Classificação etária

O AwayDay é só para maiores de 18 (termos e consentimento ao criar conta). As respostas descrevem o que a app tem;
no fim, se o questionário der menos de 18, escolher a classificação mais alta disponível.

### Apple (questionário de classificação etária)

| Pergunta | Resposta | Porquê |
|---|---|---|
| Álcool, tabaco ou drogas: uso ou referências | **Frequente** | Tascos, cerveja (cervejómetro), «imperiais» nas contas |
| Conteúdo gerado por utilizadores | **Sim** | Fotos, avaliações, mensagens, boleias |
| Mensagens e conversa | **Sim** | Conversa dos grupos e do carro |
| Publicidade | Não | |
| Acesso livre à web | Não | Só abre links concretos (sites dos clubes, Airbnb, Booking) no navegador |
| Jogo a dinheiro / casino simulado | Não | |
| Concursos | Não | Ranking e missões sem prémios |
| Violência, horror, conteúdo sexual, nudez, linguagem grosseira | Não / Nenhum | |
| Temas médicos ou de saúde | Não | |
| Controlo parental / verificação de idade na app | Não | Só a declaração «tenho 18 anos» |

Resultado esperado: 16+ ou 18+. **Escolher 18+** (substituição da classificação para uma mais alta) para bater com
os termos. A ficha diz o mesmo (`docs/promo/loja/FICHA.md`).

### Google Play (questionário IARC e público-alvo)

| Pergunta | Resposta |
|---|---|
| Categoria | Referência, notícias ou educação? Não: escolher «Todas as outras categorias de apps» (social/utilitário) |
| Violência, medo, sexualidade, linguagem, substâncias controladas | Não |
| Referências a álcool ou tabaco | **Sim** (álcool: tascos e cerveja, sem incentivo ao consumo) |
| Jogo a dinheiro | Não |
| Os utilizadores podem interagir ou trocar conteúdo | **Sim** (conversa, fotos, avaliações) |
| Partilha a localização física atual com outros utilizadores | **Não** (o ponto de encontro da boleia é um sítio escolhido no mapa, não a posição; o mapa só mostra números agregados) |
| Compras digitais | Não |
| Público-alvo (Política da app → Público-alvo e conteúdo) | **Só 18 anos ou mais** |
| Apelativa para crianças | Não |

## Etiquetas de privacidade da Apple (App Privacy)

- **Rastreio: Não.** Não há publicidade, SDKs de análise nem partilha com corretores de dados.
- Todos os tipos abaixo: **ligados à identidade** (à conta), **não usados para rastreio**, finalidade
  **Funcionalidade da app** (e só essa, salvo onde se diz).

| Tipo (Apple) | O que é na app |
|---|---|
| Informação de contacto → Endereço de email | Email da conta (entrar, códigos por email via Brevo) |
| Informação de contacto → Nome | Nome visível escolhido pela pessoa |
| Conteúdo do utilizador → Fotos ou vídeos | Foto de perfil, do grupo, do álbum da viagem, de tascos e das missões |
| Conteúdo do utilizador → Outro conteúdo do utilizador | Mensagens dos grupos e do carro, avaliações, pratos, planos, denúncias |
| Localização → Localização exata | Lida no momento para check-in, carimbo e WC mais perto (enviada ao servidor, não guardada); o ponto de encontro de uma boleia fica guardado |
| Localização → Localização aproximada | Concelho de onde a pessoa parte para os jogos (opcional) |
| Identificadores → ID do utilizador | ID da conta |
| Identificadores → ID do dispositivo | Token de notificações push (Expo/APNs) |
| Dados de utilização → Interação com o produto | Jogos a que vai, carimbos, check-ins, missões, pontos; também usados nas dicas por IA se a pessoa as ligar (finalidade: Funcionalidade e Personalização) |
| Informação financeira → Outra informação financeira | Despesas da viagem, saldos e acertos entre pessoas (a app não move dinheiro) |
| Diagnóstico → Outros dados de diagnóstico | Só nos relatórios que a pessoa envia: texto, modelo do telemóvel, versão da app |

Não recolhe: contactos, histórico de navegação ou pesquisa fora da app, dados de saúde, dados de pagamento, dados de
falhas automáticos, publicidade.

## Segurança dos dados do Google Play (Data safety)

Respostas gerais: **recolhe dados: Sim**; **partilha com terceiros: Não** (os fornecedores tratam dados em nome da
app e isso não conta como partilha); **dados cifrados em trânsito: Sim**; **a pessoa pode pedir para apagar: Sim**,
na app e em https://martim03330.github.io/awayday-legal/apagar-conta.html.

| Categoria → tipo | Obrigatório? | Finalidade | Notas |
|---|---|---|---|
| Localização → Aproximada | Opcional | Funcionalidade da app | Concelho de partida |
| Localização → Exata | Opcional | Funcionalidade da app | Check-in, carimbo, WC mais perto (no momento); ponto de encontro das boleias (guardado) — não marcar «efémero» |
| Informações pessoais → Nome | Obrigatório | Funcionalidade, gestão da conta | |
| Informações pessoais → Endereço de email | Obrigatório | Gestão da conta, comunicações (códigos) | |
| Informações pessoais → IDs de utilizador | Obrigatório | Funcionalidade, gestão da conta | |
| Informações financeiras → Outras informações financeiras | Opcional | Funcionalidade da app | Despesas e acertos entre pessoas |
| Mensagens → Outras mensagens na app | Opcional | Funcionalidade da app | Conversa dos grupos e do carro |
| Fotos e vídeos → Fotos | Opcional | Funcionalidade da app | |
| Atividade na app → Interações na app | Obrigatório | Funcionalidade, personalização | Inclui o que vai para as dicas por IA, se ligadas |
| Atividade na app → Outro conteúdo gerado pelo utilizador | Opcional | Funcionalidade da app | Avaliações, pratos, planos |
| Informações e desempenho da app → Diagnóstico | Opcional | Análise (corrigir erros) | Só nos relatórios enviados pela pessoa |
| Dispositivo ou outros IDs → Dispositivo ou outros IDs | Opcional | Funcionalidade da app | Token de notificações |

Não recolhe: contactos, calendário, ficheiros, áudio (o barulhómetro só guarda o nível, o som nunca sai do
telemóvel), saúde, histórico de navegação, IDs de publicidade.

## TestFlight (informação do teste)

| Campo | Valor |
|---|---|
| Email de feedback | martim565@gmail.com |
| URL da política de privacidade | https://martim03330.github.io/awayday-legal/privacidade.html |
| URL de marketing / suporte | https://martim03330.github.io/awayday-legal/sobre.html |
| Conta de demonstração (teste externo) | A mesma de cima: `<DEMO_EMAIL>` / `<DEMO_PASSWORD>` |

**Descrição do teste (Beta App Description)**, em português, é o que os testadores veem:

> O AwayDay é a app para ir à bola com a malta: jogos, estádios, tascos à volta, boleias a meias, grupos e contas da
> viagem. Esta é uma versão de teste: pode haver erros e dados que ainda mudam. Obrigado por ajudares!

**O que testar (What to Test):**

> Cria conta, escolhe o teu clube e entra no grupo da malta com o link ou o código que te mandámos (Malta → «Tenho
> um código»). Combina um jogo, oferece ou pede uma boleia e lança uma despesa. Se algo falhar, usa «Reportar um erro
> ou dar uma ideia» nas Definições, ou tira uma captura e envia pelo TestFlight.

**Notas para a revisão do teste externo:** as mesmas de «Notas para quem revê», acima.

## Convites que abrem no WhatsApp

O WhatsApp não torna clicáveis os links `awayday://`. Os convites passam a usar a página
`https://martim03330.github.io/awayday-legal/convite/` (ficheiro `docs/convite/index.html`), que tenta abrir a app,
mostra o código em grande com um botão para copiar e os botões para instalar. **Antes de publicar**, trocar
`TODO_TESTFLIGHT_URL` (link público do TestFlight) e `TODO_ANDROID_URL` (teste interno ou fechado da Play Console)
nesse ficheiro. Para a app passar a partilhar este link, mudar uma linha em cada ecrã:

- `src/app/grupos/[grupoId]/definicoes.tsx` (`convidar`):
  `const link = \`https://martim03330.github.io/awayday-legal/convite/?c=${encodeURIComponent(grupo.inviteCode)}\`;`
- `src/app/(tabs)/jogos/boleia.tsx` (`partilhar`):
  `const link = \`https://martim03330.github.io/awayday-legal/convite/?boleia=${encodeURIComponent(boleia.id)}&jogo=${encodeURIComponent(jogo.id)}\`;`
