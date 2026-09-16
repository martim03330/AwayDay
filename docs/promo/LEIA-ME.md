# Material para o vídeo

- **`AwayDay-ecras.pdf`** — os 18 ecrãs, um por página, com uma linha a dizer o que cada um mostra.
- **`ecras/*.png`** — os mesmos ecrãs em imagem solta, 1170 × 2532 (o triplo de um iPhone), prontos para o editor.
- **`ecras.html`** — a fonte. Muda-se o texto aqui e volta-se a gerar.

Gerar outra vez (depois de mexer no HTML):

```bash
npx puppeteer browsers install chrome       # uma vez
npm --prefix /tmp/ferramentas i puppeteer-core
PUPPETEER_CORE=/tmp/ferramentas/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  node scripts/gerar-ecras.mjs
```

O `puppeteer-core` fica de fora do `package.json`: é uma ferramenta de bastidores, não faz parte da app.

## O que isto é, e o que não é

São **maquetas** dos ecrãs — HTML com as cores, os tipos de letra e os textos verdadeiros do projeto —, não
fotografias da app a correr. Os dados são exemplos inventados: nomes, horas e valores. Os escudos são os genéricos
que a app desenha (cores e sigla do clube), nunca os oficiais.

Tudo o que aparece nestas imagens é coisa que a app faz mesmo. Se um dia se mudar um ecrã, muda-se aqui também —
senão o vídeo promete o que a app já não cumpre.

## Posts para Instagram

- **`posts/*.png`** — 14 publicações (as três últimas são o carrossel de apresentação), 1080 × 1350 (o formato que o Instagram mostra maior no feed): o telemóvel ao
  centro e as bolas à volta a apontar o que ali se faz.
- **`posts.html`** — a fonte. Usa as imagens de `ecras/`, por isso gera primeiro os ecrãs.

```bash
PUPPETEER_CORE=<caminho>/puppeteer-core.js node scripts/gerar-posts.mjs
```

As legendas e a ordem de publicação estão no plano que acompanha estas imagens.
