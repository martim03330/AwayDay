// Renders the videos into docs/promo/anuncio/: the short ad (default) or, with `longo`, the full tour of the app
// (9:16 and 4:5) and one Reel per chapter (reels/), each with its poster.
//
//   1. copies the app recordings (../clipes), the app icon and the music into public/;
//   2. renders each composition with Remotion (H.264, 30 fps, AAC);
//   3. pulls frame 0 (the poster: the settled end card) as capa-*.png.
//
// The music is made by musica.py (python3 musica.py public/musica.wav, then loudness-normalised: see LEIA-ME).
// Usage:  npm run render      (from docs/promo/anuncio/video, after npm install)

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';

const aqui = dirname(fileURLToPath(import.meta.url));
const anuncio = join(aqui, '..');
const publico = join(aqui, 'public');

mkdirSync(publico, { recursive: true });
cpSync(join(anuncio, 'clipes'), join(publico, 'clipes'), { recursive: true });
cpSync(join(aqui, '../../../../assets/images/icon.png'), join(publico, 'icone.png'));
for (const musica of ['musica.wav', 'musica-longo.wav', 'musica-boleias.wav']) {
  if (!existsSync(join(publico, musica))) {
    throw new Error(`Falta public/${musica}: gera-a com musica.py (ver docs/promo/LEIA-ME.md).`);
  }
}

const servido = await bundle({ entryPoint: join(aqui, 'src/index.ts'), publicDir: publico });
// Which videos: `npm run render` does the short ad; `npm run render -- longo` the full tour and the chapter Reels;
// `npm run render -- reels` only the chapter Reels; `npm run render -- boleias` the rides ad (9:16 and 4:5).
const qual = process.argv[2] ?? 'curto';
const capitulos = Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, '0'));
const lista =
  qual === 'boleias'
    ? [
        ['BoleiasReels', 'boleias-reels-9x16.mp4', 'capa-boleias-reels.png'],
        ['BoleiasFeed', 'boleias-feed-4x5.mp4', 'capa-boleias-feed.png'],
      ]
    : qual === 'reels'
    ? capitulos.map((n) => [`Capitulo-${n}`, `reels/capitulo-${n}.mp4`, `reels/capa-capitulo-${n}.png`])
    : qual === 'longo'
    ? [
        ['Longo', 'awayday-completo-9x16.mp4', 'capa-completo-9x16.png'],
        ['LongoFeed', 'awayday-completo-4x5.mp4', 'capa-completo-4x5.png'],
        ...capitulos.map((n) => [`Capitulo-${n}`, `reels/capitulo-${n}.mp4`, `reels/capa-capitulo-${n}.png`]),
      ]
    : [
        ['Reels', 'awayday-reels-9x16.mp4', 'capa-reels.png'],
        ['Feed', 'awayday-feed-4x5.mp4', 'capa-feed.png'],
      ];
mkdirSync(join(anuncio, 'reels'), { recursive: true });
cpSync(join(anuncio, 'clipes-longo'), join(publico, 'clipes-longo'), { recursive: true });
for (const [id, nome, capa] of lista) {
  const composicao = await selectComposition({ serveUrl: servido, id });
  const saida = join(anuncio, nome);
  await renderMedia({
    composition: composicao,
    serveUrl: servido,
    codec: 'h264',
    crf: 16,
    audioCodec: 'aac',
    audioBitrate: '256k',
    pixelFormat: 'yuv420p',
    outputLocation: saida,
    onProgress: ({ progress }) => process.stdout.write(`\r  ${nome} ${Math.round(progress * 100)}%   `),
  });
  // The poster is frame 0. A still renders it reliably (a frozen recording inside a video render does not always),
  // so it is rendered on its own and burnt over frame 0, keeping the length and the sound as they are.
  await renderStill({ composition: composicao, serveUrl: servido, frame: 0, output: join(anuncio, capa) });
  const temporario = `${saida}.tmp.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', saida, '-i', join(anuncio, capa), '-filter_complex', "[0:v][1:v]overlay=enable='eq(n,0)'", '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', temporario]);
  execFileSync('mv', [temporario, saida]);
  console.log(`\n  ${nome} · ${capa}`);
}
