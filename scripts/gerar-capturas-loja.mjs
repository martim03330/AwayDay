// Gera as capturas das lojas a partir de docs/promo/loja/capturas.html:
//
//   docs/promo/loja/app-store/NN-nome.png     1320 x 2868, iPhone 6,9" (o único tamanho que a Apple exige)
//   docs/promo/loja/google-play/NN-nome.png   1080 x 1920
//   docs/promo/loja/google-play/destaque.png  1024 x 500, a imagem de destaque do Google Play
//   docs/promo/instagram/NN-nome.png          1080 x 1350, posts para o feed do Instagram
//
// As capturas da app em si estão em docs/promo/capturas-reais/ (tiradas no simulador: ver docs/promo/LEIA-ME.md).
// Os PNG saem sem canal alfa, porque as lojas recusam imagens com transparência.
//
// Uso:  PUPPETEER_CORE=<caminho>/puppeteer-core.js node scripts/gerar-capturas-loja.mjs
// Precisa do Chrome do Puppeteer (npx puppeteer browsers install chrome) e do ffmpeg.

import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const fonte = join(raiz, 'docs/promo/loja/capturas.html');
const saidas = [
  { formato: 'app-store', pasta: join(raiz, 'docs/promo/loja/app-store'), largura: 1320, altura: 2868 },
  { formato: 'google-play', pasta: join(raiz, 'docs/promo/loja/google-play'), largura: 1080, altura: 1920 },
  { formato: 'destaque', pasta: join(raiz, 'docs/promo/loja/google-play'), largura: 1024, altura: 500 },
  { formato: 'instagram', pasta: join(raiz, 'docs/promo/instagram'), largura: 1080, altura: 1350 },
];

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

/** Rewrites a PNG in place as 24-bit RGB (no alpha). */
function semAlfa(caminho) {
  const temporario = `${caminho}.rgb.png`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', caminho, '-pix_fmt', 'rgb24', temporario]);
  execFileSync('mv', [temporario, caminho]);
}

const puppeteer = await import(process.env.PUPPETEER_CORE ?? 'puppeteer-core').catch(() => {
  throw new Error('Falta o puppeteer-core. Instala-o à parte e indica-o em PUPPETEER_CORE.');
});

const navegador = await puppeteer.launch({
  ...(await encontrarChrome()),
  args: ['--no-sandbox', '--font-render-hinting=none', '--allow-file-access-from-files'],
});

try {
  for (const pasta of new Set(saidas.map((s) => s.pasta))) {
    await rm(pasta, { recursive: true, force: true });
    await mkdir(pasta, { recursive: true });
  }

  for (const { formato, pasta, largura, altura } of saidas) {
    const pagina = await navegador.newPage();
    await pagina.setViewport({ width: largura + 200, height: altura + 200, deviceScaleFactor: 1 });
    await pagina.goto(`file://${fonte}?formato=${formato}`, { waitUntil: 'networkidle0' });
    await pagina.evaluate(() => document.fonts.ready);

    const capturas = await pagina.$$('.captura');
    const nomes = await pagina.$$eval('.captura', (elementos) =>
      elementos.map((elemento) => elemento.dataset.nome ?? 'captura')
    );
    for (const [indice, captura] of capturas.entries()) {
      const ficheiro =
        formato === 'destaque'
          ? 'destaque.png'
          : `${String(indice + 1).padStart(2, '0')}-${nomes[indice]}.png`;
      const caminho = join(pasta, ficheiro);
      await captura.screenshot({ path: caminho });
      semAlfa(caminho);
      console.log(`  ${formato} · ${ficheiro}`);
    }
    await pagina.close();
  }
} finally {
  await navegador.close();
}
