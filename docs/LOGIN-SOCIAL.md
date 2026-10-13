# Entrar com Apple e Google

O que tens de ligar fora do código para os botões «Continuar com Apple» e «Continuar com Google» funcionarem no
iPhone. Enquanto um passo faltar, a app não parte: o botão desse fornecedor simplesmente não aparece (ou, se o
fornecedor não estiver ligado no Supabase, a app diz «Este tipo de entrada ainda não está ligado. Usa o email por
agora.»).

Nenhum destes valores é segredo dentro da app: os IDs de cliente OAuth vão dentro de qualquer build. O único segredo
é o «Client secret» do cliente Web da Google, e esse fica só no Supabase.

Os dois só funcionam numa build nativa (EAS). No Expo Go o botão da Google nunca aparece; o da Apple pode aparecer,
mas o token vem com o ID do Expo Go (`host.exp.Exponent`) e o Supabase recusa-o, a não ser que o acrescentes à lista
(ver passo D).

---

## A. Apple: ativar «Sign in with Apple» no App ID

Não precisas de fazer nada à mão. O `app.json` já tem `"usesAppleSignIn": true` e o plugin
`expo-apple-authentication`. Na próxima build:

```bash
eas build --platform ios --profile production
```

o EAS deteta a capacidade nova e pergunta se pode atualizar o App ID `com.martimhenriques.awayday` e o perfil de
distribuição. Responde que sim. Se preferires confirmar à mão: [developer.apple.com](https://developer.apple.com) →
Certificates, Identifiers & Profiles → Identifiers → `com.martimhenriques.awayday` → a caixa «Sign In with Apple»
deve estar marcada («Enable as a primary App ID»).

Nota da App Store (regra 4.8): uma app que oferece entrar com a Google tem de oferecer também uma opção equivalente
com privacidade, e a Apple serve. Por isso os dois botões vão juntos.

## B. Google Cloud: ecrã de consentimento e dois clientes OAuth

Em [console.cloud.google.com](https://console.cloud.google.com), no projeto do AwayDay (o mesmo do Firebase serve):

1. **Ecrã de consentimento** (Google Auth Platform → Branding / «OAuth consent screen»):
   - Tipo de utilizador: **Externo**.
   - Nome da app: `AwayDay`; email de apoio: o teu; logótipo (opcional).
   - Domínios e links: página inicial, política de privacidade e termos (as páginas públicas que já tens para as
     lojas).
   - Âmbitos (Data access): só `openid`, `.../auth/userinfo.email` e `.../auth/userinfo.profile`. Estes não
     precisam de verificação da Google.
   - Público (Audience): carrega em **Publicar app** («In production»). Em modo de teste só entram as contas que
     puseres na lista de testers.
2. **Cliente iOS** (Clients → Create client):
   - Tipo: **iOS**.
   - Nome: `AwayDay iOS`.
   - Bundle ID: `com.martimhenriques.awayday`.
   - Guarda o **Client ID** (acaba em `.apps.googleusercontent.com`) e o **iOS URL scheme** que a página mostra
     (começa por `com.googleusercontent.apps.`: é o mesmo ID ao contrário).
3. **Cliente Web** (Clients → Create client):
   - Tipo: **Web application**.
   - Nome: `AwayDay Supabase`.
   - Authorized redirect URIs: `https://<o-teu-projeto>.supabase.co/auth/v1/callback` (o endereço exato aparece no
     Supabase, na página do fornecedor Google). Não é usado pelo botão nativo, mas não faz mal ter.
   - Guarda o **Client ID** e o **Client secret**.

## C. Pôr os IDs no EAS e no `.env.local`

No EAS, para os ambientes `production` e `preview` (os do `eas.json`):

```bash
eas env:create --environment production --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "<ID do cliente iOS>"
eas env:create --environment production --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<ID do cliente Web>"
eas env:create --environment production --environment preview --visibility plaintext \
  --name GOOGLE_IOS_URL_SCHEME --value "com.googleusercontent.apps.<...>"
```

- Os dois `EXPO_PUBLIC_` são lidos pela app (por isso «plaintext»: vão dentro da build de qualquer forma).
- `GOOGLE_IOS_URL_SCHEME` é lido pelo `app.config.js` na build, para o plugin registar o URL scheme que traz a
  pessoa de volta à app. Se faltar, o `app.config.js` calcula-o a partir do ID iOS (é o mesmo, ao contrário).
- Como o plugin mexe no código nativo, a Google só passa a funcionar depois de uma **build nova**. Uma atualização
  OTA (`eas update`) não chega para a primeira vez; depois disso, as atualizações OTA também precisam destas variáveis
  (usa `eas update --environment production`).

No `.env.local` (para builds locais e desenvolvimento):

```bash
# Entrar com Google (IDs públicos de cliente OAuth; o secret fica só no Supabase).
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ID do cliente iOS>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<ID do cliente Web>
GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<...>
```

## D. Ligar os fornecedores no Supabase

Supabase → Authentication → **Sign In / Providers**.

**Apple**
1. Liga «Enable Sign in with Apple».
2. **Client IDs**: `com.martimhenriques.awayday`. Para testar no Expo Go, acrescenta `host.exp.Exponent` separado
   por vírgula (e tira-o antes do lançamento).
3. «Secret Key (for OAuth)», Team ID e Key ID: deixa em branco. Só são precisos para entrar com a Apple pelo
   browser (web ou Android), que a app não usa.
4. Guarda.

**Google**
1. Liga «Enable Sign in with Google».
2. **Client IDs**: o ID do cliente Web **primeiro**, depois uma vírgula e o ID do cliente iOS
   (`<web>.apps.googleusercontent.com,<ios>.apps.googleusercontent.com`).
3. **Client Secret (for OAuth)**: o secret do cliente Web.
4. Liga **Skip nonce checks**. O SDK da Google no iPhone põe um nonce próprio no token que a app não consegue
   conhecer; sem esta opção o Supabase recusa todas as entradas pelo iPhone.
5. Guarda.

Ainda em Authentication: a proteção com captcha (Cloudflare Turnstile) também se aplica a estas entradas, e a app já
manda o código. Não há nada a mudar aí.

## E. Base de dados

Há uma migração por aplicar: `supabase/migrations/20261013190000_profile_name_from_social_sign_in.sql`. Dá nome ao
perfil das contas novas da Google (o nome da conta Google) e põe «Adepto» quando não há nome (a Apple não o manda no
token; a app grava-o logo a seguir, na primeira entrada). Nunca usa parte do email. Aplica com `supabase db push` e
corre `npm run test:sql` (o teste `conta_social_nome.test.sql` só passa depois disso).

## F. Testar

1. Build nova (`eas build --platform ios --profile preview`) e instalar.
2. Entrar → «Continuar com a Apple» com uma conta Apple que nunca tenha entrado: deve ir para os passos de perfil
   (foto, clube, de onde partes) com o teu nome já posto.
3. Terminar sessão e entrar outra vez com a Apple: vai direto para as tabs.
4. O mesmo com «Continuar com Google».
5. Fechar a folha da Apple ou da Google sem escolher: nada acontece, sem mensagem de erro.
6. Para voltar a ver a Apple dar o nome (só o dá na primeira vez): no iPhone, Definições → [o teu nome] → Iniciar
   sessão com a Apple → AwayDay → Parar de usar.

## O que fica para depois

- **Android**: os botões não aparecem no Android (a Apple não tem folha nativa lá, e a Google precisa de um cliente
  OAuth Android com a impressão SHA-1 da chave de assinatura do EAS). Quando quiseres, é um cliente «Android» no
  Google Cloud (pacote `com.martimhenriques.awayday`, SHA-1 de `eas credentials`) e uma pequena mudança na app.
- **Apagar a conta**: hoje o ecrã «Apagar conta» pede a palavra-passe, que quem entrou com Apple ou Google não tem.
  A App Store exige que estas contas também se possam apagar dentro da app (e, para a Apple, que se revogue o token).
  Tem de ser resolvido antes de enviar para revisão.
- **Política de privacidade**: acrescentar a Apple e a Google como forma de entrar (recebem o pedido de entrada; nós
  recebemos o email e, se a pessoa deixar, o nome).
