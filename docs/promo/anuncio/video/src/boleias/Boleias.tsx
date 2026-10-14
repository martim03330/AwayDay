import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, Audio, Easing, Freeze, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { Balao, Icone, Linha, useEntrada } from '../componentes';
import { COR, LETRA_TEXTO, LETRA_TITULO } from '../tema';
import { TB } from './tempos';

/**
 * The rides ad (30 s), product motion design on a clean page: a dot becomes a question in the group chat, the map
 * draws the way to the stadium, «Boleia?», a tap, a green wipe, then floating cards (seats filling, the meeting point, the split),
 * the road with the car's chat, two lines of kinetic type and the end card. Everything shown is what the rides
 * feature really does; money appears once (the split per person).
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const suave = Easing.bezier(0.65, 0, 0.35, 1);

function useMedidas() {
  const { width, height } = useVideoConfig();
  const vertical = height / width > 1.5;
  return { w: width, h: height, cy: height / 2, vertical, k: vertical ? 1 : 0.74 };
}

/** A scene leaves in its last frames: up and blurred. */
function Cena({ duracao, children }: { duracao: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [duracao - 8, duracao], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return <AbsoluteFill style={{ opacity: 1 - s, transform: `translateY(${-s * 80}px) scale(${1 + s * 0.04})`, filter: `blur(${s * 10}px)` }}>{children}</AbsoluteFill>;
}

const sombra = '0 30px 70px rgba(19,36,27,0.16), 0 6px 16px rgba(19,36,27,0.06)';

function Avatar({ letra, cor, tamanho, estilo }: { letra: string; cor: string; tamanho: number; estilo?: CSSProperties }) {
  const claro = cor === COR.amarelo || cor === COR.branco;
  return (
    <div
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: '50%',
        background: cor,
        color: claro ? COR.tinta : COR.branco,
        display: 'grid',
        placeItems: 'center',
        fontFamily: LETRA_TEXTO,
        fontWeight: 800,
        fontSize: tamanho * 0.44,
        border: `${tamanho * 0.07}px solid ${COR.branco}`,
        boxSizing: 'border-box',
        ...estilo,
      }}>
      {letra}
    </div>
  );
}

const MALTA = [
  { letra: 'T', cor: COR.relva },
  { letra: 'R', cor: COR.amarelo },
  { letra: 'B', cor: COR.tinta },
  { letra: 'I', cor: COR.relvaEscura },
];

/** A side-view car, drawn flat. */
function Carro({ largura, cor = COR.amarelo }: { largura: number; cor?: string }) {
  return (
    <svg width={largura} height={(largura * 92) / 200} viewBox="0 0 200 92">
      <ellipse cx={100} cy={86} rx={88} ry={5} fill="rgba(19,36,27,0.18)" />
      <path d="M8 62Q9 42 38 39L60 17Q66 11 76 11H132Q143 11 151 19L170 38Q193 41 193 60V67Q193 72 188 72H13Q8 72 8 67Z" fill={cor} />
      <path d="M66 22Q70 18 76 18H100V39H48Z" fill="rgba(255,255,255,0.85)" />
      <path d="M107 18H131Q138 18 143 23L158 39H107Z" fill="rgba(255,255,255,0.85)" />
      <rect x={176} y={47} width={14} height={7} rx={3} fill={COR.branco} />
      <rect x={10} y={48} width={10} height={7} rx={3} fill={COR.braga} />
      {[50, 152].map((x) => (
        <g key={x}>
          <circle cx={x} cy={72} r={16} fill={COR.tinta} />
          <circle cx={x} cy={72} r={7} fill={COR.linha} />
        </g>
      ))}
    </svg>
  );
}

// --- The map: streets, parks, a river and the route, on a 1080 × 1920 sheet ----------------------------------------

const MAPA_W = 1080;
const MAPA_H = 1920;
const CASA = { x: 260, y: 1400 };
const ESTADIO = { x: 800, y: 520 };
const ROTA = [CASA, { x: 260, y: 1180 }, { x: 470, y: 1180 }, { x: 470, y: 960 }, { x: 640, y: 860 }, { x: 640, y: 700 }, { x: 800, y: 700 }, ESTADIO];
const ROTA_D = ROTA.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');
const TROCOS = ROTA.slice(1).map((p, i) => Math.hypot(p.x - ROTA[i].x, p.y - ROTA[i].y));
const ROTA_COMPRIMENTO = TROCOS.reduce((a, b) => a + b, 0);

/** The point (and heading, in degrees) at fraction `p` of the route. */
function naRota(p: number) {
  let falta = p * ROTA_COMPRIMENTO;
  for (let i = 0; i < TROCOS.length; i++) {
    if (falta <= TROCOS[i] || i === TROCOS.length - 1) {
      const t = Math.min(1, falta / TROCOS[i]);
      const a = ROTA[i];
      const b = ROTA[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angulo: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
    }
    falta -= TROCOS[i];
  }
  return { ...ESTADIO, angulo: -90 };
}

const RUAS_H = [180, 300, 420, 520, 700, 860, 1060, 1180, 1300, 1400, 1520, 1640, 1760];
const RUAS_V = [80, 160, 260, 360, 470, 560, 640, 800, 900, 1000];
const AVENIDAS = ['M0 960H1080', 'M470 960L640 860', 'M640 860L1080 600', 'M0 1560L360 1300', 'M800 0V1920'];
const PARQUES = [
  { x: 280, y: 1200, w: 170, h: 90 },
  { x: 660, y: 1080, w: 220, h: 200 },
  { x: 100, y: 440, w: 240, h: 240 },
  { x: 820, y: 1420, w: 170, h: 200 },
];

/** The map sheet, with the route drawn up to `tracado` (0–1) and an optional travelled part in dark green. */
function Mapa({ tracado, percorrido = 0, estadio = 1, luz = 0, extra }: { tracado: number; percorrido?: number; estadio?: number; luz?: number; extra?: ReactNode }) {
  const frame = useCurrentFrame();
  const pulso = (frame % 30) / 30;
  return (
    <svg width={MAPA_W} height={MAPA_H} viewBox={`0 0 ${MAPA_W} ${MAPA_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <rect width={MAPA_W} height={MAPA_H} fill="#EEEEE6" />
      <path d="M-40 760C200 700 300 820 520 760S880 600 1120 660" fill="none" stroke="#CFE3E6" strokeWidth={70} />
      {PARQUES.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={26} fill="rgba(28,138,77,0.16)" />
      ))}
      <g stroke={COR.branco} strokeLinecap="round">
        {RUAS_H.map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={MAPA_W} y2={y} strokeWidth={12} />
        ))}
        {RUAS_V.map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={MAPA_H} strokeWidth={12} />
        ))}
      </g>
      {AVENIDAS.map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke={COR.branco} strokeWidth={30} strokeLinecap="round" />
          <path d={d} fill="none" stroke="#F6E3A4" strokeWidth={14} strokeLinecap="round" />
        </g>
      ))}
      <path d={ROTA_D} fill="none" stroke="rgba(24,124,68,0.25)" strokeWidth={34} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={ROTA_COMPRIMENTO} strokeDashoffset={ROTA_COMPRIMENTO * (1 - tracado)} />
      <path d={ROTA_D} fill="none" stroke={COR.relva} strokeWidth={16} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={ROTA_COMPRIMENTO} strokeDashoffset={ROTA_COMPRIMENTO * (1 - tracado)} />
      <path d={ROTA_D} fill="none" stroke={COR.relvaEscura} strokeWidth={16} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={ROTA_COMPRIMENTO} strokeDashoffset={ROTA_COMPRIMENTO * (1 - percorrido)} />
      <circle cx={CASA.x} cy={CASA.y} r={30 + pulso * 40} fill={COR.relva} opacity={0.25 * (1 - pulso)} />
      <circle cx={CASA.x} cy={CASA.y} r={26} fill={COR.relva} stroke={COR.branco} strokeWidth={8} />
      {extra}
      <Estadio x={ESTADIO.x} y={ESTADIO.y} escala={0.75 * estadio} luz={luz} />
    </svg>
  );
}

/** A football stadium seen from above: the roof, the stands, the pitch and four floodlights (glowing with `luz`). */
function Estadio({ x, y, escala, luz }: { x: number; y: number; escala: number; luz: number }) {
  const listras = [-80, -48, -16, 16, 48];
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`} opacity={Math.min(1, escala * 3)}>
      <ellipse rx={158} ry={118} cy={10} fill="rgba(19,36,27,0.18)" />
      <ellipse rx={155} ry={112} fill={COR.tinta} />
      <ellipse rx={142} ry={100} fill={COR.relvaEscura} />
      <ellipse rx={118} ry={80} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={36} strokeDasharray="5 9" />
      <rect x={-84} y={-52} width={168} height={104} rx={8} fill={COR.relva} />
      {listras.map((lx) => (
        <rect key={lx} x={lx + 4} y={-52} width={16} height={104} fill={COR.relvaClara} />
      ))}
      <g fill="none" stroke={COR.branco} strokeWidth={3}>
        <rect x={-76} y={-44} width={152} height={88} rx={2} />
        <line x1={0} y1={-44} x2={0} y2={44} />
        <circle r={15} />
        <rect x={-76} y={-22} width={22} height={44} />
        <rect x={54} y={-22} width={22} height={44} />
      </g>
      {[[-128, -86], [128, -86], [-128, 86], [128, 86]].map(([fx, fy]) => (
        <g key={`${fx}${fy}`} transform={`translate(${fx} ${fy})`}>
          <circle r={46} fill={COR.amarelo} opacity={0.22 * luz} />
          <circle r={26} fill={COR.amarelo} opacity={0.45 * luz} />
          <circle r={13} fill={COR.tinta} stroke={COR.branco} strokeWidth={3} />
          <circle r={7} fill={COR.amarelo} />
        </g>
      ))}
    </g>
  );
}

/** The map sheet seen by a camera: the point (fx, fy) of the sheet lands at the screen centre, at scale `s`. */
function Camara({ fx, fy, s, children }: { fx: number; fy: number; s: number; children: ReactNode }) {
  const m = useMedidas();
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: MAPA_W, height: MAPA_H, transformOrigin: '0 0', transform: `translate(${m.w / 2 - fx * s}px, ${m.cy - fy * s}px) scale(${s})` }}>
      {children}
    </div>
  );
}

/** A floating pill over the map. */
function Pilula({ de, estilo, children }: { de: number; estilo: CSSProperties; children: ReactNode }) {
  const e = useEntrada(de, 180, 14);
  return (
    <div
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        background: COR.branco,
        borderRadius: 999,
        padding: '22px 34px 22px 24px',
        boxShadow: sombra,
        fontFamily: LETRA_TEXTO,
        fontWeight: 800,
        fontSize: 38,
        color: COR.tinta,
        opacity: Math.min(1, e * 1.5),
        transform: `translateY(${(1 - e) * 60}px) scale(${0.85 + 0.15 * e})`,
        ...estilo,
      }}>
      {children}
    </div>
  );
}

// --- 1. The question -------------------------------------------------------------------------------------------------

const PERGUNTA = 'Alguém vai ao jogo de sábado?';

function Pergunta() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const ponto = useEntrada(2, 200, 12);
  const forma = interpolate(frame, [16, 32], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const letras = Math.round(interpolate(frame, [30, 62], [0, PERGUNTA.length], clamp));
  const saida = interpolate(frame, [100, 120], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const bw = 900 * m.k + 60;
  const bh = 150 * m.k + 20;
  const largura = 64 + forma * (bw - 64);
  const altura = 64 + forma * (bh - 64);
  const topo = m.cy - 150 * m.k;
  const anel = frame < 22 ? (frame % 22) / 22 : 1;
  return (
    <AbsoluteFill style={{ opacity: 1 - saida * 0.999, transform: `scale(${1 - saida * 0.9})`, transformOrigin: `${m.w / 2}px ${m.cy}px`, filter: `blur(${saida * 6}px)` }}>
      <div
        style={{
          position: 'absolute',
          left: m.w / 2 - 64 * (1 + anel * 1.6) / 2,
          top: topo + bh / 2 - (64 * (1 + anel * 1.6)) / 2,
          width: 64 * (1 + anel * 1.6),
          height: 64 * (1 + anel * 1.6),
          borderRadius: '50%',
          background: COR.relva,
          opacity: 0.3 * (1 - anel),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: m.w / 2 - largura / 2,
          top: topo + bh / 2 - altura / 2,
          width: largura,
          height: altura,
          borderRadius: 999 * (1 - forma) + 60 * m.k * forma,
          borderBottomRightRadius: 999 * (1 - forma) + 14 * forma,
          background: COR.relva,
          transform: `scale(${ponto})`,
          boxShadow: '0 30px 70px rgba(24,124,68,0.30)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <span style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 62 * m.k, color: COR.branco, whiteSpace: 'nowrap' }}>
          {PERGUNTA.slice(0, letras)}
          <span style={{ opacity: frame < 66 && frame >= 28 && Math.floor(frame / 6) % 2 === 0 ? 1 : 0 }}>|</span>
        </span>
      </div>
      <div style={{ position: 'absolute', left: m.w / 2 - bw / 2, width: bw, top: topo + bh + 60 * m.k }}>
        <Balao nome="Tiago" iniciais="T" texto="Eu vou de carro. Há lugar!" de={84} tamanho={50 * m.k} />
      </div>
    </AbsoluteFill>
  );
}

// --- 2. The map, and 3. «Boleia?» ------------------------------------------------------------------------------------

/** The map from the drop to the blob (frames TB.mapa..TB.bolha): the camera pulls back while the route draws. */
function MapaComCamara() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const abre = interpolate(frame, [0, 18], [0, Math.hypot(m.w, m.h)], { ...clamp, easing: Easing.out(Easing.cubic) });
  const recua = interpolate(frame, [12, 80], [0, 1], { ...clamp, easing: suave });
  const tracado = interpolate(frame, [18, 74], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const estadio = useEntrada(70, 220, 11);
  const fundo = interpolate(frame, [TB.carro - TB.mapa, TB.carro - TB.mapa + 16], [0, 1], clamp);
  const s = (1.7 - 0.7 * recua) * (m.vertical ? 1 : 0.86);
  return (
    <AbsoluteFill style={{ clipPath: `circle(${abre}px at ${m.w / 2}px ${m.cy}px)` }}>
      <div style={{ position: 'absolute', inset: 0, filter: `blur(${fundo * 8}px)`, transform: `scale(${1 + fundo * 0.04})` }}>
        <Camara fx={CASA.x + (540 - CASA.x) * recua} fy={CASA.y + (960 - CASA.y) * recua} s={s}>
          <Mapa tracado={tracado} estadio={estadio} />
        </Camara>
      </div>
      <AbsoluteFill style={{ background: COR.papel, opacity: fundo * 0.45 }} />
    </AbsoluteFill>
  );
}

function SobreOMapa() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const km = Math.round(interpolate(frame, [20, 74], [0, 287], { ...clamp, easing: Easing.inOut(Easing.quad) }));
  return (
    <Cena duracao={TB.carro - TB.mapa}>
      <Pilula de={14} estilo={{ left: 60, top: m.h * (m.vertical ? 0.1 : 0.06) }}>
        <Icone nome="bola" tamanho={48} />
        Sábado · 20:30
      </Pilula>
      <Pilula de={24} estilo={{ right: 60, bottom: m.h * (m.vertical ? 0.1 : 0.06) }}>
        <Icone nome="carro" tamanho={48} />
        <span style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 60, lineHeight: 1, minWidth: 150, textAlign: 'right' }}>{km} km</span>
        <span style={{ color: COR.tintaSuave, fontWeight: 700, fontSize: 32 }}>até ao estádio</span>
      </Pilula>
    </Cena>
  );
}

/** Where the «Pedir lugar» button sits on screen (the blob grows out of it). */
function useBotao() {
  const m = useMedidas();
  return { x: m.w / 2 - 210 * m.k, y: m.cy + 190 * m.k };
}

function Boleia() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const e = useEntrada(0, 120, 14);
  const carro = useEntrada(10, 160, 12);
  const flutua = Math.sin(frame / 18) * 8;
  const cursor = interpolate(frame, [30, 48], [0, 1], { ...clamp, easing: suave });
  const carrega = frame >= 50 && frame < 56;
  const enviado = frame >= 54;
  const onda = interpolate(frame, [52, 72], [0, 1], clamp);
  const aceite = useEntrada(70, 240, 12);
  const botao = useBotao();
  const k = m.k;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: m.w / 2 - 440 * k,
          top: m.cy - 300 * k,
          width: 880 * k,
          height: 600 * k,
          opacity: Math.min(1, e * 1.4),
          transform: `perspective(1800px) translateY(${(1 - e) * 500 + flutua}px) rotateX(${8 + (1 - e) * 30}deg) rotateY(${-12 + (1 - e) * 10}deg) rotateZ(${-2 * (1 - e)}deg)`,
        }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 56 * k, background: `linear-gradient(150deg, ${COR.relvaClara}, ${COR.relvaEscura})`, boxShadow: '0 50px 100px rgba(14,85,48,0.35)' }} />
        <div style={{ position: 'absolute', left: 60 * k, top: 64 * k, fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 150 * k, lineHeight: 0.9, color: COR.branco, textTransform: 'uppercase' }}>Boleia?</div>
        <div style={{ position: 'absolute', left: 64 * k, top: 220 * k, display: 'flex', alignItems: 'center', gap: 16 * k }}>
          <Avatar letra="T" cor={COR.amarelo} tamanho={70 * k} />
          <div style={{ fontFamily: LETRA_TEXTO, color: COR.branco }}>
            <div style={{ fontWeight: 800, fontSize: 38 * k }}>Tiago · Condutor</div>
            <div style={{ fontWeight: 600, fontSize: 30 * k, opacity: 0.8 }}>3 lugares livres · ida e volta</div>
          </div>
        </div>
        <div style={{ position: 'absolute', right: -90 * k, top: -70 * k, transform: `translateX(${(1 - carro) * 260}px) rotate(${(1 - carro) * 8}deg)`, opacity: Math.min(1, carro * 2) }}>
          <Carro largura={480 * k} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 60 * k,
            bottom: 60 * k,
            padding: `${30 * k}px ${54 * k}px`,
            borderRadius: 999,
            background: enviado ? COR.amarelo : COR.branco,
            color: COR.tinta,
            fontFamily: LETRA_TEXTO,
            fontWeight: 800,
            fontSize: 44 * k,
            transform: `scale(${carrega ? 0.93 : 1})`,
            boxShadow: '0 16px 40px rgba(0,0,0,0.20)',
            overflow: 'hidden',
          }}>
          <div style={{ position: 'absolute', left: '30%', top: '50%', width: 600 * k * onda, height: 600 * k * onda, marginLeft: -300 * k * onda, marginTop: -300 * k * onda, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', opacity: 1 - onda }} />
          <span style={{ position: 'relative' }}>{enviado ? 'Pedido enviado' : 'Pedir lugar'}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            right: 60 * k,
            bottom: 64 * k,
            display: 'flex',
            alignItems: 'center',
            gap: 12 * k,
            padding: `${18 * k}px ${30 * k}px`,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.16)',
            color: COR.branco,
            fontFamily: LETRA_TEXTO,
            fontWeight: 800,
            fontSize: 36 * k,
            opacity: aceite,
            transform: `scale(${0.6 + 0.4 * aceite})`,
          }}>
          <svg width={40 * k} height={40 * k} viewBox="0 0 24 24" fill="none" stroke={COR.amarelo} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Tens lugar
        </div>
      </div>
      {frame >= 28 && frame < 64 ? (
        <div
          style={{
            position: 'absolute',
            left: m.w * 0.8 + (botao.x - m.w * 0.8) * cursor,
            top: m.h * 0.86 + (botao.y - m.h * 0.86) * cursor,
            width: 70 * k,
            height: 70 * k,
            marginLeft: -35 * k,
            marginTop: -35 * k,
            borderRadius: '50%',
            background: 'rgba(19,36,27,0.28)',
            border: `${5 * k}px solid ${COR.branco}`,
            transform: `scale(${carrega ? 0.8 : 1})`,
            opacity: interpolate(frame, [28, 34, 58, 64], [0, 1, 1, 0], clamp),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
}

// --- 4. The green wipe -----------------------------------------------------------------------------------------------------

/** Frames the green takes to cover the screen (the map and the card stay underneath until then). */
const COBRE = 22;

function Bolha() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const botao = useBotao();
  const cobre = Math.hypot(m.w, m.h) * 1.05;
  const r = interpolate(frame, [0, COBRE], [0, cobre], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: botao.x - r, top: botao.y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: VERDE }} />
    </AbsoluteFill>
  );
}

const VERDE = `radial-gradient(circle at 50% 45%, ${COR.relvaClara}, ${COR.relva} 55%, ${COR.relvaEscura})`;

/** The green opens from the centre like an iris, a light rim on its edge, revealing the cards. */
function Iris() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const cobre = Math.hypot(m.w, m.h) * 0.6;
  const r = interpolate(frame, [0, 18], [0, cobre], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (r >= cobre) return null;
  const furo = `radial-gradient(circle at ${m.w / 2}px ${m.cy}px, transparent ${r}px, black ${r + 1}px)`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: VERDE, WebkitMaskImage: furo, maskImage: furo }} />
      <div style={{ position: 'absolute', left: m.w / 2 - r - 4, top: m.cy - r - 4, width: (r + 4) * 2, height: (r + 4) * 2, borderRadius: '50%', border: `8px solid rgba(255,206,58,${0.8 * (1 - r / cobre)})`, boxSizing: 'border-box' }} />
    </AbsoluteFill>
  );
}

// --- 5. The cards ----------------------------------------------------------------------------------------------------

/** A white card that springs out of the drop at the centre to its place in the floating stack. */
function Cartao({ de, x, y, largura, altura, destaque = false, children }: { de: number; x: number; y: number; largura: number; altura: number; destaque?: boolean; children: ReactNode }) {
  const m = useMedidas();
  const e = useEntrada(de, 150, 14);
  return (
    <div
      style={{
        position: 'absolute',
        left: m.w / 2 + (x - largura / 2) * e - (largura / 2) * (1 - e),
        top: m.cy + (y - altura / 2) * e - (altura / 2) * (1 - e),
        width: largura,
        height: altura,
        borderRadius: 48,
        background: destaque ? COR.amarelo : COR.branco,
        boxShadow: destaque ? '0 40px 90px rgba(255,206,58,0.45)' : sombra,
        opacity: Math.min(1, e * 2),
        transform: `scale(${0.3 + 0.7 * e})`,
        padding: 44,
        boxSizing: 'border-box',
        fontFamily: LETRA_TEXTO,
        color: COR.tinta,
      }}>
      {children}
    </div>
  );
}

function Titulo({ children, direita }: { children: ReactNode; direita?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontWeight: 800, fontSize: 40 }}>{children}</div>
      {direita}
    </div>
  );
}

const LUGARES = [30, 45, 60]; // frames (in the cards scene) when the three free seats fill: on the beat

function Cartoes() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const ocupados = 1 + LUGARES.filter((f) => frame >= f).length;
  const pino = useEntrada(88, 220, 10);
  const centimos = Math.round(interpolate(frame, [124, 156], [0, 1240], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const valor = `${Math.floor(centimos / 100)},${String(centimos % 100).padStart(2, '0')} €`;
  const roda = interpolate(frame, [0, 180], [-18, -6]);
  return (
    <Cena duracao={TB.caminho - TB.cartoes}>
      <AbsoluteFill style={{ transform: `scale(${m.k}) perspective(2200px) rotateX(10deg) rotateY(${roda}deg) translateY(${Math.sin(frame / 20) * 10}px)`, transformOrigin: `${m.w / 2}px ${m.cy}px` }}>
        <Cartao de={4} x={-60} y={-500} largura={720} altura={400}>
          <Titulo direita={<span style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 72, color: COR.relva }}>{ocupados}/4</span>}>Lugares</Titulo>
          <div style={{ marginTop: 26, height: 210, borderRadius: 90, background: COR.papel, border: `4px solid ${COR.linha}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'center', justifyItems: 'center', padding: '0 20px' }}>
            {MALTA.map((p, i) => {
              const s = i === 0 ? 1 : interpolateSpring(frame, LUGARES[i - 1]);
              return (
                <div key={p.letra} style={{ position: 'relative', width: 120, height: 120, borderRadius: 30, border: `4px dashed ${COR.linha}`, display: 'grid', placeItems: 'center' }}>
                  <Avatar letra={p.letra} cor={p.cor} tamanho={112} estilo={{ position: 'absolute', transform: `scale(${s})`, opacity: Math.min(1, s * 2) }} />
                </div>
              );
            })}
          </div>
        </Cartao>
        <Cartao de={74} x={120} y={-20} largura={720} altura={380}>
          <Titulo>Ponto de encontro</Titulo>
          <div style={{ position: 'relative', marginTop: 24, height: 150, borderRadius: 30, overflow: 'hidden', background: '#EEEEE6' }}>
            <svg width="100%" height="100%" viewBox="0 0 632 150" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
              <g stroke={COR.branco} strokeWidth={10}>
                {[40, 110].map((y) => <line key={y} x1={0} y1={y} x2={632} y2={y} />)}
                {[90, 250, 420, 560].map((x) => <line key={x} x1={x} y1={0} x2={x} y2={150} />)}
              </g>
              <path d="M0 150L632 20" stroke="#F6E3A4" strokeWidth={14} />
              <rect x={440} y={60} width={90} height={60} rx={14} fill="rgba(28,138,77,0.18)" />
            </svg>
            <div style={{ position: 'absolute', left: 290, top: 75 - 70 + (1 - pino) * -80, opacity: Math.min(1, pino * 2), transformOrigin: '50% 100%' }}>
              <svg width={56} height={70} viewBox="0 0 24 30">
                <path d="M12 29s9-9.2 9-16a9 9 0 1 0-18 0c0 6.8 9 16 9 16z" fill={COR.relva} stroke={COR.branco} strokeWidth={2} />
                <circle cx={12} cy={12} r={3.5} fill={COR.branco} />
              </svg>
            </div>
          </div>
          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', fontSize: 34 }}>
            <span style={{ fontWeight: 700 }}>Bombas da saída 3</span>
            <span style={{ fontWeight: 800, color: COR.relva }}>17:30</span>
          </div>
        </Cartao>
        <Cartao de={118} x={-40} y={450} largura={720} altura={380} destaque>
          <Titulo>A dividir por todos</Titulo>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 18 }}>
            <span style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 170, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
            <span style={{ fontWeight: 800, fontSize: 36 }}>cada</span>
          </div>
          <div style={{ marginTop: 18, display: 'flex' }}>
            {MALTA.map((p, i) => (
              <Avatar key={p.letra} letra={p.letra} cor={p.cor === COR.amarelo ? COR.branco : p.cor} tamanho={76} estilo={{ marginLeft: i ? -16 : 0 }} />
            ))}
            <span style={{ marginLeft: 22, alignSelf: 'center', fontWeight: 700, fontSize: 30, whiteSpace: 'nowrap' }}>combustível e portagens</span>
          </div>
        </Cartao>
      </AbsoluteFill>
      <Iris />
    </Cena>
  );
}

/** Spring value for a seat filling at frame `de` (a plain function, so it can run inside a map). */
function interpolateSpring(frame: number, de: number) {
  const t = frame - de;
  if (t <= 0) return 0;
  return 1 - Math.exp(-t / 3.2) * Math.cos(t / 2.4);
}

// --- 6. On the road --------------------------------------------------------------------------------------------------

/** The three passengers, each walking along the streets from home to the car (the meeting point, at CASA). */
const PASSAGEIROS = [
  { ...MALTA[1], chega: 36, caminho: [{ x: 80, y: 1640 }, { x: 80, y: 1520 }, { x: 260, y: 1520 }, CASA] },
  { ...MALTA[2], chega: 48, caminho: [{ x: 640, y: 1640 }, { x: 640, y: 1520 }, { x: 360, y: 1520 }, { x: 360, y: 1400 }, CASA] },
  { ...MALTA[3], chega: 60, caminho: [{ x: 80, y: 1180 }, { x: 80, y: 1300 }, { x: 160, y: 1300 }, { x: 160, y: 1400 }, CASA] },
];
const PARTE = 72; // the car leaves once it is full
const CHEGA = 146; // and parks by the stadium
const ACENDE = 132; // the stadium grows and its floodlights come on
const P_FIM = 1 - 150 / ROTA_COMPRIMENTO; // stop at the stadium's edge, not on the pitch

function noCaminho(pontos: { x: number; y: number }[], p: number) {
  const trocos = pontos.slice(1).map((b, i) => Math.hypot(b.x - pontos[i].x, b.y - pontos[i].y));
  let falta = p * trocos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < trocos.length; i++) {
    if (falta <= trocos[i] || i === trocos.length - 1) {
      const t = Math.min(1, falta / trocos[i]);
      return { x: pontos[i].x + (pontos[i + 1].x - pontos[i].x) * t, y: pontos[i].y + (pontos[i + 1].y - pontos[i].y) * t };
    }
    falta -= trocos[i];
  }
  return pontos[pontos.length - 1];
}

/** The car seen from above, pointing up. */
function CarroDeCima({ tamanho }: { tamanho: number }) {
  return (
    <svg width={tamanho} height={tamanho * 1.7} viewBox="0 0 40 68">
      <rect x={2} y={2} width={36} height={64} rx={12} fill={COR.amarelo} stroke={COR.branco} strokeWidth={3} />
      <path d="M8 20Q20 13 32 20L30 28H10Z" fill={COR.tinta} opacity={0.75} />
      <path d="M10 50H30L32 56Q20 61 8 56Z" fill={COR.tinta} opacity={0.55} />
      <rect x={9} y={30} width={22} height={17} rx={4} fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}

function Caminho() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const k = m.k;
  const entra = interpolate(frame, [0, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const p = interpolate(frame, [PARTE, CHEGA], [0, P_FIM], { ...clamp, easing: suave });
  const carro = naRota(p);
  const dentro = 1 + PASSAGEIROS.filter((q) => frame >= q.chega).length;
  const salto = PASSAGEIROS.reduce((a, q) => a + (frame >= q.chega ? Math.exp(-(frame - q.chega) / 4) * Math.sin((frame - q.chega) / 1.5) : 0), 0);
  const cresce = useEntrada(ACENDE, 140, 10);
  const luz = interpolate(frame, [ACENDE + 4, ACENDE + 10, ACENDE + 14, ACENDE + 22], [0, 1, 0.5, 1], clamp);
  // The camera: wide on the neighbourhood while everyone walks to the car, then it follows the car, then it settles on the stadium.
  const segue = interpolate(frame, [PARTE - 10, PARTE + 16], [0, 1], { ...clamp, easing: suave });
  const final = interpolate(frame, [ACENDE - 6, CHEGA + 10], [0, 1], { ...clamp, easing: suave });
  const bairro = { x: 440, y: 1250 };
  const alvo = { x: carro.x + (ESTADIO.x - carro.x) * final, y: carro.y + (ESTADIO.y + 70 - carro.y) * final };
  const fx = bairro.x + (alvo.x - bairro.x) * segue;
  const fy = bairro.y + (alvo.y - bairro.y) * segue;
  const s = (m.vertical ? 1.45 : 1.25) + (m.vertical ? 0.3 : 0.25) * segue + 0.25 * final;
  const trilhos = (
    <g>
      {PASSAGEIROS.map((q) => (
        <path
          key={q.letra}
          d={q.caminho.map((pt, i) => `${i ? 'L' : 'M'}${pt.x} ${pt.y}`).join('')}
          fill="none"
          stroke={q.cor === COR.amarelo ? '#D9A915' : q.cor}
          strokeWidth={9}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="1 20"
          opacity={interpolate(frame, [4, 12, q.chega, q.chega + 8], [0, 0.8, 0.8, 0], clamp)}
        />
      ))}
    </g>
  );
  return (
    <Cena duracao={TB.frases - TB.caminho}>
      <AbsoluteFill style={{ clipPath: `circle(${entra * Math.hypot(m.w, m.h)}px at ${m.w / 2}px ${m.cy}px)` }}>
        <Camara fx={fx} fy={fy} s={s}>
          <Mapa tracado={1} percorrido={p} estadio={1 + 0.5 * cresce} luz={luz} extra={trilhos} />
          {PASSAGEIROS.map((q, i) => {
            const anda = interpolate(frame, [6 + i * 4, q.chega], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
            const pt = noCaminho(q.caminho, anda);
            const some = interpolate(frame, [q.chega - 3, q.chega + 2], [1, 0], clamp);
            const aparece = interpolate(frame, [4 + i * 4, 12 + i * 4], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
            const passo = Math.abs(Math.sin(frame / 3 + i)) * 6 * (anda > 0 && anda < 1 ? 1 : 0);
            return (
              <Avatar key={q.letra} letra={q.letra} cor={q.cor} tamanho={64} estilo={{ position: 'absolute', left: pt.x - 32, top: pt.y - 32 - passo, transform: `scale(${aparece * some})`, boxShadow: '0 8px 20px rgba(19,36,27,0.3)' }} />
            );
          })}
          <div style={{ position: 'absolute', left: carro.x - 30, top: carro.y - 51, width: 60, height: 102, transform: `rotate(${carro.angulo + 90}deg) scale(${1 + salto * 0.12})`, filter: 'drop-shadow(0 10px 14px rgba(19,36,27,0.35))' }}>
            <CarroDeCima tamanho={60} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: carro.x - 50,
              top: carro.y - 120,
              width: 100,
              textAlign: 'center',
              fontFamily: LETRA_TITULO,
              fontWeight: 900,
              fontSize: 40,
              color: COR.branco,
              background: COR.relvaEscura,
              borderRadius: 999,
              padding: '4px 0',
              opacity: interpolate(frame, [8, 14, PARTE + 6, PARTE + 14], [0, 1, 1, 0], clamp),
              transform: `scale(${1 + salto * 0.15})`,
            }}>
            {dentro}/4
          </div>
        </Camara>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 60 * k + (m.vertical ? 0 : 40),
          right: 60 * k + (m.vertical ? 0 : 40),
          top: m.h * (m.vertical ? 0.07 : 0.04),
          background: 'rgba(248,247,242,0.94)',
          borderRadius: 48 * k,
          padding: `${30 * k}px ${34 * k}px ${36 * k}px`,
          boxShadow: sombra,
          display: 'flex',
          flexDirection: 'column',
          gap: 22 * k,
          opacity: interpolate(frame, [PARTE, PARTE + 10, ACENDE - 8, ACENDE], [0, 1, 1, 0], clamp),
          transform: `translateY(${interpolate(frame, [PARTE, PARTE + 14], [-60, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px)`,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 * k, fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 36 * k, color: COR.tinta }}>
          <Icone nome="carro" tamanho={44 * k} />
          Conversa do carro
        </div>
        <Balao nome="Rita" iniciais="R" texto="Levo cachecóis para todos." de={PARTE + 14} tamanho={36 * k} />
        <Balao nome="Bruno" iniciais="B" texto="Paramos para um café?" de={PARTE + 36} tamanho={36 * k} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: m.w / 2 - 330,
          width: 660,
          bottom: m.h * (m.vertical ? 0.07 : 0.04),
          background: COR.relva,
          borderRadius: 999,
          padding: '20px 26px',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          boxShadow: '0 30px 60px rgba(14,85,48,0.35)',
          opacity: interpolate(frame, [14, 24], [0, 1], clamp),
          transform: `translateY(${interpolate(frame, [14, 28], [80, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px)`,
        }}>
        <div style={{ display: 'flex' }}>
          {MALTA.map((pessoa, i) => (
            <Avatar
              key={pessoa.letra}
              letra={pessoa.letra}
              cor={pessoa.cor === COR.relva ? COR.amarelo : pessoa.cor}
              tamanho={70}
              estilo={{ marginLeft: i ? -14 : 0, borderColor: COR.relva, opacity: i < dentro ? 1 : 0.3 }}
            />
          ))}
        </div>
        <div style={{ fontFamily: LETRA_TEXTO, color: COR.branco }}>
          <div style={{ fontWeight: 800, fontSize: 36 }}>{frame >= CHEGA ? 'Chegámos ao estádio' : frame >= PARTE ? 'A caminho do jogo' : 'A ir ter ao carro'}</div>
          <div style={{ fontWeight: 600, fontSize: 28, opacity: 0.85 }}>{dentro === 4 ? 'Carro cheio · 4/4' : `${dentro}/4 no carro`}</div>
        </div>
      </div>
    </Cena>
  );
}

// --- 7. Kinetic type -------------------------------------------------------------------------------------------------

function Frases() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const tamanho = m.vertical ? 210 : 170;
  const sai = interpolate(frame, [50, 58], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <Cena duracao={TB.fecho - TB.frases}>
      {frame < 58 ? (
        <AbsoluteFill style={{ justifyContent: 'center', opacity: 1 - sai, transform: `translateX(${-sai * 200}px)`, filter: `blur(${sai * 12}px)` }}>
          <Linha tamanho={tamanho} palavras={[{ texto: 'Ninguém', de: 2 }, { texto: 'fica', de: 9 }]} />
          <Linha tamanho={tamanho} palavras={[{ texto: 'em', de: 16 }, { texto: 'casa.', de: 20, cor: COR.relva }]} />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ justifyContent: 'center' }}>
          <Linha tamanho={tamanho * 1.15} palavras={[{ texto: 'Vamos', de: 60 }]} />
          <Linha tamanho={tamanho * 1.15} palavras={[{ texto: 'juntos.', de: 68, cor: COR.relva, marcador: true }]} />
        </AbsoluteFill>
      )}
    </Cena>
  );
}

// --- 8. End card -----------------------------------------------------------------------------------------------------

function FechoBoleias() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const onda = interpolate(frame, [0, 12], [0, Math.hypot(m.w, m.h)], { ...clamp, easing: Easing.out(Easing.cubic) });
  const icone = useEntrada(6, 170, 11);
  const carro = useEntrada(26, 160, 13);
  const botao = useEntrada(40, 180, 13);
  const tamIcone = m.vertical ? 260 : 200;
  const titulo = m.vertical ? 190 : 150;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: m.w / 2 - onda,
          top: m.cy - onda,
          width: onda * 2,
          height: onda * 2,
          borderRadius: '50%',
          background: `repeating-linear-gradient(90deg, ${COR.relva} 0 ${m.w / 8}px, ${COR.relvaClara} ${m.w / 8}px ${m.w / 4}px)`,
          backgroundAttachment: 'fixed',
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 30 }}>
        <Img src={staticFile('icone.png')} style={{ width: tamIcone, height: tamIcone, borderRadius: '22.37%', boxShadow: '0 30px 70px rgba(0,0,0,0.35)', transform: `scale(${icone}) rotate(${(1 - icone) * -20}deg)` }} />
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 34, letterSpacing: '0.18em', color: COR.amarelo, opacity: icone }}>AWAYDAY</div>
        <div>
          <Linha tamanho={titulo} cor={COR.branco} palavras={[{ texto: 'Boleias', de: 14 }]} />
          <Linha tamanho={titulo} cor={COR.amarelo} palavras={[{ texto: 'para', de: 19 }, { texto: 'a', de: 21 }, { texto: 'bola.', de: 24 }]} />
        </div>
        <div style={{ height: 110, transform: `translateX(${(1 - carro) * -m.w}px)` }}>
          <Carro largura={240} />
        </div>
        <div
          style={{
            padding: '26px 64px',
            borderRadius: 999,
            background: COR.amarelo,
            color: COR.tinta,
            fontFamily: LETRA_TEXTO,
            fontWeight: 800,
            fontSize: 46,
            opacity: Math.min(1, botao * 1.4),
            transform: `scale(${0.7 + 0.3 * botao})`,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          }}>
          Descarrega grátis
        </div>
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 32, color: 'rgba(255,255,255,0.88)', opacity: botao }}>Oferece lugar ou pede o teu.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// --- The whole ad ----------------------------------------------------------------------------------------------------

export function Boleias() {
  const frame = useCurrentFrame();
  const fundo = <AbsoluteFill style={{ background: COR.papel }} />;
  // Frame 0 is the poster: the settled end card.
  if (frame === 0) {
    return (
      <AbsoluteFill>
        {fundo}
        <Freeze frame={90}>
          <FechoBoleias />
        </Freeze>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Audio src={staticFile('musica-boleias.wav')} />
      {fundo}
      <Sequence from={TB.pergunta} durationInFrames={TB.mapa - TB.pergunta}>
        <Pergunta />
      </Sequence>
      <Sequence from={TB.mapa} durationInFrames={TB.bolha - TB.mapa + COBRE}>
        <MapaComCamara />
      </Sequence>
      <Sequence from={TB.mapa} durationInFrames={TB.carro - TB.mapa}>
        <SobreOMapa />
      </Sequence>
      <Sequence from={TB.carro} durationInFrames={TB.bolha - TB.carro + COBRE}>
        <Boleia />
      </Sequence>
      <Sequence from={TB.bolha} durationInFrames={TB.cartoes - TB.bolha}>
        <Bolha />
      </Sequence>
      <Sequence from={TB.cartoes} durationInFrames={TB.caminho - TB.cartoes}>
        <Cartoes />
      </Sequence>
      <Sequence from={TB.caminho} durationInFrames={TB.frases - TB.caminho}>
        <Caminho />
      </Sequence>
      <Sequence from={TB.frases} durationInFrames={TB.fecho - TB.frases}>
        <Frases />
      </Sequence>
      <Sequence from={TB.fecho}>
        <FechoBoleias />
      </Sequence>
    </AbsoluteFill>
  );
}

