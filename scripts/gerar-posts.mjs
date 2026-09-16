// Gera os posts para Instagram a partir de docs/promo/posts.html:
//
//   docs/promo/posts/NN-nome.png    1080 x 1350, o formato que o Instagram mostra maior no feed.
//
// Os posts usam as imagens dos ecrãs (docs/promo/ecras/), por isso corre primeiro `node scripts/gerar-ecras.mjs`.
//
// Uso:  PUPPETEER_CORE=<caminho>/puppeteer-core.js node scripts/gerar-posts.mjs

import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = join(raiz, 'docs/promo/posts.html');
const pasta = join(raiz, 'docs/promo/posts');

async function encontrarChrome() {
  const base = join(process.env.HOME ?? '', '.cache/puppeteer/chrome');
  const versoes = await readdir(base).catch(() => []);
  if (versoes.length === 0) {
    throw new Error('Falta o Chrome do Puppeteer: npx puppeteer browsers install chrome');
  }
  return join(
    base,
    versoes.sort().at(-1),
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  );
}

const puppeteer = await import(process.env.PUPPETEER_CORE ?? 'puppeteer-core').catch(() => {
  throw new Error('Falta o puppeteer-core. Instala-o à parte e indica-o em PUPPETEER_CORE.');
});

const navegador = await puppeteer.launch({
  executablePath: await encontrarChrome(),
  args: ['--no-sandbox', '--font-render-hinting=none'],
});

try {
  await rm(pasta, { recursive: true, force: true });
  await mkdir(pasta, { recursive: true });

  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: 1200, height: 1400, deviceScaleFactor: 1 });
  await pagina.goto(`file://${fonte}`, { waitUntil: 'networkidle0' });
  await pagina.evaluate(() => document.fonts.ready);

  const posts = await pagina.$$('.post');
  const nomes = await pagina.$$eval('.post', (elementos) =>
    elementos.map((elemento) => elemento.dataset.nome ?? 'post')
  );

  for (const [indice, post] of posts.entries()) {
    const numero = String(indice + 1).padStart(2, '0');
    await post.screenshot({ path: join(pasta, `${numero}-${nomes[indice]}.png`) });
    console.log(`  ${numero} · ${nomes[indice]}`);
  }

  console.log(`\n${posts.length} posts em docs/promo/posts/ (1080 x 1350)`);
} finally {
  await navegador.close();
}
