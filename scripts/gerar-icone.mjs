// Gera o ícone da app (três adeptos e uma bola) e todas as versões a partir de um só desenho em SVG:
//
//   assets/icone/awayday.svg                 o desenho, em 1024 x 1024 (fundo branco)
//   assets/images/icon.png                   1024, sem transparência (App Store e Android antigo)
//   assets/expo.icon/Assets/*.png            camadas do ícone do iOS 26 (pessoas e bola, fundo transparente)
//   assets/images/android-icon-*.png         ícone adaptativo do Android (frente, fundo e monocromático)
//   assets/images/splash-icon.png            o ícone no ecrã de arranque
//   assets/images/favicon.png                48 x 48
//
// Uso:  node scripts/gerar-icone.mjs [pasta-de-saída]
// Precisa do Chrome do Puppeteer (npx puppeteer browsers install chrome-headless-shell) e do ffmpeg.

import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const saida = process.argv[2] ? join(process.cwd(), process.argv[2]) : raiz;

const VERDE = '#0E5A34';
const PRETO = '#111613';
const BRANCO = '#FFFFFF';

// --- The drawing, in a 1024 x 1024 box -----------------------------------------------------------------------------

const BOLA = { cx: 512, cy: 688, r: 168 };
/** The white ring that cuts the ball out of the people behind it. */
const ANEL = 30;

const r = (n) => Math.round(n * 10) / 10;

function poligono(cx, cy, raio, lados, rotacao) {
  return Array.from({ length: lados }, (_, i) => {
    const a = rotacao + (i * 2 * Math.PI) / lados;
    return [r(cx + raio * Math.cos(a)), r(cy + raio * Math.sin(a))];
  });
}

const caminho = (pontos) => `M${pontos.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

/** A person: a round head and rounded shoulders, flat at the bottom. */
function pessoa(cx, cabecaY, cabecaR, larguraOmbros, ombroY, baseY) {
  const meia = larguraOmbros / 2;
  const curva = meia * 0.92;
  const corpo = [
    `M${cx - meia} ${baseY - 26}`,
    `L${cx - meia} ${ombroY + curva * 0.55}`,
    `C${cx - meia} ${ombroY - curva * 0.2} ${cx - meia * 0.55} ${ombroY - curva * 0.45} ${cx} ${ombroY - curva * 0.45}`,
    `C${cx + meia * 0.55} ${ombroY - curva * 0.45} ${cx + meia} ${ombroY - curva * 0.2} ${cx + meia} ${ombroY + curva * 0.55}`,
    `L${cx + meia} ${baseY - 26}`,
    `Q${cx + meia} ${baseY} ${cx + meia - 26} ${baseY}`,
    `L${cx - meia + 26} ${baseY}`,
    `Q${cx - meia} ${baseY} ${cx - meia} ${baseY - 26}Z`,
  ].join('');
  return `<circle cx="${cx}" cy="${cabecaY}" r="${cabecaR}"/><path d="${corpo}"/>`;
}

function pessoas() {
  return `<g fill="${VERDE}">
    ${pessoa(298, 392, 80, 236, 548, 760)}
    ${pessoa(726, 392, 80, 236, 548, 760)}
    ${pessoa(512, 318, 96, 300, 500, 760)}
  </g>`;
}

/** A classic football: a pentagon in the middle, five more at the edge, and the seams between them. */
function bola({ comAnel }) {
  const { cx, cy, r: R } = BOLA;
  const cima = -Math.PI / 2;
  const centro = poligono(cx, cy, R * 0.34, 5, cima);
  const exteriores = centro.map((_, i) => {
    const a = cima + (i * 2 * Math.PI) / 5;
    return poligono(cx + R * 1.02 * Math.cos(a), cy + R * 1.02 * Math.sin(a), R * 0.4, 5, a + Math.PI);
  });
  // From each corner of the middle pentagon to the inner corner of an edge pentagon (the hexagons' seams).
  const costuras = exteriores.map((p, i) => [centro[i], p[0]]);
  const linhas = costuras.map(([a, b]) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`).join('');
  return `<g>
    ${comAnel ? `<circle cx="${cx}" cy="${cy}" r="${R + ANEL}" fill="${BRANCO}"/>` : ''}
    <clipPath id="dentro"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="${BRANCO}"/>
    <g clip-path="url(#dentro)" fill="${PRETO}">
      <path d="${caminho(centro)}" stroke="${PRETO}" stroke-width="10" stroke-linejoin="round"/>
      ${exteriores.map((p) => `<path d="${caminho(p)}" stroke="${PRETO}" stroke-width="10" stroke-linejoin="round"/>`).join('')}
      <path d="${linhas}" fill="none" stroke="${PRETO}" stroke-width="11" stroke-linecap="round"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${R - 5}" fill="none" stroke="${PRETO}" stroke-width="10"/>
  </g>`;
}

/** How much of the tile the drawing fills (1 = as drawn above). */
const ESCALA = 1.1;

/** `camadas`: which parts to draw. `escala`: shrinks the drawing around the centre (Android's safe zone). */
function svg({ fundo = BRANCO, camadas = ['pessoas', 'bola'], escala = ESCALA, mono = false } = {}) {
  const partes = [];
  if (camadas.includes('pessoas')) partes.push(pessoas());
  // The ring only matters over the people; on its own layer the ball sits on the white of the icon anyway.
  if (camadas.includes('bola')) partes.push(bola({ comAnel: camadas.includes('pessoas') || camadas.includes('anel') }));
  let desenho = partes.join('');
  if (mono) {
    // One colour, with the ball's white cut out: Android tints whatever is opaque.
    const mascara = desenho.replaceAll(VERDE, '#FFF').replaceAll(PRETO, '#FFF').replaceAll(BRANCO, '#000');
    desenho = `<mask id="mono" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">${mascara}</mask><rect width="1024" height="1024" fill="#000" mask="url(#mono)"/>`;
  }
  // Centre of the drawing's own bounding box (heads at y≈222, ball at y≈826), so it sits in the middle of the tile.
  const centroY = 524;
  const transformar = `translate(512 512) scale(${escala}) translate(-512 -${centroY})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${fundo ? `<rect width="1024" height="1024" fill="${fundo}"/>` : ''}
  <g transform="${transformar}">${desenho}</g>
</svg>`;
}

// --- Rendering -----------------------------------------------------------------------------------------------------

async function chrome() {
  const cache = join(process.env.HOME ?? '', '.cache/puppeteer/chrome-headless-shell');
  const versoes = await readdir(cache).catch(() => []);
  if (versoes.length === 0) throw new Error('Falta o Chrome: npx puppeteer browsers install chrome-headless-shell');
  return join(cache, versoes.sort().at(-1), 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
}

const temporaria = join(tmpdir(), `icone-awayday-${process.pid}`);

/** SVG → PNG at `tamanho`. `semAlfa` flattens it (the App Store refuses icons with transparency). */
async function desenhar(conteudo, destino, tamanho, { semAlfa = false } = {}) {
  await mkdir(temporaria, { recursive: true });
  await mkdir(dirname(destino), { recursive: true });
  const html = join(temporaria, 'icone.html');
  await writeFile(
    html,
    `<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block;width:${tamanho}px;height:${tamanho}px}</style></head><body>${conteudo}</body></html>`
  );
  const png = join(temporaria, 'icone.png');
  execFileSync(
    await chrome(),
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--window-size=${tamanho},${tamanho}`,
      `--screenshot=${png}`,
      `file://${html}`,
    ],
    { stdio: 'ignore' }
  );
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-pix_fmt', semAlfa ? 'rgb24' : 'rgba', destino]);
}

const a = (caminhoRelativo) => join(saida, caminhoRelativo);

await mkdir(a('assets/icone'), { recursive: true });
await writeFile(a('assets/icone/awayday.svg'), svg());

await desenhar(svg(), a('assets/images/icon.png'), 1024, { semAlfa: true });
// iOS 26 (Icon Composer): white fill in icon.json, people behind, ball (with its ring) in front.
await desenhar(svg({ fundo: null, camadas: ['pessoas'] }), a('assets/expo.icon/Assets/pessoas.png'), 1024);
await desenhar(svg({ fundo: null, camadas: ['bola', 'anel'] }), a('assets/expo.icon/Assets/bola.png'), 1024);
// Android: the launcher masks the outer third, so the drawing shrinks into the middle 66%.
await desenhar(svg({ fundo: null, escala: 0.7 }), a('assets/images/android-icon-foreground.png'), 512);
await desenhar(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BRANCO}"/></svg>`,
  a('assets/images/android-icon-background.png'),
  512
);
await desenhar(svg({ fundo: null, escala: 0.7, mono: true }), a('assets/images/android-icon-monochrome.png'), 432);
// Splash: the white tile on the green launch screen.
await desenhar(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect x="112" y="112" width="800" height="800" rx="180" fill="${BRANCO}"/><g transform="translate(112 112) scale(0.78125)">${svg(
    { escala: 0.95 }
  )
    .replace(/^<svg[^>]*>|<\/svg>$/g, '')
    .replace(/<rect width="1024" height="1024"[^>]*\/>/, '')}</g></svg>`,
  a('assets/images/splash-icon.png'),
  512
);
await desenhar(svg({ escala: 1.25 }), a('assets/images/favicon.png'), 48, { semAlfa: true });

await rm(temporaria, { recursive: true, force: true });
console.log('Ícone gerado em', saida);
