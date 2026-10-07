// Gera as imagens da campanha de Instagram a partir de docs/promo/instagram/campanha.html:
//
//   docs/promo/instagram/campanha/<publicação>.png          publicações de uma imagem e Stories
//   docs/promo/instagram/campanha/<publicação>/NN.png       carrosséis, um ficheiro por diapositivo
//
// Os recortes (docs/promo/instagram/recortes/) tiram-se primeiro das gravações, com as medidas de recortes.txt.
// Os PNG saem sem canal alfa. O plano de publicação está em docs/promo/instagram/PLANO-INSTAGRAM.md.
//
// Uso:  PUPPETEER_CORE=<caminho>/puppeteer-core.js node scripts/gerar-instagram.mjs
// Precisa do Chrome do Puppeteer (npx puppeteer browsers install chrome) e do ffmpeg.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = join(raiz, 'docs/promo/instagram');
const saida = join(pasta, 'campanha');
const clipes = join(raiz, 'docs/promo/anuncio/clipes-longo');

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
}

// 1. The crops, measured on the 1320 × 2868 recordings.
mkdirSync(join(pasta, 'recortes'), { recursive: true });
for (const linha of readFileSync(join(pasta, 'recortes.txt'), 'utf8').split('\n')) {
  if (!linha.trim() || linha.startsWith('#')) continue;
  const [nome, clipe, segundo, x, y, w, h] = linha.trim().split(/\s+/);
  ffmpeg(['-ss', segundo, '-i', join(clipes, `${clipe}.mp4`), '-frames:v', '1', '-vf', `crop=${w}:${h}:${x}:${y}`, join(pasta, 'recortes', `${nome}.png`)]);
}

// 2. The slides.
/**
 * The Chrome Puppeteer installed. The headless shell comes first: the full Chrome stops drawing (and screenshots
 * hang) while the Mac's display is asleep.
 */
async function encontrarChrome() {
  const cache = join(process.env.HOME ?? '', '.cache/puppeteer');
  const shell = await readdir(join(cache, 'chrome-headless-shell')).catch(() => []);
  if (shell.length > 0) {
    return { executablePath: join(cache, 'chrome-headless-shell', shell.sort().at(-1), 'chrome-headless-shell-mac-arm64/chrome-headless-shell'), headless: 'shell' };
  }
  const versoes = await readdir(join(cache, 'chrome')).catch(() => []);
  if (versoes.length === 0) throw new Error('Falta o Chrome do Puppeteer: npx puppeteer browsers install chrome-headless-shell');
  return { executablePath: join(cache, 'chrome', versoes.sort().at(-1), 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing') };
}

const puppeteer = await import(process.env.PUPPETEER_CORE ?? 'puppeteer-core').catch(() => {
  throw new Error('Falta o puppeteer-core. Instala-o à parte e indica-o em PUPPETEER_CORE.');
});
const navegador = await puppeteer.launch({ ...(await encontrarChrome()), args: ['--no-sandbox', '--font-render-hinting=none', '--allow-file-access-from-files'], protocolTimeout: 600000 });

try {
  rmSync(saida, { recursive: true, force: true });
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: 1200, height: 2000, deviceScaleFactor: 1 });
  await pagina.goto(`file://${join(pasta, 'campanha.html')}`, { waitUntil: 'networkidle0' });
  await pagina.evaluate(() => document.fonts.ready);
  const slides = await pagina.$$('.slide');
  const nomes = await pagina.$$eval('.slide', (els) => els.map((e) => e.dataset.nome));
  for (const [i, slide] of slides.entries()) {
    const ficheiro = join(saida, `${nomes[i]}.png`);
    mkdirSync(dirname(ficheiro), { recursive: true });
    await slide.screenshot({ path: ficheiro });
    ffmpeg(['-i', ficheiro, '-pix_fmt', 'rgb24', `${ficheiro}.rgb.png`]);
    execFileSync('mv', [`${ficheiro}.rgb.png`, ficheiro]);
  }
  console.log(`${slides.length} imagens em docs/promo/instagram/campanha/`);
} finally {
  await navegador.close();
}
