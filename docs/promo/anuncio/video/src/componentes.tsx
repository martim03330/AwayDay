import type { CSSProperties, ReactNode } from 'react';
import {
  Easing,
  Freeze,
  Img,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { COR, LETRA_TEXTO, LETRA_TITULO } from './tema';

/** Spring that starts at frame `de` (0 before it, settles at 1). */
export function useEntrada(de: number, rigidez = 140, amortecimento = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - de, fps, config: { stiffness: rigidez, damping: amortecimento, mass: 0.8 } });
}

// --- Icons: the app's own "Relvado" set (src/ui/icon.tsx), 24 px grid, 2 px stroke --------------------------------

const circulo = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const retangulo = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}` +
  `h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

const ICONES = {
  bola: [circulo(12, 12, 9), 'M12 7.6l3.7 2.7-1.4 4.4H9.7l-1.4-4.4z', 'M12 3v4.6M20.6 9.6l-4.9.7M17.3 19.2l-3-4.5M6.7 19.2l3-4.5M3.4 9.6l4.9.7'],
  carro: ['M5 10l1.5-3.7A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.3L19 10', retangulo(3, 10, 18, 8, 2), 'M7 14h.01M17 14h.01M5 18v2M19 18v2'],
  tasco: ['M5 9h10v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z', 'M15 11.5h2a2.5 2.5 0 0 1 0 5h-2', 'M5.5 9C5 6.8 6.6 5.2 8.5 5.6 9.4 3.9 12.3 3.8 13.2 5.6c1.8-.2 2.8 1.6 2 3.4'],
  euro: [circulo(12, 12, 9), 'M15.5 8.6a4.5 4.5 0 1 0 0 6.8M7 10.8h6M7 13.2h6'],
  ranking: ['M7 4h10v5a5 5 0 0 1-10 0z', 'M7 6H4.5a2.8 2.8 0 0 0 2.8 3.8M17 6h2.5a2.8 2.8 0 0 1-2.8 3.8M12 14v3.5M8 21h8M9.5 21v-3.5h5V21'],
} as const;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome, tamanho, cor = COR.relva, estilo }: { nome: NomeIcone; tamanho: number; cor?: string; estilo?: CSSProperties }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={estilo}>
      {ICONES[nome].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// --- Kinetic words ------------------------------------------------------------------------------------------------

export type Palavra = { texto: ReactNode; de: number; cor?: string; marcador?: boolean };

/** One line of words that pop in one by one; a `marcador` word gets a yellow highlighter swiped under it. */
export function Linha({ palavras, tamanho, peso = 900, cor = COR.tinta, espaco = 0.22, alinhar = 'center' }: { palavras: Palavra[]; tamanho: number; peso?: number; cor?: string; espaco?: number; alinhar?: 'center' | 'flex-start' }) {
  return (
    <div style={{ display: 'flex', justifyContent: alinhar, alignItems: 'baseline', flexWrap: 'wrap', columnGap: tamanho * espaco, rowGap: tamanho * 0.06 }}>
      {palavras.map((p, i) => (
        <PalavraAnimada key={i} p={p} tamanho={tamanho} peso={peso} cor={p.cor ?? cor} />
      ))}
    </div>
  );
}

function PalavraAnimada({ p, tamanho, peso, cor }: { p: Palavra; tamanho: number; peso: number; cor: string }) {
  const frame = useCurrentFrame();
  const e = useEntrada(p.de, 220, 15);
  const marcador = interpolate(frame, [p.de + 4, p.de + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        fontFamily: LETRA_TITULO,
        fontWeight: peso,
        fontSize: tamanho,
        lineHeight: 1,
        textTransform: 'uppercase',
        color: cor,
        opacity: Math.min(1, e * 1.5),
        transform: `translateY(${(1 - e) * tamanho * 0.45}px) scale(${0.85 + 0.15 * e})`,
        transformOrigin: '50% 80%',
      }}>
      {p.marcador ? (
        <span
          style={{
            position: 'absolute',
            left: '-4%',
            right: '-4%',
            bottom: '6%',
            height: '42%',
            background: COR.amarelo,
            borderRadius: tamanho * 0.08,
            transform: `scaleX(${marcador}) skewX(-8deg)`,
            transformOrigin: 'left center',
            zIndex: 0,
          }}
        />
      ) : null}
      <span style={{ position: 'relative', zIndex: 1 }}>{p.texto}</span>
    </span>
  );
}

// --- A real recording, framed like a floating card, with a camera that moves over it ------------------------------

/** Where the camera looks: a region of the 1320 × 2868 recording (top-left and width), from frame `f`. */
export type Plano = { f: number; x: number; y: number; w: number };
export type Toque = { f: number; x: number; y: number };
export type Realce = { de: number; ate: number; x: number; y: number; w: number; h: number };

const ECRA_W = 1320;
const ECRA_H = 2868;
const suave = Easing.bezier(0.65, 0, 0.35, 1);

export function Gravacao({
  clipe,
  inicio,
  largura,
  altura,
  planos,
  toques = [],
  realces = [],
  raio = 44,
}: {
  clipe: string;
  /** Seconds into the clip at this component's frame 0. */
  inicio: number;
  largura: number;
  altura: number;
  planos: Plano[];
  toques?: Toque[];
  realces?: Realce[];
  raio?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fs = planos.map((p) => p.f);
  const valor = (k: 'x' | 'y' | 'w') =>
    planos.length === 1 ? planos[0][k] : interpolate(frame, fs, planos.map((p) => p[k]), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave });
  const w = valor('w');
  const escala = largura / w;
  const x = valor('x');
  const y = valor('y');
  const ponto = (px: number, py: number) => ({ left: (px - x) * escala, top: (py - y) * escala });

  return (
    <div
      style={{
        position: 'relative',
        width: largura,
        height: altura,
        borderRadius: raio,
        overflow: 'hidden',
        background: COR.papel,
        boxShadow: '0 40px 90px rgba(19, 36, 27, 0.22), 0 6px 18px rgba(19, 36, 27, 0.10)',
      }}>
      <OffthreadVideo
        src={staticFile(`clipes/${clipe}`)}
        trimBefore={Math.round(inicio * fps)}
        muted
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: ECRA_W,
          height: ECRA_H,
          transformOrigin: '0 0',
          transform: `scale(${escala}) translate(${-x}px, ${-y}px)`,
        }}
      />
      {realces.map((r, i) => {
        const a = interpolate(frame, [r.de, r.de + 8, r.ate - 6, r.ate], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const p = ponto(r.x, r.y);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...p,
              width: r.w * escala,
              height: r.h * escala,
              borderRadius: 18 * escala,
              border: `${Math.max(4, 7 * escala)}px solid ${COR.amarelo}`,
              boxShadow: `0 0 0 ${10 * escala}px rgba(255, 206, 58, 0.25)`,
              opacity: a,
              transform: `scale(${0.92 + 0.08 * a})`,
            }}
          />
        );
      })}
      {toques.map((t, i) => {
        const prog = interpolate(frame, [t.f - 4, t.f + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        if (prog <= 0 || prog >= 1) return null;
        const p = ponto(t.x, t.y);
        const tam = 90 + 80 * prog;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.left - tam / 2,
              top: p.top - tam / 2,
              width: tam,
              height: tam,
              borderRadius: '50%',
              background: 'rgba(19, 36, 27, 0.18)',
              border: '3px solid rgba(255, 255, 255, 0.9)',
              opacity: prog < 0.25 ? prog * 4 : 1 - (prog - 0.25) / 0.75,
            }}
          />
        );
      })}
    </div>
  );
}

// --- Chat bubble, styled like the app's group chat ----------------------------------------------------------------

export function Balao({ nome, iniciais, texto, de, tamanho, meu = false }: { nome: string; iniciais: string; texto: string; de: number; tamanho: number; meu?: boolean }) {
  const frame = useCurrentFrame();
  const e = useEntrada(de, 200, 16);
  const pontos = frame >= de - 10 && frame < de;
  return (
    <div style={{ display: 'flex', gap: tamanho * 0.4, alignItems: 'flex-end', flexDirection: meu ? 'row-reverse' : 'row' }}>
      <div
        style={{
          width: tamanho * 1.9,
          height: tamanho * 1.9,
          flex: 'none',
          borderRadius: '50%',
          background: COR.linha,
          color: COR.tintaSuave,
          display: 'grid',
          placeItems: 'center',
          fontFamily: LETRA_TEXTO,
          fontWeight: 800,
          fontSize: tamanho * 0.7,
          opacity: pontos || e > 0.01 ? 1 : 0,
        }}>
        {iniciais}
      </div>
      {pontos ? (
        <div style={{ background: COR.branco, borderRadius: tamanho * 0.9, padding: `${tamanho * 0.55}px ${tamanho * 0.8}px`, display: 'flex', gap: tamanho * 0.25, boxShadow: '0 10px 30px rgba(19,36,27,0.08)' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: tamanho * 0.32, height: tamanho * 0.32, borderRadius: '50%', background: COR.tintaSuave, opacity: 0.35 + 0.65 * Math.abs(Math.sin((frame + i * 4) / 4)) }} />
          ))}
        </div>
      ) : (
        <div
          style={{
            maxWidth: tamanho * 15,
            background: meu ? COR.relva : COR.branco,
            color: meu ? COR.branco : COR.tinta,
            borderRadius: tamanho * 0.9,
            borderBottomLeftRadius: meu ? tamanho * 0.9 : tamanho * 0.25,
            borderBottomRightRadius: meu ? tamanho * 0.25 : tamanho * 0.9,
            padding: `${tamanho * 0.6}px ${tamanho * 0.8}px`,
            boxShadow: '0 18px 40px rgba(19, 36, 27, 0.10)',
            opacity: e,
            transform: `translateY(${(1 - e) * 40}px) scale(${0.8 + 0.2 * e})`,
            transformOrigin: meu ? '100% 100%' : '0 100%',
          }}>
          {meu ? null : <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: tamanho * 0.62, color: COR.relva, marginBottom: tamanho * 0.15 }}>{nome}</div>}
          <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 500, fontSize: tamanho, lineHeight: 1.3 }}>{texto}</div>
        </div>
      )}
    </div>
  );
}

// --- The passport stamp (as in the app's passport: dashed ring, stadium name, date) -------------------------------

export function Carimbo({ tamanho, cor, nome, data }: { tamanho: number; cor: string; nome: string; data: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="92" fill="rgba(255,255,255,0.9)" stroke={cor} strokeWidth="9" />
      <circle cx="100" cy="100" r="76" fill="none" stroke={cor} strokeWidth="3.5" strokeDasharray="9 7" />
      <text x="100" y="104" textAnchor="middle" fontFamily={LETRA_TITULO} fontWeight={900} fontSize="52" fill={cor} transform="rotate(-8 100 100)">
        {nome}
      </text>
      <text x="100" y="134" textAnchor="middle" fontFamily={LETRA_TEXTO} fontWeight={800} fontSize="17" letterSpacing="2" fill={cor}>
        {data}
      </text>
    </svg>
  );
}

// --- Full-width recording and the enlarged detail ------------------------------------------------------------------
//
// The screen is always shown at its full width (only the camera moves up and down), so text is never cut at the
// sides; the bottom fades into the page. The detail that matters is lifted out as an exact crop of the same
// recording (`Recorte`), measured on the 1320 × 2868 capture.

export type Regiao = { x: number; y: number; w: number; h: number };

/** `y` is the top of the visible window, in capture pixels: a number, or keyframes [{ f, y }]. */
export function Ecra({ pasta = 'clipes', clipe, inicio, largura, altura, y, raio = 44, sombra = true, max }: {
  pasta?: string;
  /** Frames of clip available; past them the last one holds. */
  max?: number;
  clipe: string;
  inicio: number;
  largura: number;
  altura: number;
  y: number | { f: number; y: number }[];
  raio?: number;
  sombra?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const escala = largura / ECRA_W;
  const topo = typeof y === 'number' ? y : y.length === 1 ? y[0].y : interpolate(frame, y.map((k) => k.f), y.map((k) => k.y), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: suave });
  return (
    <div
      style={{
        position: 'relative',
        width: largura,
        height: altura,
        borderRadius: raio,
        overflow: 'hidden',
        background: COR.papel,
        boxShadow: sombra ? '0 40px 90px rgba(19, 36, 27, 0.20), 0 6px 18px rgba(19, 36, 27, 0.08)' : undefined,
        WebkitMaskImage: 'linear-gradient(180deg, #000 78%, rgba(0,0,0,0) 100%)',
        maskImage: 'linear-gradient(180deg, #000 78%, rgba(0,0,0,0) 100%)',
      }}>
      <Freeze frame={max ?? 0} active={max !== undefined && frame > max}>
        <OffthreadVideo
          src={staticFile(`${pasta}/${clipe}`)}
          trimBefore={Math.round(inicio * fps)}
          muted
          style={{ position: 'absolute', left: 0, top: 0, width: ECRA_W, height: ECRA_H, transformOrigin: '0 0', transform: `scale(${escala}) translateY(${-topo}px)` }}
        />
      </Freeze>
    </div>
  );
}

/** An exact crop of the recording, lifted out as a card: springs in at `de`, leaves at `ate`. */
/** Height of a crop shown at `largura`. */
export const alturaRecorte = (regiao: Regiao, largura: number) => (regiao.h * largura) / regiao.w;

/**
 * Where to put a crop so it grows out of its own place on the screen: the screen card's top, its width, the
 * screen's `y` (top of the visible window) and the crop's size. Returns the top for the crop's wrapper.
 */
export function topoSobreOrigem(topoCartao: number, larguraCartao: number, yEcra: number, regiao: Regiao, larguraRecorte: number) {
  const centro = topoCartao + (regiao.y + regiao.h / 2 - yEcra) * (larguraCartao / ECRA_W);
  return centro - alturaRecorte(regiao, larguraRecorte) / 2;
}

export function Recorte({ pasta = 'clipes', clipe, inicio, regiao, largura, de, ate, legenda, max }: {
  pasta?: string;
  max?: number;
  clipe: string;
  inicio: number;
  regiao: Regiao;
  largura: number;
  de: number;
  ate: number;
  legenda?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = useEntrada(de, 130, 15);
  const s = interpolate(frame, [ate - 8, ate], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  if (frame < de - 1 || frame > ate) return null;
  const k = largura / regiao.w;
  const altura = regiao.h * k;
  const v = e * (1 - s);
  return (
    <div style={{ position: 'relative', opacity: Math.min(1, v * 1.4), transform: `translateY(${(1 - e) * 40 + s * -30}px) scale(${0.9 + 0.1 * e - 0.04 * s})` }}>
      {legenda ? (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translate(-50%, -18px)', whiteSpace: 'nowrap', background: COR.amarelo, color: COR.tinta, fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 34, padding: '10px 26px', borderRadius: 999, boxShadow: '0 10px 24px rgba(19,36,27,0.15)' }}>
          {legenda}
        </div>
      ) : null}
      <div
        style={{
          position: 'relative',
          width: largura,
          height: altura,
          borderRadius: 30,
          overflow: 'hidden',
          background: COR.branco,
          outline: `5px solid ${COR.amarelo}`,
          boxShadow: '0 50px 100px rgba(19, 36, 27, 0.30), 0 10px 24px rgba(19, 36, 27, 0.12)',
        }}>
        <Freeze frame={max ?? 0} active={max !== undefined && frame > max}>
          <OffthreadVideo
            src={staticFile(`${pasta}/${clipe}`)}
            trimBefore={Math.round(inicio * fps)}
            muted
            style={{ position: 'absolute', left: 0, top: 0, width: ECRA_W, height: ECRA_H, transformOrigin: '0 0', transform: `scale(${k}) translate(${-regiao.x}px, ${-regiao.y}px)` }}
          />
        </Freeze>
      </div>
    </div>
  );
}

// --- The whole phone ------------------------------------------------------------------------------------------------

/** Bezel as a share of the phone's width. */
export const MOLDURA_TELEFONE = 0.032;

/** Outer height of a whole phone of outer width `largura` (screen 1320 × 2868). */
export const alturaTelefone = (largura: number) => {
  const ecra = largura * (1 - 2 * MOLDURA_TELEFONE);
  return (ecra * ECRA_H) / ECRA_W + largura * 2 * MOLDURA_TELEFONE;
};

/**
 * A whole phone with a recording (`clipe`, held after `toca` seconds) or a still (`imagem`) on its screen. The
 * screen's content gets the scale `k` (capture pixels → screen pixels) through `filhos`, for overlays.
 */
export function TelefoneInteiro({ largura, clipe, imagem, inicio = 0, toca = 0, filhos }: {
  largura: number;
  clipe?: string;
  imagem?: string;
  inicio?: number;
  toca?: number;
  filhos?: (k: number) => ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const borda = largura * MOLDURA_TELEFONE;
  const ecraW = largura - 2 * borda;
  const altura = alturaTelefone(largura);
  const raio = largura * 0.15;
  const k = ecraW / ECRA_W;
  const max = Math.round(toca * fps);
  return (
    <div style={{ position: 'relative', width: largura, height: altura }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: raio, background: '#0B0F0D', boxShadow: '0 0 0 3px #2B3530, 0 60px 120px rgba(19,36,27,0.35), 0 12px 30px rgba(19,36,27,0.18)' }} />
      <div style={{ position: 'absolute', left: borda, top: borda, width: ecraW, height: altura - 2 * borda, borderRadius: raio - borda, overflow: 'hidden', background: COR.papel }}>
        {clipe ? (
          <Freeze frame={max} active={frame > max}>
            <OffthreadVideo
              src={staticFile(clipe)}
              trimBefore={Math.round(inicio * fps)}
              muted
              style={{ position: 'absolute', left: 0, top: 0, width: ECRA_W, height: ECRA_H, transformOrigin: '0 0', transform: `scale(${k})` }}
            />
          </Freeze>
        ) : null}
        {imagem ? <Img src={staticFile(imagem)} style={{ position: 'absolute', left: 0, top: 0, width: ecraW, height: (ecraW * ECRA_H) / ECRA_W }} /> : null}
        {filhos ? filhos(k) : null}
      </div>
    </div>
  );
}
