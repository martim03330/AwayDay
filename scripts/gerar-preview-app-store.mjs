// Gera a pré-visualização da App Store a partir das gravações da app (docs/promo/anuncio/clipes/), com as legendas
// desenhadas em docs/promo/anuncio/legendas-preview.html:
//
//   docs/promo/anuncio/app-store-preview.mp4   886 x 1920 (iPhone 6,9"), 15 a 30 s, H.264 30 fps, som AAC estéreo
//
// A Apple pede que a pré-visualização mostre só a app: são as gravações do ecrã, de ponta a ponta, com uma legenda
// curta. O anúncio para as redes sociais (com animação e música) é feito à parte, em docs/promo/anuncio/video/.
//
// Uso:  PUPPETEER_CORE=<caminho>/puppeteer-core.js node scripts/gerar-preview-app-store.mjs
// Precisa do Chrome do Puppeteer (npx puppeteer browsers install chrome) e do ffmpeg.

import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = join(raiz, 'docs/promo/anuncio');
const clipes = join(pasta, 'clipes');
const sons = join(raiz, 'assets/sounds');

/**
 * The scenes, in order. `inicio` and `duracao` are seconds inside the clip(s); a list of clips plays them one after
 * the other. `legenda` is the caption over the recording.
 */
const CENAS = [
  {
    clipe: ['1-malta.mp4'],
    inicio: 0.3,
    duracao: 4.6,
    legenda: 'Combina *com a malta*',
  },
  {
    clipe: ['2-boleias.mp4'],
    inicio: 0.4,
    duracao: 5.4,
    legenda: 'Boleia *a meias*',
  },
  {
    clipe: ['3-tasco.mp4'],
    inicio: 0,
    duracao: 4.3,
    legenda: 'O tasco *antes do jogo*',
  },
  {
    clipe: ['4-estacionar.mp4'],
    inicio: 1.6,
    duracao: 3.8,
    legenda: 'Sabe *onde estacionar*',
  },
  {
    clipe: ['5-contas.mp4'],
    inicio: 0,
    duracao: 4.5,
    legenda: 'Ninguém *discute contas*',
  },
  {
    clipe: ['6-passaporte.mp4', '7-ranking.mp4'],
    inicio: 0,
    duracao: 3.7,
    legenda: 'Carimba *cada estádio*',
    som: 'carimbo.wav',
  },
];

const FPS = 30;
const TRANSICAO = 0.35;
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

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
}

const n2 = (x) => x.toFixed(3);

/** Draws every still layer of a format as a transparent PNG; returns their paths and where the screen sits. */
async function camadas(navegador, formato, temp) {
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: 1200, height: 2000, deviceScaleFactor: 1 });
  await pagina.goto(`file://${join(pasta, 'legendas-preview.html')}?formato=${formato}`, { waitUntil: 'networkidle0' });
  await pagina.evaluate((cenas) => window.montar(cenas), CENAS);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForNetworkIdle();

  const ficheiros = {};
  for (const el of await pagina.$$('.camada')) {
    const id = await el.evaluate((e) => e.id);
    ficheiros[id] = join(temp, `${formato}-${id}.png`);
    await el.screenshot({ path: ficheiros[id], omitBackground: true });
  }
  const ecra = await pagina.evaluate(() => {
    const ecra = document.querySelector('#moldura .ecra');
    if (!ecra) return null;
    const a = ecra.getBoundingClientRect();
    const b = ecra.closest('.camada').getBoundingClientRect();
    return { x: Math.round(a.left - b.left), y: Math.round(a.top - b.top), w: Math.round(a.width), h: Math.round(a.height) };
  });
  await pagina.close();
  return { ficheiros, ecra };
}

/** The recording(s) of a scene, cut and scaled, as one filter chain ending in [label]. */
function filtroClipe(cena, primeiraEntrada, largura, altura, label) {
  const partes = cena.clipe.map((_, i) => `[${primeiraEntrada + i}:v]setpts=PTS-STARTPTS[c${i}]`);
  const juntos =
    cena.clipe.length > 1
      ? `${cena.clipe.map((_, i) => `[c${i}]`).join('')}concat=n=${cena.clipe.length}:v=1:a=0[cj]`
      : `[c0]null[cj]`;
  return [
    ...partes,
    juntos,
    `[cj]fps=${FPS},trim=start=${cena.inicio},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2,` +
      `scale=${largura}:${altura}:flags=lanczos,setsar=1[${label}]`,
  ];
}

/** App Store preview scene: the recording fills the screen, with the caption on top. */
function cenaPreview(cena, i, c, saida, duracao) {
  const { ficheiros } = c;
  ffmpeg([
    '-loop', '1', '-framerate', `${FPS}`, '-t', n2(duracao), '-i', ficheiros[`legenda-${i}`],
    ...cena.clipe.flatMap((nome) => ['-i', join(clipes, nome)]),
    '-filter_complex',
    [
      ...filtroClipe(cena, 1, 886, 1926, 'v'),
      `[v]crop=886:1920:0:3[vc]`,
      `[0:v]format=rgba,fade=t=in:st=0.15:d=0.35:alpha=1[t]`,
      `[vc][t]overlay=0:0,trim=duration=${n2(duracao)},format=yuv420p[out]`,
    ].join(';'),
    '-map', '[out]', '-r', `${FPS}`, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', saida,
  ]);
}

/**
 * Joins the scenes with a slide between them, adds the sound track and writes the final file. `momentos` are
 * [seconds, sound file] pairs for the app's own sounds.
 */
function juntar(cenas, duracoes, transicao, momentos, saida) {
  const total = duracoes.reduce((soma, d) => soma + d, 0) - transicao * (duracoes.length - 1);
  const entradas = cenas.flatMap((ficheiro) => ['-i', ficheiro]);
  const filtros = [];
  let anterior = '[0:v]';
  let deslocamento = 0;
  for (let i = 1; i < cenas.length; i++) {
    deslocamento += duracoes[i - 1] - transicao;
    const label = i === cenas.length - 1 ? '[vout]' : `[x${i}]`;
    filtros.push(`${anterior}[${i}:v]xfade=transition=slideleft:duration=${transicao}:offset=${n2(deslocamento)}${label}`);
    anterior = label;
  }
  if (cenas.length === 1) filtros.push('[0:v]null[vout]');

  // Sound: silence the length of the video, with the app's sounds mixed in at their moments.
  const base = cenas.length;
  const audio = ['-f', 'lavfi', '-t', n2(total), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
  momentos.forEach(([, som]) => audio.push('-i', join(sons, som)));
  const sonsFiltro = momentos.map(
    ([quando], i) => `[${base + 1 + i}:a]aresample=48000,pan=stereo|c0=c0|c1=c0,volume=0.9,adelay=${Math.round(quando * 1000)}:all=1[s${i}]`
  );
  const mistura =
    momentos.length > 0
      ? `[${base}:a]${momentos.map((_, i) => `[s${i}]`).join('')}amix=inputs=${momentos.length + 1}:normalize=0:duration=first[aout]`
      : `[${base}:a]anull[aout]`;

  ffmpeg([
    ...entradas,
    ...audio,
    '-filter_complex', [...filtros, ...sonsFiltro, mistura].join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow',
    '-r', `${FPS}`, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    '-t', n2(total), '-movflags', '+faststart', saida,
  ]);
  return total;
}

const puppeteer = await import(process.env.PUPPETEER_CORE ?? 'puppeteer-core').catch(() => {
  throw new Error('Falta o puppeteer-core. Instala-o à parte e indica-o em PUPPETEER_CORE.');
});
const navegador = await puppeteer.launch({
  ...(await encontrarChrome()),
  args: ['--no-sandbox', '--font-render-hinting=none', '--allow-file-access-from-files'],
});
const temp = await mkdtemp(join(tmpdir(), 'awayday-anuncio-'));

try {
  {
    const c = await camadas(navegador, 'preview', temp);
    const ficheiros = [];
    const duracoes = [];
    const momentos = [];
    CENAS.forEach((cena, i) => {
      const saida = join(temp, `preview-${i}.mp4`);
      const ultimo = i === CENAS.length - 1;
      const inicio = duracoes.reduce((s, d) => s + d, 0) - TRANSICAO * duracoes.length;
      if (cena.som) momentos.push([inicio + (i > 0 ? TRANSICAO : 0) + 0.35, cena.som]);
      const duracao = cena.duracao + (ultimo ? 0 : TRANSICAO);
      cenaPreview(cena, i, c, saida, duracao);
      ficheiros.push(saida);
      duracoes.push(duracao);
    });
    const total = juntar(ficheiros, duracoes, TRANSICAO, momentos, join(pasta, 'app-store-preview.mp4'));
    console.log(`  app-store-preview.mp4 · ${total.toFixed(1)} s`);
  }
} finally {
  await navegador.close();
  await rm(temp, { recursive: true, force: true });
}
