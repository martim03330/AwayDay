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

function Nota({ de, children }: { de: number; children: ReactNode }) {
  const m = useMedidas();
  const e = useEntrada(de, 120, 18);
  return <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 30 * m.u, lineHeight: 1.3, color: COR.tintaSuave, opacity: e, transform: `translateY(${(1 - e) * 20}px)` }}>{children}</div>;
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

// --- 3. The ride, to the cent --------------------------------------------------------------------------------------

function Boleia() {
  return (
    <Cena duracao={T.tasco - T.boleia}>
      <Cabeca linhas={[[{ texto: 'Boleia', de: 0 }, { texto: 'ao', de: 4 }, { texto: 'cêntimo.', de: 8, cor: COR.relva }]]} />
      <Telefone largura={useMedidas().telefoneW} clipe="clipes-longo/05-boleias.mp4" inicio={4.3} />
      <Lado>
        <Numero de={22} valor="143,52 €" legenda="combustível e portagens" />
        <Numero de={40} valor="÷ 4" legenda="quem vai no carro" />
        <Numero de={58} valor="35,88 €" legenda="cada um" destaque />
        <Nota de={80}>Sem lucro: só os custos.</Nota>
      </Lado>
    </Cena>
  );
}

// --- 4. The tasco, live ---------------------------------------------------------------------------------------------

function Tasco() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const n = Math.round(interpolate(frame, [20, 62], [0, 27], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const e = useEntrada(18, 160, 14);
  return (
    <Cena duracao={T.contas - T.tasco}>
      <Cabeca linhas={[[{ texto: 'O', de: 0 }, { texto: 'tasco,', de: 4 }, { texto: 'ao', de: 8, cor: COR.relva }, { texto: 'vivo.', de: 12, cor: COR.relva }]]} />
      <Telefone largura={m.telefoneW} clipe="clipes-longo/10-tasco.mp4" inicio={0.4} />
      <Lado>
        <div style={{ opacity: Math.min(1, e * 1.5), transform: `scale(${0.7 + 0.3 * e})`, transformOrigin: 'left center' }}>
          <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * 2.4, lineHeight: 0.9, color: COR.relva, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
          <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: m.numero * 0.5, lineHeight: 1, textTransform: 'uppercase', color: COR.tinta }}>pessoas lá agora</div>
        </div>
        <Nota de={70}>Só aparece a partir de 5 pessoas, e ninguém vê onde estás.</Nota>
      </Lado>
    </Cena>
  );
}

// --- 5. Who owes whom: done ------------------------------------------------------------------------------------------

function Divida({ de, quem, valor }: { de: number; quem: string; valor: string }) {
  const m = useMedidas();
  const e = useEntrada(de, 200, 15);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20 * m.u, background: COR.branco, borderRadius: 24 * m.u, padding: `${20 * m.u}px ${26 * m.u}px`, boxShadow: '0 16px 40px rgba(19,36,27,0.10)', opacity: Math.min(1, e * 1.5), transform: `translateX(${(1 - e) * 120}px)` }}>
      <span style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 32 * m.u, color: COR.tinta }}>{quem}</span>
      <span style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 54 * m.u, color: COR.relva, whiteSpace: 'nowrap' }}>{valor}</span>
    </div>
  );
}

function Contas() {
  const m = useMedidas();
  const ok = useEntrada(76, 220, 12);
  return (
    <Cena duracao={T.carimbo - T.contas}>
      <Cabeca linhas={[[{ texto: 'Quem', de: 0 }, { texto: 'deve', de: 4 }, { texto: 'a', de: 7 }, { texto: 'quem?', de: 10 }], [{ texto: 'Já', de: 22, cor: COR.relva }, { texto: 'está.', de: 26, cor: COR.relva }]]} />
      <Telefone largura={m.telefoneW} clipe="clipes-longo/11-contas.mp4" inicio={4.5} />
      <Lado>
        <Divida de={30} quem="Zé → Rui" valor="49,88 €" />
        <Divida de={42} quem="Ana → Rui" valor="25,88 €" />
        <Divida de={54} quem="Tu → Rui" valor="3,88 €" />
        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 14 * m.u, background: COR.relva, color: COR.branco, borderRadius: 999, padding: `${14 * m.u}px ${26 * m.u}px`, fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 32 * m.u, opacity: ok, transform: `scale(${0.6 + 0.4 * ok})`, transformOrigin: 'left center' }}>
          <svg width={34 * m.u} height={34 * m.u} viewBox="0 0 24 24" fill="none" stroke={COR.branco} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          Contas feitas
        </div>
      </Lado>
    </Cena>
  );
}

// --- 6. The stamp: only counts if you were there --------------------------------------------------------------------

function Estadio() {
  const frame = useCurrentFrame();
  const m = useMedidas();
  const queda = interpolate(frame, [0, 6], [2.6, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const ressalto = frame >= 6 ? 1 + 0.06 * Math.exp(-(frame - 6) / 3) * Math.cos((frame - 6) * 1.6) : queda;
  const abanao = frame >= 6 && frame < 14 ? Math.sin(frame * 3.1) * (14 - frame) * 1.8 : 0;
  const tinta = interpolate(frame, [6, 20], [0, 1], clamp);
  const tamanho = m.vertical ? 620 : 440;
  return (
    <Cena duracao={T.memoria - T.carimbo}>
      <AbsoluteFill style={{ transform: `translate(${abanao}px, ${abanao * 0.4}px)` }}>
        <Cabeca linhas={[[{ texto: 'Só', de: 10 }, { texto: 'conta', de: 13 }, { texto: 'se', de: 16 }], [{ texto: 'lá', de: 19, cor: COR.relva }, { texto: 'estiveres.', de: 22, cor: COR.relva }]]} />
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', top: m.vertical ? 380 : 220 }}>
          {[...Array(12)].map((_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            const dist = tamanho * (0.5 + 0.3 * tinta);
            return (
              <div key={i} style={{ position: 'absolute', width: 16 + (i % 3) * 9, height: 16 + (i % 3) * 9, borderRadius: '50%', background: '#D8262E', opacity: frame >= 6 ? (1 - tinta) * 0.8 : 0, transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)` }} />
            );
          })}
          <div style={{ transform: `scale(${frame < 6 ? queda : ressalto}) rotate(-10deg)`, opacity: interpolate(frame, [0, 3], [0, 1], clamp), filter: 'drop-shadow(0 20px 40px rgba(216,38,46,0.25))' }}>
            <Carimbo tamanho={tamanho} cor="#D8262E" nome="BRAGA" data="09·10·26" />
          </div>
          <div style={{ marginTop: 40 * m.u, fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 32 * m.u, color: COR.tintaSuave, opacity: interpolate(frame, [30, 44], [0, 1], clamp) }}>
            Um carimbo por estádio, lá dentro e no dia do jogo.
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </Cena>
  );
}

// --- 7. The memory of the trip ---------------------------------------------------------------------------------------

function Memoria() {
  const m = useMedidas();
  return (
    <Cena duracao={T.fecho - T.memoria}>
      <Cabeca linhas={[[{ texto: 'E', de: 0 }, { texto: 'no', de: 3 }, { texto: 'fim,', de: 6 }], [{ texto: 'fica', de: 12 }, { texto: 'a', de: 15 }, { texto: 'memória.', de: 18, cor: COR.relva }]]} />
      <Telefone largura={m.telefoneW} imagem="recordacao.png" />
      <Lado>
        <Numero de={24} valor="4" legenda="foram ao jogo" />
        <Numero de={36} valor="140,00 €" legenda="gastos na viagem" />
        <Numero de={48} valor="35,00 €" legenda="por cabeça" destaque />
      </Lado>
    </Cena>
  );
}

// --- 8. End card -----------------------------------------------------------------------------------------------------

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
  [T.tasco, T.contas, () => <Tasco />],
  [T.contas, T.carimbo, () => <Contas />],
  [T.carimbo, T.memoria, () => <Estadio />],
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
