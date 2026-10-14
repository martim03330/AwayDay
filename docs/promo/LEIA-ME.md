# Material promocional

Tudo o que é preciso para as lojas e para as redes sociais. Os textos das fichas das lojas estão em
[`loja/FICHA.md`](loja/FICHA.md).

| O quê | Onde | Tamanho |
|---|---|---|
| Capturas da App Store (10) | `loja/app-store/` | 1320 × 2868 (iPhone 6,9") |
| Capturas do Google Play (10) e imagem de destaque | `loja/google-play/` | 1080 × 1920 · 1024 × 500 |
| **Plano de Instagram (6 semanas, legendas, horários)** | [`instagram/PLANO-INSTAGRAM.md`](instagram/PLANO-INSTAGRAM.md) | |
| Campanha de Instagram: posts, 7 carrosséis e Stories (48 imagens) | `instagram/campanha/` | 1080 × 1350 · 1080 × 1920 |
| Posts simples do Instagram (10) | `instagram/` | 1080 × 1350 |
| Anúncio para Reels, TikTok, Stories, Shorts | `anuncio/awayday-reels-9x16.mp4` | 1080 × 1920, 29 s |
| Anúncio para o feed do Instagram e do Facebook | `anuncio/awayday-feed-4x5.mp4` | 1080 × 1350, 29 s |
| Anúncio das boleias (motion design, sem gravações) | `anuncio/boleias-reels-9x16.mp4`, `anuncio/boleias-feed-4x5.mp4` | 1080 × 1920 · 1080 × 1350, 32 s |
| Vídeo completo: tudo o que a app faz, em 11 capítulos | `anuncio/awayday-completo-9x16.mp4`, `anuncio/awayday-completo-4x5.mp4` | 89 s |
| Um Reel por capítulo (11) | `anuncio/reels/` | 1080 × 1920, 12 a 18 s |
| Capas dos anúncios | `anuncio/capa-reels.png`, `anuncio/capa-feed.png` | |
| Pré-visualização da App Store | `anuncio/app-store-preview.mp4` | 886 × 1920, 26 s |
| Texto para publicar com o anúncio | `anuncio/texto-para-publicar.txt` | |

Tudo o que aparece nestas imagens e vídeos é a app a sério, com dados de exemplo. Se um ecrã mudar, refaz-se a
captura: senão o material promete o que a app já não cumpre.

## 1. As capturas reais (`capturas-reais/`) e as gravações (`anuncio/clipes/`)

Tiradas no simulador do iPhone 17 Pro Max (1320 × 2868), no Expo Go, com a barra de estado às 9:41.

- **Metro numa compilação de capturas:** `EXPO_PUBLIC_CAPTURAS=true EXPO_PUBLIC_DEMO_MODE=true npx expo start --no-dev --minify --clear`.
  `EXPO_PUBLIC_CAPTURAS` esconde as notas que só explicam o modo demo (a etiqueta «Modo demo · dados de exemplo» e
  a nota do ranking, ver `src/lib/capturas.ts`). Nunca se põe em `.env` nem nas compilações das lojas.
- **No Expo Go:** menu de programador → desligar «Tools button» (senão o botão aparece nas imagens).
- **Barra de estado:** `xcrun simctl status_bar booted override --time 9:41 --batteryState discharging --batteryLevel 100 --cellularBars 4 --wifiBars 3`.
- **Dados:** os ecrãs de tascos, passaporte e ranking vêm do modo demo; os de boleias, Malta, sessão, contas e dormida
  vêm de uma conta de capturas com dados inventados na base de dados (`capturas@teste.awayday.invalid`, «Tiago
  Fonseca», e dez pessoas fictícias à volta). Criar e apagar:

  ```bash
  # criar (CAPTURAS_PASSWORD é uma password à escolha, para entrar na app com esta conta)
  sed "s/'__CAPTURAS_PASSWORD__'/'$CAPTURAS_PASSWORD'/" scripts/dados-de-teste/capturas-contas.sql > /tmp/c.sql
  supabase db query --linked -f /tmp/c.sql; rm /tmp/c.sql
  supabase db query --linked -f scripts/dados-de-teste/capturas-dados.sql
  # apagar tudo (só toca nos ids c0000000-…)
  supabase db query --linked -f scripts/dados-de-teste/capturas-apagar.sql
  ```

  Os jogos usados são Braga x Sporting (9 out) e Lens x Sporting (13 out). Depois dessas datas, a sessão e os planos
  continuam a abrir pela ligação direta, mas para capturas novas convém mudar os jogos para os próximos.
- **Gravações:** `xcrun simctl io booted recordVideo --codec=h264 clipe.mp4` enquanto se usa a app; depois corta-se o
  trecho útil para `anuncio/clipes/` (30 fps, 1320 × 2868).

## 2. Capturas das lojas e posts

```bash
npx puppeteer browsers install chrome                 # uma vez
npm --prefix /tmp/ferramentas i puppeteer-core        # uma vez, fora do package.json da app
PUPPETEER_CORE=/tmp/ferramentas/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js \
  node scripts/gerar-capturas-loja.mjs
```

Os títulos e a ordem estão em `loja/capturas.html` (lista `CAPTURAS`). Precisa do `ffmpeg` (os PNG saem sem alfa).

## 3. O anúncio (`anuncio/video/`)

Feito em [Remotion](https://www.remotion.dev) (gratuito para particulares e empresas até 3 pessoas), num projeto à
parte com o seu próprio `package.json`: não entra na app.

- `src/Anuncio.tsx` — o anúncio de 29 s: o relvado e «Jogo fora no sábado?», «A app de quem vai à bola.» na batida,
  e depois uma ideia por cena com o telemóvel inteiro: a boleia ao cêntimo (a única cena com dinheiro), o tasco ao
  vivo, seis carimbos a cair no passaporte, a subida no ranking, as missões da semana e a memória da viagem. Sem
  frases de rodapé. A capa (fotograma 0) é o fecho já assente.
- `src/boleias/` — o anúncio das boleias, em motion design sobre a página limpa (inspirado nos conceitos de produto
  tipo «Uber»): o ponto que vira pergunta, o mapa a desenhar o caminho até ao estádio, «Boleia?» e o toque em
  «Pedir lugar», o verde que cobre o ecrã e se abre em íris, os cartões a flutuar (lugares a encher, ponto de encontro, a divisão — o único
  dinheiro), a malta a ir ter ao carro de pontos diferentes, o carro a seguir até ao estádio que se acende, com a conversa do carro, «Ninguém fica em casa. Vamos juntos.» e o fecho. Tempos em
  `src/boleias/tempos.ts`, iguais aos do modo `boleias` do `musica.py`.
- `src/longo/` — o vídeo completo: os capítulos (texto, gravações, recortes e tempos) estão em `capitulos.ts`.
  O telemóvel aparece sempre inteiro; cada plano mostra um ecrã parado ou um toque curto (os momentos parados foram
  encontrados com o `freezedetect` do ffmpeg), sem scroll comprido.
  As gravações estão em `anuncio/clipes-longo/`. Os recortes amarelos são cortes exatos das gravações, medidos na
  captura de 1320 × 2868 num momento em que o ecrã está parado, e aparecem por cima do sítio de onde saem.
- `src/tempos.ts` e `musica.py` — a linha do tempo, igual nos dois: a música é a 120 BPM, por isso uma batida são
  15 fotogramas e os cortes caem em cima da batida.
- `musica.py` — a música, composta por código (sem licenças de terceiros), com os sons da própria app no carimbo e no
  fecho. Precisa de `numpy` e `scipy` (num ambiente à parte).

```bash
cd docs/promo/anuncio/video
npm install
python3 musica.py curto public/musica-bruta.wav
ffmpeg -i public/musica-bruta.wav -af "afade=t=out:st=27.6:d=1.4,loudnorm=I=-14:TP=-1.0:LRA=9" -ar 48000 public/musica.wav
python3 musica.py longo public/musica-longo-bruta.wav     # e normalizar como acima, com o fade no fim (88 s)
npm run render                 # o anúncio curto e as capas, em docs/promo/anuncio/
npm run render -- longo        # o vídeo completo (9:16 e 4:5) e os 11 Reels de capítulo
python3 musica.py boleias public/musica-boleias-bruta.wav  # e normalizar como acima, com o fade aos 30,6 s
npm run render -- boleias      # o anúncio das boleias (9:16 e 4:5) e as capas
npm run estudio                # para ver e afinar no browser
```

A pré-visualização da App Store é diferente: a Apple quer só a app, por isso são as gravações de ponta a ponta com
uma legenda curta (`scripts/gerar-preview-app-store.mjs`, legendas em `anuncio/legendas-preview.html`).

## Material antigo

`ecras/`, `AwayDay-ecras.pdf`, `posts/` e os HTML que os geram (`scripts/gerar-ecras.mjs`, `scripts/gerar-posts.mjs`)
são **maquetas de setembro**, anteriores à revisão do design: não mostram a app como ela é hoje. Ficam só como
histórico; para publicar, usar o material acima.
