import type { ReactNode } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Freeze,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { Carimbo, Icone, Linha, type Palavra, TelefoneInteiro, alturaTelefone, useEntrada } from './componentes';
import { COR, LETRA_TEXTO, LETRA_TITULO } from './tema';
import { T } from './tempos';

/**
 * The short ad (25 s). Football from the first frame (the pitch, the ball, «Jogo fora no sábado?»), then what only AwayDay does, one big
 * claim per scene with the real app beside it: the ride split to the cent, the tasco live, the debts done, the
 * stamp that only counts if you were there, and the memory of the trip.
 */

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Sizes for the two formats: vertical (9:16) and the 4:5 feed. */
function useMedidas() {
  const { width, height } = useVideoConfig();
  const vertical = height / width > 1.5;
  const u = width / 1080;
  return vertical
    ? { u, vertical, w: width, h: height, titulo: 230, cabeca: 118, cabecaTopo: 200, cabecaAltura: 400, telefoneW: 470, telefoneX: 50, telefoneY: 660, ladoX: 560, ladoW: 480, numero: 128, balao: 50 }
    : { u, vertical, w: width, h: height, titulo: 190, cabeca: 92, cabecaTopo: 50, cabecaAltura: 300, telefoneW: 360, telefoneX: 60, telefoneY: 400, ladoX: 470, ladoW: 560, numero: 112, balao: 40 };
}

function Fundo() {
  const frame = useCurrentFrame();
  const naBatida = frame >= T.acabou && frame < T.memoria;
  const pulso = naBatida ? Math.exp(-((frame - T.acabou) % 15) / 4) : 0;
  return (
    <AbsoluteFill style={{ background: COR.papel }}>
      <AbsoluteFill
        style={{ background: `radial-gradient(120% 55% at 50% 110%, rgba(28, 138, 77, ${0.26 + 0.07 * pulso}) 0%, rgba(28, 138, 77, 0.08) 45%, rgba(248, 247, 242, 0) 70%)` }}
      />
    </AbsoluteFill>
  );
}

/** A scene leaves in its last frames: up and blurred, so the next cut lands on a clean stage. */
function Cena({ duracao, children }: { duracao: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [duracao - 8, duracao], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return <AbsoluteFill style={{ opacity: 1 - s, transform: `translateY(${-s * 80}px) scale(${1 + s * 0.04})`, filter: `blur(${s * 10}px)` }}>{children}</AbsoluteFill>;
}

/** The headline of a scene: words pop in one by one, the last ones in green. */
function Cabeca({ linhas }: { linhas: Palavra[][] }) {
  const m = useMedidas();
  return (
    <div style={{ position: 'absolute', left: 50 * m.u, right: 50 * m.u, top: m.cabecaTopo, height: m.cabecaAltura, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: m.cabeca * 0.04 }}>
      {linhas.map((palavras, i) => (
        <Linha key={i} tamanho={m.cabeca} palavras={palavras} />
      ))}
    </div>
  );
}

/** The whole phone, coming in from the side turning, then floating. */
function Telefone(props: Parameters<typeof TelefoneInteiro>[0] & { de?: number }) {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const e = useEntrada(props.de ?? 4, 90, 14);
  const flutua = Math.sin(frame / 22) * 6;
  return (
    <div
      style={{
        position: 'absolute',
        left: m.telefoneX,
        top: m.telefoneY,
        opacity: Math.min(1, e * 1.6),
        transform: `perspective(2200px) translateX(${(1 - e) * -260}px) translateY(${flutua}px) rotateY(${(1 - e) * 35 + 8}deg) rotateZ(${(1 - e) * -6 - 2}deg)`,
        transformOrigin: '30% 50%',
      }}>
      <TelefoneInteiro {...props} />
    </div>
  );
}

/** The column beside the phone, vertically centred on it. */
function Lado({ children }: { children: ReactNode }) {
  const m = useMedidas();
  const altura = alturaTelefone(m.telefoneW);
  return (
    <div style={{ position: 'absolute', left: m.ladoX, width: m.ladoW, top: m.telefoneY, height: altura, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 * m.u }}>
      {children}
    </div>
  );
}

/** A big number card that springs in. */
function Numero({ de, valor, legenda, destaque = false }: { de: number; valor: ReactNode; legenda: string; destaque?: boolean }) {
  const m = useMedidas();
  const e = useEntrada(de, 200, 14);
  return (
    <div
      style={{
        background: destaque ? COR.amarelo : COR.branco,
        borderRadius: 28 * m.u,
        padding: `${20 * m.u}px ${28 * m.u}px`,
        boxShadow: destaque ? '0 24px 60px rgba(255,206,58,0.45)' : '0 18px 44px rgba(19,36,27,0.10)',
        opacity: Math.min(1, e * 1.5),
        transform: `translateX(${(1 - e) * 120}px) scale(${0.8 + 0.2 * e})`,
        transformOrigin: 'left center',
      }}>
      <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * (destaque ? 1.08 : 0.82), lineHeight: 1, color: destaque ? COR.tinta : COR.relva, whiteSpace: 'nowrap' }}>{valor}</div>
      <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 28 * m.u, color: destaque ? COR.tinta : COR.tintaSuave, marginTop: 6 * m.u }}>{legenda}</div>
    </div>
  );
}

// --- 1. Football, from the first frame -----------------------------------------------------------------------------

/** The pitch: mown stripes, and the halfway line and centre circle drawing themselves in. */
function Relvado({ de = 0 }: { de?: number }) {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const linhas = interpolate(frame, [de, de + 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const r = m.w * 0.3;
  const perimetro = 2 * Math.PI * r;
  return (
    <AbsoluteFill style={{ background: `repeating-linear-gradient(90deg, ${COR.relva} 0 ${m.w / 8}px, ${COR.relvaClara} ${m.w / 8}px ${m.w / 4}px)` }}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={8 * m.u}>
          <line x1={0} y1={m.h / 2} x2={m.w * linhas} y2={m.h / 2} />
          <circle cx={m.w / 2} cy={m.h / 2} r={r} strokeDasharray={perimetro} strokeDashoffset={perimetro * (1 - linhas)} transform={`rotate(-90 ${m.w / 2} ${m.h / 2})`} />
        </g>
        <circle cx={m.w / 2} cy={m.h / 2} r={12 * m.u} fill="rgba(255,255,255,0.5)" opacity={linhas} />
      </svg>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(14,85,48,0) 45%, rgba(14,85,48,0.55) 100%)' }} />
    </AbsoluteFill>
  );
}

/** The app's ball, rolling in from the left and stopping on the centre spot. */
function Bola({ de }: { de: number }) {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const t = interpolate(frame, [de, de + 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tam = m.w * 0.24;
  const x = -tam + (m.w / 2 + tam / 2) * t;
  const salto = Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * 160 * m.u;
  return (
    <div style={{ position: 'absolute', left: x - tam / 2, top: m.h / 2 - tam / 2 - salto, width: tam, height: tam, borderRadius: '50%', background: COR.branco, display: 'grid', placeItems: 'center', boxShadow: '0 30px 60px rgba(0,0,0,0.3)', transform: `rotate(${t * 540}deg)` }}>
      <Icone nome="bola" tamanho={tam * 0.9} cor={COR.tinta} />
    </div>
  );
}

/** What the group asks before every away game, popping up around the ball. */
const PERGUNTAS = [
  { texto: 'Quem leva o carro?', x: 0.05, y: 0.63, roda: -5, de: 28 },
  { texto: 'Onde comemos antes?', x: 0.3, y: 0.71, roda: 4, de: 36 },
  { texto: 'Quem paga o quê?', x: 0.1, y: 0.79, roda: -3, de: 44 },
];

function Caos() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const zoom = interpolate(frame, [0, 75], [1, 1.06], clamp);
  const abana = frame > 58 ? Math.sin(frame * 2.7) * (frame - 58) * 0.9 : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${abana}px) scale(${zoom})` }}>
      <Relvado />
      <Bola de={0} />
      <div style={{ position: 'absolute', left: 60 * m.u, right: 60 * m.u, top: m.vertical ? 230 : 70 }}>
        <Linha tamanho={m.titulo * 0.82} cor={COR.branco} palavras={[{ texto: 'Jogo', de: 2 }, { texto: 'fora', de: 7 }]} />
        <Linha tamanho={m.titulo * 0.82} cor={COR.amarelo} palavras={[{ texto: 'no', de: 12 }, { texto: 'sábado?', de: 16 }]} />
      </div>
      {PERGUNTAS.map((p) => (
        <Pergunta key={p.texto} {...p} />
      ))}
    </AbsoluteFill>
  );
}

function Pergunta({ texto, x, y, roda, de }: { texto: string; x: number; y: number; roda: number; de: number }) {
  const m = useMedidas();
  const e = useEntrada(de, 240, 13);
  return (
    <div
      style={{
        position: 'absolute',
        left: x * m.w,
        top: y * m.h,
        background: COR.branco,
        color: COR.tinta,
        borderRadius: 30 * m.u,
        borderBottomLeftRadius: 8 * m.u,
        padding: `${18 * m.u}px ${28 * m.u}px`,
        fontFamily: LETRA_TEXTO,
        fontWeight: 800,
        fontSize: (m.vertical ? 54 : 40) * m.u,
        whiteSpace: 'nowrap',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        opacity: Math.min(1, e * 1.6),
        transform: `rotate(${roda}deg) scale(${0.5 + 0.5 * e})`,
        transformOrigin: '0 100%',
      }}>
      {texto}
    </div>
  );
}

// --- 2. On the drop: what AwayDay is ---------------------------------------------------------------------------------

function Acabou() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const flash = interpolate(frame, [0, 6], [1, 0], clamp);
  const icone = interpolate(frame, [0, 6], [1.6, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const tamIcone = (m.vertical ? 220 : 170) * m.u;
  return (
    <Cena duracao={T.boleia - T.acabou}>
      <Relvado de={-60} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 30 * m.u }}>
        <Img src={staticFile('icone.png')} style={{ width: tamIcone, height: tamIcone, borderRadius: '22.37%', boxShadow: '0 30px 70px rgba(0,0,0,0.35)', transform: `scale(${icone})` }} />
        <div style={{ textAlign: 'center' }}>
          <Linha tamanho={m.cabeca * 1.05} cor={COR.branco} palavras={[{ texto: 'A', de: 1 }, { texto: 'app', de: 2 }, { texto: 'de', de: 3 }, { texto: 'quem', de: 4 }]} />
          <Linha tamanho={m.cabeca * 1.05} cor={COR.amarelo} palavras={[{ texto: 'vai', de: 6 }, { texto: 'à', de: 7 }, { texto: 'bola.', de: 8 }]} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: COR.branco, opacity: flash }} />
    </Cena>
  );
}

// --- 3. The ride, to the cent (the only money scene) -----------------------------------------------------------

function Boleia() {
  return (
    <Cena duracao={T.tasco - T.boleia}>
      <Cabeca linhas={[[{ texto: 'Boleia', de: 0 }, { texto: 'ao', de: 4 }, { texto: 'cêntimo.', de: 8, cor: COR.relva }]]} />
      <Telefone largura={useMedidas().telefoneW} clipe="clipes-longo/05-boleias.mp4" inicio={4.3} />
      <Lado>
        <Numero de={18} valor="143,52 €" legenda="combustível e portagens" />
        <Numero de={32} valor="÷ 4" legenda="quem vai no carro" />
        <Numero de={46} valor="35,88 €" legenda="cada um" destaque />
      </Lado>
    </Cena>
  );
}

// --- 4. The tasco, live ---------------------------------------------------------------------------------------------

function Tasco() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const n = Math.round(interpolate(frame, [18, 56], [0, 27], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const e = useEntrada(16, 160, 14);
  return (
    <Cena duracao={T.carimbos - T.tasco}>
      <Cabeca linhas={[[{ texto: 'O', de: 0 }, { texto: 'tasco,', de: 4 }, { texto: 'ao', de: 8, cor: COR.relva }, { texto: 'vivo.', de: 12, cor: COR.relva }]]} />
      <Telefone largura={m.telefoneW} clipe="clipes-longo/10-tasco.mp4" inicio={0.4} />
      <Lado>
        <div style={{ opacity: Math.min(1, e * 1.5), transform: `scale(${0.7 + 0.3 * e})`, transformOrigin: 'left center' }}>
          <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * 2.4, lineHeight: 0.9, color: COR.relva, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
          <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * 0.5, lineHeight: 1, textTransform: 'uppercase', color: COR.tinta }}>pessoas lá agora</div>
        </div>
      </Lado>
    </Cena>
  );
}

// --- 5. Stamps raining onto the passport ----------------------------------------------------------------------------

const CARIMBOS = [
  { nome: 'LUZ', cor: '#D8262E', data: '17·08·26', roda: -12 },
  { nome: 'DRAGÃO', cor: '#1D4E9E', data: '30·08·26', roda: 8 },
  { nome: 'ALVALADE', cor: '#187C44', data: '13·09·26', roda: -5 },
  { nome: 'BRAGA', cor: '#B3202A', data: '09·10·26', roda: 10 },
  { nome: 'LENS', cor: '#B07A00', data: '13·10·26', roda: -9 },
  { nome: 'FUNCHAL', cor: '#13241B', data: '01·11·26', roda: 6 },
];

/** One stamp that drops from above, hits, rings with ink, and settles a little crooked. */
function CarimboQueCai({ de, nome, cor, data, roda, tamanho }: { de: number; nome: string; cor: string; data: string; roda: number; tamanho: number }) {
  const frame = useCurrentFrame() - de;
  if (frame < 0) return <div style={{ width: tamanho, height: tamanho }} />;
  const queda = interpolate(frame, [0, 5], [2.4, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const ressalto = frame >= 5 ? 1 + 0.07 * Math.exp(-(frame - 5) / 3) * Math.cos((frame - 5) * 1.7) : queda;
  const tinta = interpolate(frame, [5, 16], [0, 1], clamp);
  return (
    <div style={{ position: 'relative', width: tamanho, height: tamanho, display: 'grid', placeItems: 'center' }}>
      {[...Array(8)].map((_, i) => {
        const ang = (i / 8) * Math.PI * 2 + roda;
        const dist = tamanho * (0.42 + 0.22 * tinta);
        return (
          <div key={i} style={{ position: 'absolute', width: 10 + (i % 3) * 5, height: 10 + (i % 3) * 5, borderRadius: '50%', background: cor, opacity: frame >= 5 ? (1 - tinta) * 0.7 : 0, transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)` }} />
        );
      })}
      <div style={{ transform: `scale(${ressalto}) rotate(${roda}deg)`, opacity: interpolate(frame, [0, 2], [0, 1], clamp), filter: `drop-shadow(0 12px 24px ${cor}40)` }}>
        <Carimbo tamanho={tamanho} cor={cor} nome={nome} data={data} />
      </div>
    </div>
  );
}

function Carimbos() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const passo = 10;
  const inicio = 14;
  const caidos = CARIMBOS.filter((_, i) => frame >= inicio + i * passo + 5).length;
  // The page shakes a little on every hit.
  const desde = (frame - inicio) % passo;
  const abanao = frame >= inicio && frame < inicio + CARIMBOS.length * passo && desde >= 5 && desde < 9 ? Math.sin(frame * 3.3) * (9 - desde) * 1.4 : 0;
  const tamanho = (m.vertical ? 290 : 200) * m.u;
  const contador = useEntrada(inicio + 6, 160, 15);
  return (
    <Cena duracao={T.ranking - T.carimbos}>
      <AbsoluteFill style={{ transform: `translate(${abanao}px, ${abanao * 0.5}px)` }}>
        <Cabeca linhas={[[{ texto: 'Carimba', de: 0 }], [{ texto: 'cada', de: 4 }, { texto: 'estádio.', de: 8, cor: COR.relva }]]} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: m.vertical ? 640 : 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 * m.u }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${tamanho}px)`, gap: 18 * m.u, padding: 30 * m.u, background: COR.branco, borderRadius: 36 * m.u, boxShadow: '0 30px 70px rgba(19,36,27,0.14)' }}>
            {CARIMBOS.map((c, i) => (
              <CarimboQueCai key={c.nome} de={inicio + i * passo} tamanho={tamanho} {...c} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 * m.u, opacity: Math.min(1, contador * 1.5), transform: `scale(${0.8 + 0.2 * contador})` }}>
            <span style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * 1.3, color: COR.relva, fontVariantNumeric: 'tabular-nums' }}>{caidos}</span>
            <span style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * 0.5, textTransform: 'uppercase', color: COR.tinta }}>estádios no passaporte</span>
          </div>
        </div>
      </AbsoluteFill>
    </Cena>
  );
}

// --- 6. Climbing the table ------------------------------------------------------------------------------------------

function Ranking() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const lugar = Math.round(interpolate(frame, [22, 58], [7, 3], { ...clamp, easing: Easing.inOut(Easing.cubic) }));
  const seta = useEntrada(20, 180, 12);
  const barra = interpolate(frame, [54, 82], [0.55, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const subiu = useEntrada(82, 220, 11);
  const nivel = frame >= 82 ? 5 : 4;
  return (
    <Cena duracao={T.missoes - T.ranking}>
      <Cabeca linhas={[[{ texto: 'Sobe', de: 0 }, { texto: 'no', de: 4 }], [{ texto: 'ranking.', de: 8, cor: COR.relva }]]} />
      <Telefone largura={m.telefoneW} clipe="clipes-longo/13-ranking.mp4" inicio={1.6} />
      <Lado>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 * m.u, opacity: Math.min(1, seta * 1.5) }}>
          <svg width={m.numero * 0.9} height={m.numero * 0.9} viewBox="0 0 24 24" style={{ transform: `translateY(${(1 - seta) * 40}px)` }}>
            <path d="M12 3l8 9h-5v9h-6v-9H4z" fill={COR.relva} />
          </svg>
          <div>
            <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * 1.6, lineHeight: 0.9, color: COR.tinta, fontVariantNumeric: 'tabular-nums' }}>{`${lugar}.º`}</div>
            <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 28 * m.u, color: COR.tintaSuave }}>na tabela dos tascos</div>
          </div>
        </div>
        <div style={{ background: COR.branco, borderRadius: 28 * m.u, padding: `${22 * m.u}px ${26 * m.u}px`, boxShadow: '0 18px 44px rgba(19,36,27,0.10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 * m.u }}>
            <div style={{ width: 70 * m.u, height: 70 * m.u, borderRadius: 18 * m.u, background: COR.amarelo, display: 'grid', placeItems: 'center', fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 44 * m.u, color: COR.tinta }}>{nivel}</div>
            <div>
              <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 22 * m.u, letterSpacing: '0.08em', color: COR.relva }}>{`NÍVEL ${nivel}`}</div>
              <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 44 * m.u, color: COR.tinta }}>{nivel === 5 ? 'Adepto' : 'Estreante'}</div>
            </div>
          </div>
          <div style={{ marginTop: 16 * m.u, height: 14 * m.u, borderRadius: 999, background: COR.linha, overflow: 'hidden' }}>
            <div style={{ width: `${(frame >= 82 ? 0.08 : barra) * 100}%`, height: '100%', background: COR.relva }} />
          </div>
        </div>
        <div style={{ alignSelf: 'flex-start', background: COR.amarelo, color: COR.tinta, borderRadius: 999, padding: `${12 * m.u}px ${24 * m.u}px`, fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 30 * m.u, opacity: subiu, transform: `scale(${0.5 + 0.5 * subiu}) rotate(${(1 - subiu) * -8}deg)`, transformOrigin: 'left center', boxShadow: '0 14px 30px rgba(255,206,58,0.45)' }}>
          Subiste de nível!
        </div>
      </Lado>
    </Cena>
  );
}

// --- 7. The week's missions -----------------------------------------------------------------------------------------

const MISSOES: { nome: string; pontos: number; icone: 'bola' | 'carro' | 'tasco' }[] = [
  { nome: 'Prova uma especialidade', pontos: 75, icone: 'tasco' },
  { nome: 'Acompanha o teu clube fora', pontos: 125, icone: 'carro' },
  { nome: 'Experimenta um tasco novo', pontos: 75, icone: 'bola' },
];

function Missao({ nome, pontos, icone, feitaEm, de }: { nome: string; pontos: number; icone: 'bola' | 'carro' | 'tasco'; feitaEm: number; de: number }) {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const e = useEntrada(de, 180, 15);
  const feita = useEntrada(feitaEm, 260, 12);
  const sobe = interpolate(frame, [feitaEm, feitaEm + 20], [0, 1], clamp);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 * m.u, background: feita > 0.5 ? COR.relva : COR.branco, borderRadius: 24 * m.u, padding: `${18 * m.u}px ${20 * m.u}px`, boxShadow: '0 16px 40px rgba(19,36,27,0.10)', opacity: Math.min(1, e * 1.5), transform: `translateX(${(1 - e) * 120}px) scale(${1 + 0.05 * Math.sin(Math.min(feita, 1) * Math.PI)})` }}>
      <div style={{ width: 56 * m.u, height: 56 * m.u, borderRadius: '50%', flex: 'none', background: feita > 0.5 ? COR.amarelo : COR.linha, display: 'grid', placeItems: 'center' }}>
        {feita > 0.5 ? (
          <svg width={32 * m.u} height={32 * m.u} viewBox="0 0 24 24" fill="none" stroke={COR.tinta} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ transform: `scale(${feita})` }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        ) : (
          <Icone nome={icone} tamanho={30 * m.u} cor={COR.tintaSuave} />
        )}
      </div>
      <div style={{ flex: 1, fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 27 * m.u, lineHeight: 1.2, color: feita > 0.5 ? COR.branco : COR.tinta }}>{nome}</div>
      <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 40 * m.u, color: feita > 0.5 ? COR.amarelo : COR.relva }}>{`+${pontos}`}</div>
      {sobe > 0 && sobe < 1 ? (
        <div style={{ position: 'absolute', right: 20 * m.u, top: -10 * m.u, fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 46 * m.u, color: COR.amarelo, opacity: 1 - sobe, transform: `translateY(${-sobe * 70}px)`, textShadow: '0 4px 12px rgba(19,36,27,0.3)' }}>{`+${pontos}`}</div>
      ) : null}
    </div>
  );
}

function Missoes() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const feitas = [34, 52, 70];
  const total = MISSOES.reduce((soma, missao, i) => soma + (frame >= feitas[i] ? missao.pontos : 0), 0);
  const pill = useEntrada(74, 200, 13);
  return (
    <Cena duracao={T.memoria - T.missoes}>
      <Cabeca linhas={[[{ texto: 'Missões', de: 0 }, { texto: 'novas', de: 4 }], [{ texto: 'toda', de: 8 }, { texto: 'a', de: 10 }, { texto: 'semana.', de: 12, cor: COR.relva }]]} />
      <Telefone largura={m.telefoneW} clipe="clipes-longo/14-missoes.mp4" inicio={0.2} />
      <Lado>
        {MISSOES.map((missao, i) => (
          <Missao key={missao.nome} {...missao} de={14 + i * 6} feitaEm={feitas[i]} />
        ))}
        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'baseline', gap: 12 * m.u, background: COR.amarelo, borderRadius: 999, padding: `${12 * m.u}px ${26 * m.u}px`, opacity: pill, transform: `scale(${0.6 + 0.4 * pill})`, transformOrigin: 'left center' }}>
          <span style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 52 * m.u, color: COR.tinta, fontVariantNumeric: 'tabular-nums' }}>{`+${total}`}</span>
          <span style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 26 * m.u, color: COR.tinta }}>pontos esta semana</span>
        </div>
      </Lado>
    </Cena>
  );
}

// --- 8. The memory of the trip ---------------------------------------------------------------------------------------

function Memoria() {
  const m = useMedidas();
  return (
    <Cena duracao={T.fecho - T.memoria}>
      <Cabeca linhas={[[{ texto: 'E', de: 0 }, { texto: 'no', de: 3 }, { texto: 'fim,', de: 6 }], [{ texto: 'fica', de: 12 }, { texto: 'a', de: 15 }, { texto: 'memória.', de: 18, cor: COR.relva }]]} />
      <Telefone largura={m.telefoneW} imagem="recordacao.png" />
      <Lado>
        <Numero de={24} valor="4" legenda="foram ao jogo" />
        <Numero de={36} valor="1 jantar" legenda="de vitória" destaque />
      </Lado>
    </Cena>
  );
}

// --- 9. End card -----------------------------------------------------------------------------------------------------

export function Fecho() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const raioMax = Math.hypot(m.w, m.h);
  const onda = interpolate(frame, [0, 12], [0, raioMax], { ...clamp, easing: Easing.out(Easing.cubic) });
  const icone = useEntrada(6, 170, 11);
  const botao = useEntrada(34, 180, 13);
  const tamIcone = (m.vertical ? 300 : 230) * m.u;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: m.w / 2 - onda,
          top: m.h * 0.45 - onda,
          width: onda * 2,
          height: onda * 2,
          borderRadius: '50%',
          background: `repeating-linear-gradient(90deg, ${COR.relva} 0 ${m.w / 8}px, ${COR.relvaClara} ${m.w / 8}px ${m.w / 4}px)`,
          backgroundAttachment: 'fixed',
        }}
      />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 34 * m.u }}>
        <Img src={staticFile('icone.png')} style={{ width: tamIcone, height: tamIcone, borderRadius: '22.37%', boxShadow: '0 30px 70px rgba(0,0,0,0.35)', transform: `scale(${icone}) rotate(${(1 - icone) * -20}deg)` }} />
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 34 * m.u, letterSpacing: '0.18em', color: COR.amarelo, opacity: icone }}>AWAYDAY</div>
        <div>
          <Linha tamanho={m.titulo * 0.9} cor={COR.branco} palavras={[{ texto: 'Vamos', de: 14 }]} />
          <Linha tamanho={m.titulo * 0.9} cor={COR.amarelo} palavras={[{ texto: 'à', de: 19 }, { texto: 'bola?', de: 22 }]} />
        </div>
        <div
          style={{
            marginTop: 20 * m.u,
            padding: `${26 * m.u}px ${64 * m.u}px`,
            borderRadius: 999,
            background: COR.amarelo,
            color: COR.tinta,
            fontFamily: LETRA_TEXTO,
            fontWeight: 800,
            fontSize: 46 * m.u,
            opacity: Math.min(1, botao * 1.4),
            transform: `scale(${0.7 + 0.3 * botao})`,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          }}>
          Descarrega grátis
        </div>
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 30 * m.u, color: 'rgba(255,255,255,0.85)', opacity: botao }}>
          Feita para o dia de jogo. Para qualquer clube.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// --- The whole ad ----------------------------------------------------------------------------------------------------

const CENAS: [number, number, () => ReactNode][] = [
  [T.caos, T.acabou, () => <Caos />],
  [T.acabou, T.boleia, () => <Acabou />],
  [T.boleia, T.tasco, () => <Boleia />],
  [T.tasco, T.carimbos, () => <Tasco />],
  [T.carimbos, T.ranking, () => <Carimbos />],
  [T.ranking, T.missoes, () => <Ranking />],
  [T.missoes, T.memoria, () => <Missoes />],
  [T.memoria, T.fecho, () => <Memoria />],
];

export function Anuncio() {
  const frame = useCurrentFrame();
  // Frame 0 is the poster: the settled end card, so every platform's thumbnail shows it.
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
      <Audio src={staticFile('musica.wav')} />
      <Fundo />
      {CENAS.map(([de, ate, cena]) => (
        <Sequence key={de} from={de} durationInFrames={ate - de}>
          {cena()}
        </Sequence>
      ))}
      <Sequence from={T.fecho}>
        <Fecho />
      </Sequence>
    </AbsoluteFill>
  );
}
