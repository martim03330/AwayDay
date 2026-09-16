// Gera o material de vídeo a partir de docs/promo/ecras.html:
//
//   docs/promo/AwayDay-ecras.pdf        uma página por ecrã, com a legenda do que mostra;
//   docs/promo/ecras/NN-nome.png        cada ecrã sozinho, a 3x (1170 x 2532), pronto para o editor de vídeo.
//
// Isto não são fotografias da app a correr: são maquetas em HTML com as cores, os tipos de letra e os textos do
// projeto. Os dados são exemplos inventados de propósito.
//
// Uso:  node scripts/gerar-ecras.mjs
//
// Precisa do Chrome que o Puppeteer instala (uma vez):  npx puppeteer browsers install chrome
// O puppeteer não entra no package.json: isto é uma ferramenta de bastidores, não faz parte da app.

import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = join(raiz, 'docs/promo/ecras.html');
const pasta = join(raiz, 'docs/promo/ecras');
const pdf = join(raiz, 'docs/promo/AwayDay-ecras.pdf');

/** O Chrome do Puppeteer, onde quer que ele o tenha posto. */
async function encontrarChrome() {
  const base = join(process.env.HOME ?? '', '.cache/puppeteer/chrome');
  const versoes = await readdir(base).catch(() => []);
  if (versoes.length === 0) {
    throw new Error(
      'Falta o Chrome do Puppeteer. Corre primeiro: npx puppeteer browsers install chrome'
    );
  }
  const versao = versoes.sort().at(-1);
  return join(base, versao, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
}

// O puppeteer-core não está no package.json (não faz parte da app). Diz-se aqui onde ele está:
//   PUPPETEER_CORE=/caminho/para/node_modules/puppeteer-core node scripts/gerar-ecras.mjs
// Se estiver instalado no projeto, o nome simples chega.
const puppeteer = await import(process.env.PUPPETEER_CORE ?? 'puppeteer-core').catch(() => {
  throw new Error(
    'Falta o puppeteer-core. Instala-o numa pasta à parte (npm i puppeteer-core) e indica-o em PUPPETEER_CORE.'
  );
});

const navegador = await puppeteer.launch({
  executablePath: await encontrarChrome(),
  args: ['--no-sandbox', '--font-render-hinting=none'],
});

try {
  await rm(pasta, { recursive: true, force: true });
  await mkdir(pasta, { recursive: true });

  const pagina = await navegador.newPage();
  await pagina.goto(`file://${fonte}`, { waitUntil: 'networkidle0' });
  // Os tipos de letra vêm do Google Fonts: sem isto, as primeiras imagens saíam com a letra de reserva.
  await pagina.evaluate(() => document.fonts.ready);

  // 1. O PDF, com todas as páginas.
  await pagina.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });

  // 2. Cada ecrã sozinho, em PNG, com o triplo da resolução.
  await pagina.setViewport({ width: 900, height: 1000, deviceScaleFactor: 3 });
  await pagina.evaluate(() => document.fonts.ready);

  const telas = await pagina.$$('.tela');
  const nomes = await pagina.$$eval('.tela', (elementos) =>
    elementos.map((elemento) => {
      const legenda = elemento.closest('.pagina')?.querySelector('.legenda-pagina h2');
      return (legenda?.textContent ?? 'ecra')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
    })
  );

  for (const [indice, tela] of telas.entries()) {
    const numero = String(indice + 1).padStart(2, '0');
    const ficheiro = join(pasta, `${numero}-${nomes[indice]}.png`);
    await tela.screenshot({ path: ficheiro });
    console.log(`  ${numero} · ${nomes[indice]}`);
  }

  console.log(`\n${telas.length} ecrãs em docs/promo/ecras/`);
  console.log(`PDF em docs/promo/AwayDay-ecras.pdf`);
} finally {
  await navegador.close();
}
