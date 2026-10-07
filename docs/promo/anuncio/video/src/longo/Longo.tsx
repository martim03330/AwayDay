import {
  AbsoluteFill,
  Audio,
  Easing,
  Freeze,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { Fecho } from '../Anuncio';
import { Icone, Linha, type Regiao, useEntrada } from '../componentes';
import { COR, LETRA_TEXTO } from '../tema';
import { BARRA, CAPITULOS, type Capitulo, DURACAO_LONGO, INICIO_FECHO, INICIOS, type Plano } from './capitulos';

const PASTA = 'clipes-longo';
const ECRA_W = 1320;
const ECRA_H = 2868;
/** Bezel as a share of the phone's width. */
const MOLDURA = 0.032;
/** Frames a chapter takes to come in and to leave (they overlap the neighbours). */
const ENTRA = 20;
const SAI = 16;
/** Slide between two shots of the same chapter. */
const FUNDE = 10;
/** The chapter leaves in its last frames, before the next one comes in: never two phones on screen. */
const SAIDA = 14;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * Layout. Vertical: title on top, the whole phone below. 4:5: text on the left, the whole phone on the right.
 * `telefoneW` is the outer width of the phone; its height follows from the screen's proportions.
 */
function useMedidas() {
  const { width, height } = useVideoConfig();
  const vertical = height / width > 1.5;
  const u = width / 1080;
  const telefoneW = vertical ? 560 : 540;
  const ecraW = telefoneW * (1 - 2 * MOLDURA);
  const telefoneH = (ecraW * ECRA_H) / ECRA_W + telefoneW * 2 * MOLDURA;
  return vertical
    ? { u, vertical, w: width, h: height, telefoneW, telefoneH, ecraW, telefoneX: (width - telefoneW) / 2, telefoneY: 660, texto: { x: 70, y: 140, w: width - 140, h: 480 }, titulo: 104, frase: 38, recorteW: 940 }
    : { u, vertical, w: width, h: height, telefoneW, telefoneH, ecraW, telefoneX: width - telefoneW - 50, telefoneY: (height - telefoneH) / 2 + 20, texto: { x: 64, y: 60, w: 400, h: height - 60 }, titulo: 82, frase: 31, recorteW: 560 };
}

function Fundo() {
  return (
    <AbsoluteFill style={{ background: COR.papel }}>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 55% at 50% 112%, rgba(28,138,77,0.24) 0%, rgba(28,138,77,0.07) 45%, rgba(248,247,242,0) 70%)' }} />
    </AbsoluteFill>
  );
}

function Progresso() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const a = interpolate(frame, [INICIOS[0] - 10, INICIOS[0] + 10, INICIO_FECHO - 10, INICIO_FECHO + 5], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', top: m.vertical ? 86 : 30, left: 70 * m.u, right: 70 * m.u, display: 'flex', gap: 8 * m.u, opacity: a }}>
      {CAPITULOS.map((c, i) => {
        const p = interpolate(frame, [INICIOS[i], INICIOS[i + 1]], [0, 1], clamp);
        return (
          <div key={c.numero} style={{ flex: 1, height: 6 * m.u, borderRadius: 3, background: 'rgba(19,36,27,0.12)', overflow: 'hidden' }}>
            <div style={{ width: `${p * 100}%`, height: '100%', background: COR.relva }} />
          </div>
        );
      })}
    </div>
  );
}

/** A recording, scaled by `k` and moved by (dx, dy) in capture pixels; plays `toca` seconds and holds. */
function Video({ plano, k, dx = 0, dy = 0 }: { plano: Plano; k: number; dx?: number; dy?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const max = Math.round(plano.toca * fps);
  return (
    <Freeze frame={max} active={frame > max}>
      <OffthreadVideo
        src={staticFile(`${PASTA}/${plano.clipe}`)}
        trimBefore={Math.round(plano.inicio * fps)}
        muted
        style={{ position: 'absolute', left: 0, top: 0, width: ECRA_W, height: ECRA_H, transformOrigin: '0 0', transform: `scale(${k}) translate(${-dx}px, ${-dy}px)` }}
      />
    </Freeze>
  );
}

/** A tap: a ring that grows and fades where the finger lands. */
function Toques({ plano, escala }: { plano: Plano; escala: number }) {
  const frame = useCurrentFrame();
  return (
    <>
      {(plano.toques ?? []).map((t) => {
        const p = interpolate(frame, [t.f - 4, t.f + 16], [0, 1], clamp);
        if (p <= 0 || p >= 1) return null;
        const tam = 90 + 110 * p;
        return (
          <div
            key={`${t.f}-${t.x}`}
            style={{
              position: 'absolute',
              left: t.x * escala - tam / 2,
              top: t.y * escala - tam / 2,
              width: tam,
              height: tam,
              borderRadius: '50%',
              background: 'rgba(19,36,27,0.22)',
              border: '5px solid rgba(255,255,255,0.95)',
              opacity: p < 0.2 ? p * 5 : 1 - (p - 0.2) / 0.8,
            }}
          />
        );
      })}
    </>
  );
}

/** A detail of the screen lifted out, bigger, over the place it comes from. */
function Recorte({ plano, regiao, legenda, de, ate }: { plano: Plano; regiao: Regiao; legenda: string; de: number; ate: number }) {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const e = useEntrada(de, 120, 15);
  const s = interpolate(frame, [ate - 10, ate], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  if (frame < de - 1 || frame > ate) return null;
  const largura = m.recorteW;
  const k = largura / regiao.w;
  const altura = regiao.h * k;
  const escalaEcra = m.ecraW / ECRA_W;
  const borda = m.telefoneW * MOLDURA;
  // Centred over its origin on the phone, kept inside the frame.
  const origemY = m.telefoneY + borda + (regiao.y + regiao.h / 2) * escalaEcra;
  const origemX = m.telefoneX + borda + (regiao.x + regiao.w / 2) * escalaEcra;
  const topo = Math.min(Math.max(origemY - altura / 2, 130), m.h - altura - 50);
  // 4:5: never over the text column on the left.
  const esquerda = m.vertical ? (m.w - largura) / 2 : Math.min(Math.max(origemX - largura / 2, m.texto.x + m.texto.w + 16), m.w - largura - 24);
  const v = e * (1 - s);
  return (
    <div
      style={{
        position: 'absolute',
        left: esquerda,
        top: topo,
        width: largura,
        opacity: Math.min(1, v * 1.4),
        transform: `translateY(${(1 - e) * 50 - s * 30}px) scale(${0.88 + 0.12 * e - 0.04 * s})`,
        transformOrigin: `${origemX - esquerda}px ${origemY - topo}px`,
      }}>
      <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%, -16px)', whiteSpace: 'nowrap', background: COR.amarelo, color: COR.tinta, fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 34 * m.u, padding: `${10 * m.u}px ${26 * m.u}px`, borderRadius: 999, boxShadow: '0 10px 24px rgba(19,36,27,0.15)' }}>
        {legenda}
      </div>
      <div style={{ position: 'relative', width: largura, height: altura, borderRadius: 28 * m.u, overflow: 'hidden', background: COR.branco, outline: `5px solid ${COR.amarelo}`, boxShadow: '0 50px 100px rgba(19,36,27,0.30), 0 10px 24px rgba(19,36,27,0.12)' }}>
        <Video plano={plano} k={k} dx={regiao.x} dy={regiao.y} />
      </div>
    </div>
  );
}

/** How much a crop is showing at this chapter frame (the phone steps back while one is). */
function foco(cap: Capitulo, frame: number) {
  let t = ENTRA;
  let f = 0;
  for (const p of cap.planos) {
    for (const r of p.recortes ?? []) {
      f = Math.max(f, interpolate(frame, [t + r.de, t + r.de + 12, t + r.ate - 10, t + r.ate], [0, 1, 1, 0], clamp));
    }
    t += p.duracao;
  }
  return f;
}

/** Where each shot starts inside the chapter (the first one is on screen from the chapter's first frame). */
function sequencias(cap: Capitulo) {
  let t = ENTRA;
  return cap.planos.map((p, i) => {
    const de = i === 0 ? 0 : t;
    const dur = p.duracao + (i === 0 ? ENTRA : 0) + (i === cap.planos.length - 1 ? SAI : FUNDE);
    const inicioReal = t;
    t += p.duracao;
    return { p, i, de, dur, inicioReal };
  });
}

/** The whole phone, with every shot of the chapter on its screen. Comes in turning, floats, and pushes in slowly. */
function Telefone({ cap }: { cap: Capitulo }) {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const duracao = cap.barras * BARRA + ENTRA + SAI;
  const fim = ENTRA + cap.barras * BARRA;
  const entra = useEntrada(ENTRA - 6, 70, 15);
  const sai = interpolate(frame, [fim - SAIDA, fim], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const f = foco(cap, frame);
  const deriva = interpolate(frame, [0, duracao], [0, 1], clamp);
  const flutua = Math.sin(frame / 40) * 7;
  const rodaY = (1 - entra) * -32 + interpolate(deriva, [0, 1], [-8, 6]) + sai * 28;
  const roda = (1 - entra) * 5 - sai * 4;
  const escala = (0.92 + 0.06 * deriva) * (1 - 0.05 * f);
  const y = (1 - entra) * 420 + flutua - sai * 100;
  const borda = m.telefoneW * MOLDURA;
  const raio = m.telefoneW * 0.15;
  return (
    <div
      style={{
        position: 'absolute',
        left: m.telefoneX,
        top: m.telefoneY,
        width: m.telefoneW,
        height: m.telefoneH,
        opacity: Math.min(entra * 1.6, 1) * (1 - sai),
        transform: `perspective(2400px) translateY(${y}px) rotateY(${rodaY}deg) rotateZ(${roda}deg) scale(${escala})`,
        filter: `brightness(${1 - 0.14 * f})`,
      }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: raio, background: '#0B0F0D', boxShadow: '0 0 0 3px #2B3530, 0 60px 120px rgba(19,36,27,0.35), 0 12px 30px rgba(19,36,27,0.18)' }} />
      <div style={{ position: 'absolute', left: borda, top: borda, width: m.ecraW, height: m.telefoneH - 2 * borda, borderRadius: raio - borda, overflow: 'hidden', background: COR.papel }}>
        {sequencias(cap).map(({ p, i, de, dur }) => (
          <Sequence key={`${p.clipe}-${p.inicio}`} from={de} durationInFrames={dur} layout="none">
            <EcraDoPlano plano={p} largura={m.ecraW} atraso={i === 0 ? ENTRA : 0} primeiro={i === 0} />
          </Sequence>
        ))}
      </div>
    </div>
  );
}

/** One shot on the phone's screen. `atraso` delays the clip so its timing (toca, toques) starts with the chapter. */
function EcraDoPlano({ plano, largura, atraso, primeiro }: { plano: Plano; largura: number; atraso: number; primeiro: boolean }) {
  const frame = useCurrentFrame();
  const a = primeiro ? 1 : interpolate(frame, [0, FUNDE], [0, 1], clamp);
  const x = primeiro ? 0 : interpolate(frame, [0, FUNDE + 8], [largura * 0.35, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const k = largura / ECRA_W;
  return (
    <AbsoluteFill style={{ opacity: a, transform: `translateX(${x}px)` }}>
      <Sequence from={atraso} layout="none">
        <Video plano={plano} k={k} />
        <Toques plano={plano} escala={k} />
      </Sequence>
      {atraso > 0 ? (
        <Freeze frame={0} active={frame < atraso}>
          <Video plano={plano} k={k} />
        </Freeze>
      ) : null}
    </AbsoluteFill>
  );
}

function Recortes({ cap }: { cap: Capitulo }) {
  return (
    <>
      {sequencias(cap).map(({ p, inicioReal }) => (
        <Sequence key={`r-${p.clipe}-${p.inicio}`} from={inicioReal} durationInFrames={p.duracao} layout="none">
          {(p.recortes ?? []).map((r) => (
            <Recorte key={r.legenda} plano={p} regiao={r.regiao} legenda={r.legenda} de={r.de} ate={Math.min(r.ate, p.duracao - SAIDA - 2)} />
          ))}
        </Sequence>
      ))}
    </>
  );
}

function Cabeca({ cap }: { cap: Capitulo }) {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const duracao = cap.barras * BARRA + ENTRA + SAI;
  const chip = useEntrada(ENTRA - 8, 140, 16);
  const frase = useEntrada(ENTRA + 16, 110, 18);
  const fim = ENTRA + cap.barras * BARRA;
  const sai = interpolate(frame, [fim - SAIDA, fim], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const palavras = cap.titulo.split(' ');
  const alinha = m.vertical ? 'center' : 'flex-start';
  return (
    <div
      style={{
        position: 'absolute',
        left: m.texto.x,
        top: m.texto.y,
        width: m.texto.w,
        height: m.texto.h,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: m.vertical ? 'flex-end' : 'center',
        alignItems: alinha,
        gap: 22 * m.u,
        textAlign: m.vertical ? 'center' : 'left',
        opacity: 1 - sai,
        transform: `translateY(${-sai * 40}px)`,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 * m.u, padding: `${8 * m.u}px ${20 * m.u}px ${8 * m.u}px ${10 * m.u}px`, borderRadius: 999, background: COR.branco, boxShadow: '0 8px 20px rgba(19,36,27,0.08)', opacity: chip, transform: `translateY(${(1 - chip) * 20}px)` }}>
        <div style={{ width: 44 * m.u, height: 44 * m.u, borderRadius: '50%', background: COR.amarelo, display: 'grid', placeItems: 'center' }}>
          <Icone nome={cap.icone} tamanho={28 * m.u} cor={COR.tinta} />
        </div>
        <span style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 26 * m.u, color: COR.tinta, letterSpacing: '0.06em' }}>
          {cap.numero} <span style={{ color: COR.tintaSuave, fontWeight: 700 }}>/ {String(CAPITULOS.length).padStart(2, '0')}</span>
        </span>
      </div>
      <Linha
        tamanho={m.titulo}
        alinhar={m.vertical ? 'center' : 'flex-start'}
        palavras={palavras.map((p, i) => ({ texto: p, de: ENTRA + i * 4, cor: i === palavras.length - 1 ? COR.relva : COR.tinta }))}
      />
      <p style={{ margin: 0, maxWidth: m.vertical ? 880 : 400, fontFamily: LETRA_TEXTO, fontWeight: 500, fontSize: m.frase, lineHeight: 1.32, color: COR.tintaSuave, opacity: frase, transform: `translateY(${(1 - frase) * 24}px)`, textWrap: 'balance' }}>
        {cap.frase}
      </p>
    </div>
  );
}

function Cena({ cap }: { cap: Capitulo }) {
  return (
    <AbsoluteFill>
      <Telefone cap={cap} />
      <Cabeca cap={cap} />
      <Recortes cap={cap} />
    </AbsoluteFill>
  );
}

function Intro() {
  const m = useMedidas();
  const frame = useCurrentFrame();
  const icone = useEntrada(0, 150, 13);
  const sai = interpolate(frame, [INICIOS[0] - SAI, INICIOS[0]], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const t = m.vertical ? 190 : 150;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 40 * m.u, opacity: 1 - sai, transform: `scale(${1 + sai * 0.08})`, filter: `blur(${sai * 8}px)` }}>
      <Img src={staticFile('icone.png')} style={{ width: 180 * m.u, height: 180 * m.u, borderRadius: '22.37%', boxShadow: '0 24px 60px rgba(19,36,27,0.25)', transform: `scale(${icone})` }} />
      <div>
        <Linha tamanho={t} palavras={[{ texto: 'O dia', de: 12 }, { texto: 'de jogo,', de: 22 }]} />
        <Linha tamanho={t} palavras={[{ texto: 'do princípio', de: 40 }]} />
        <Linha tamanho={t} palavras={[{ texto: 'ao', de: 55 }, { texto: 'fim.', de: 62, marcador: true }]} />
      </div>
    </AbsoluteFill>
  );
}

/** The full tour: intro, eleven chapters, end card. */
export function Longo() {
  const frame = useCurrentFrame();
  if (frame === 0) {
    return (
      <AbsoluteFill>
        <Fundo />
        <Freeze frame={80}>
          <Fecho />
        </Freeze>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Audio src={staticFile('musica-longo.wav')} />
      <Fundo />
      <Sequence durationInFrames={INICIOS[0] + 1}>
        <Intro />
      </Sequence>
      {CAPITULOS.map((cap, i) => (
        <Sequence key={cap.numero} from={INICIOS[i] - ENTRA} durationInFrames={cap.barras * BARRA + ENTRA + SAI}>
          <Cena cap={cap} />
        </Sequence>
      ))}
      <Progresso />
      <Sequence from={INICIO_FECHO}>
        <Fecho />
      </Sequence>
    </AbsoluteFill>
  );
}

export { DURACAO_LONGO };

/** One chapter on its own, for a Reel: a short lead-in, the chapter, and the end card. */
export const CAPITULO_FECHO = 150;
export const CAPITULO_ANTES = 24;
export function duracaoCapitulo(i: number) {
  return CAPITULO_ANTES + CAPITULOS[i].barras * BARRA + CAPITULO_FECHO;
}

/** The poster: the first lifted-out detail, settled. Without one, a moment in the middle of the chapter. */
function momentoCapa(cap: Capitulo) {
  let t = 0;
  for (const p of cap.planos) {
    const r = p.recortes?.[0];
    if (r) return t + Math.min(r.de + 26, r.ate - 12);
    t += p.duracao;
  }
  return Math.round((cap.barras * BARRA) / 2);
}

export function CapituloSolo({ indice }: { indice: number }) {
  const frame = useCurrentFrame();
  const cap = CAPITULOS[indice];
  const duracao = cap.barras * BARRA;
  const fim = CAPITULO_ANTES + duracao;
  const total = duracaoCapitulo(indice);
  const volume = interpolate(frame, [total - 30, total], [1, 0], clamp);
  if (frame === 0) {
    return (
      <AbsoluteFill>
        <Fundo />
        <Freeze frame={CAPITULO_ANTES + momentoCapa(cap)}>
          <Sequence from={CAPITULO_ANTES - ENTRA}>
            <Cena cap={cap} />
          </Sequence>
        </Freeze>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Audio src={staticFile('musica-longo.wav')} trimBefore={INICIOS[indice] - CAPITULO_ANTES} volume={volume} />
      <Fundo />
      <Sequence from={CAPITULO_ANTES - ENTRA} durationInFrames={duracao + ENTRA + SAI}>
        <Cena cap={cap} />
      </Sequence>
      <Sequence from={fim}>
        <Fecho />
      </Sequence>
    </AbsoluteFill>
  );
}
