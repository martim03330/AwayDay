import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';

import { alturaTelefone, TelefoneInteiro } from '../componentes';
import { COR, LETRA_TEXTO, LETRA_TITULO } from '../tema';
import type { Capitulo, Passo } from './passos';
import { CAPITULOS_CASA } from './passos-casa';

/**
 * Viagens da Casa for the fan clubs that answered (16:9, captions only, no voice): register the Casa, set up a trip,
 * a member books, the Casa manages it. Same layout as the app demo (Demo.tsx), at the fast pace.
 */

export const ABERTURA = 105;
export const CARTAO = 60;
export const FECHO = 240;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const TELEFONE_W = 476;
const TELEFONE_H = alturaTelefone(TELEFONE_W);

type Bloco =
  | { tipo: 'abertura'; de: number; duracao: number }
  | { tipo: 'cartao'; de: number; duracao: number; capitulo: number }
  | { tipo: 'passo'; de: number; duracao: number; capitulo: number; passo: Passo }
  | { tipo: 'fecho'; de: number; duracao: number };

function linhaDoTempo(capitulos: Capitulo[]): Bloco[] {
  const blocos: Bloco[] = [{ tipo: 'abertura', de: 0, duracao: ABERTURA }];
  let de = ABERTURA;
  capitulos.forEach((c, i) => {
    blocos.push({ tipo: 'cartao', de, duracao: CARTAO, capitulo: i });
    de += CARTAO;
    for (const passo of c.passos) {
      blocos.push({ tipo: 'passo', de, duracao: passo.duracao, capitulo: i, passo });
      de += passo.duracao;
    }
  });
  blocos.push({ tipo: 'fecho', de, duracao: FECHO });
  return blocos;
}

/** The video's length in frames with these chapters (each club's version has its own recordings). */
export function duracaoViagensCasa(capitulos: Capitulo[]) {
  const blocos = linhaDoTempo(capitulos);
  return blocos[blocos.length - 1].de + FECHO;
}

export const DURACAO_VIAGENS_CASA = duracaoViagensCasa(CAPITULOS_CASA);

function Fundo() {
  return (
    <AbsoluteFill style={{ background: COR.papel }}>
      <AbsoluteFill style={{ background: 'radial-gradient(70% 90% at 78% 110%, rgba(28,138,77,0.20) 0%, rgba(28,138,77,0.05) 50%, rgba(248,247,242,0) 75%)' }} />
    </AbsoluteFill>
  );
}

function Abertura() {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 20, ABERTURA - 15, ABERTURA], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: COR.relvaEscura, alignItems: 'center', justifyContent: 'center', opacity: a }}>
      <Img src={staticFile('icone.png')} style={{ width: 170, height: 170, borderRadius: 38, marginBottom: 44 }} />
      <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 128, color: COR.branco, lineHeight: 1 }}>Viagens da Casa</div>
      <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 500, fontSize: 46, color: 'rgba(255,255,255,0.88)', marginTop: 28 }}>
        O autocarro da Casa para o jogo, organizado na app.
      </div>
      <div style={{ position: 'absolute', bottom: 56, fontFamily: LETRA_TEXTO, fontWeight: 500, fontSize: 28, color: 'rgba(255,255,255,0.6)' }}>
        Os nomes e os dados deste vídeo são de exemplo.
      </div>
    </AbsoluteFill>
  );
}

function Cartao({ capitulos, capitulo }: { capitulos: Capitulo[]; capitulo: number }) {
  const frame = useCurrentFrame();
  const c = capitulos[capitulo];
  const a = interpolate(frame, [0, 8, CARTAO - 8, CARTAO], [0, 1, 1, 0], clamp);
  const y = interpolate(frame, [0, 12], [30, 0], clamp);
  return (
    <AbsoluteFill style={{ background: COR.relvaEscura, justifyContent: 'center', paddingLeft: 160, opacity: a }}>
      <div style={{ transform: `translateY(${y}px)` }}>
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 36, letterSpacing: 4, color: COR.amarelo }}>
          PARTE {capitulo + 1} DE {capitulos.length}
        </div>
        <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 168, color: COR.branco, lineHeight: 1, marginTop: 18 }}>{c.titulo}</div>
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 500, fontSize: 50, color: 'rgba(255,255,255,0.85)', marginTop: 26 }}>{c.frase}</div>
      </div>
    </AbsoluteFill>
  );
}

/** A tap: a ring that grows and fades where the finger lands (capture pixels, scaled by k). */
function Toques({ passo, k }: { passo: Passo; k: number }) {
  const frame = useCurrentFrame();
  return (
    <>
      {passo.toques.map((t) => {
        const p = interpolate(frame, [t.f - 6, t.f + 20], [0, 1], clamp);
        if (p <= 0 || p >= 1) return null;
        const tam = 70 + 90 * p;
        return (
          <div
            key={`${t.f}-${t.x}-${t.y}`}
            style={{
              position: 'absolute',
              left: t.x * k - tam / 2,
              top: t.y * k - tam / 2,
              width: tam,
              height: tam,
              borderRadius: '50%',
              background: 'rgba(255,206,58,0.35)',
              border: '5px solid rgba(255,206,58,0.95)',
              opacity: p < 0.2 ? p * 5 : 1 - (p - 0.2) / 0.8,
            }}
          />
        );
      })}
    </>
  );
}

function PassoNoEcra({ capitulos, capitulo, passo }: { capitulos: Capitulo[]; capitulo: number; passo: Passo }) {
  const frame = useCurrentFrame();
  const c = capitulos[capitulo];
  const a = interpolate(frame, [0, 6], [0, 1], clamp);
  const y = interpolate(frame, [0, 8], [16, 0], clamp);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 130, top: 0, bottom: 0, width: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 800, fontSize: 30, letterSpacing: 3, color: COR.relva, textTransform: 'uppercase' }}>
          {capitulo + 1} · {c.titulo}
        </div>
        <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 64, lineHeight: 1.22, color: COR.tinta, marginTop: 26, opacity: a, transform: `translateY(${y}px)` }}>
          {passo.legenda}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1920 - TELEFONE_W - 170, top: (1080 - TELEFONE_H) / 2 }}>
        <TelefoneInteiro
          largura={TELEFONE_W}
          clipe={passo.clipe}
          imagem={passo.imagem}
          inicio={passo.inicio}
          toca={passo.toca}
          velocidade={passo.velocidade ?? 1}
          filhos={(k) => (
            <>
              {passo.tapar ? (
                // Covers the development build's menu button: the app's own background behind it.
                <div style={{ position: 'absolute', left: (1162 - 108) * k, top: (275 - 108) * k, width: 216 * k, height: 216 * k, borderRadius: '50%', background: passo.taparCor ?? '#F6F4F0', boxShadow: `0 0 ${18 * k}px ${14 * k}px ${passo.taparCor ?? '#F6F4F0'}` }} />
              ) : null}
              <Toques passo={passo} k={k} />
            </>
          )}
        />
      </div>
    </AbsoluteFill>
  );
}

function Progresso({ capitulos, capitulo }: { capitulos: Capitulo[]; capitulo: number }) {
  return (
    <div style={{ position: 'absolute', left: 130, bottom: 70, width: 1000, display: 'flex', gap: 10 }}>
      {capitulos.map((c, i) => (
        <div key={c.titulo} style={{ flex: 1, height: 8, borderRadius: 4, background: i <= capitulo ? COR.relva : 'rgba(19,36,27,0.12)' }} />
      ))}
    </div>
  );
}

function Fecho() {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, 20], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: COR.relvaEscura, alignItems: 'center', justifyContent: 'center', opacity: a, textAlign: 'center' }}>
      <Img src={staticFile('icone.png')} style={{ width: 140, height: 140, borderRadius: 32, marginBottom: 40 }} />
      <div style={{ fontFamily: LETRA_TITULO, fontWeight: 900, fontSize: 120, color: COR.branco, lineHeight: 1 }}>Dúvidas? Fala comigo.</div>
      <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 700, fontSize: 52, color: COR.amarelo, marginTop: 36 }}>Martim · 910 994 459</div>
      <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 500, fontSize: 44, color: 'rgba(255,255,255,0.88)', marginTop: 14 }}>martim565@gmail.com</div>
      <div style={{ fontFamily: LETRA_TEXTO, fontWeight: 500, fontSize: 34, color: 'rgba(255,255,255,0.7)', marginTop: 60 }}>
        Para instalar: testflight.apple.com/join/VT2T9PtF
      </div>
    </AbsoluteFill>
  );
}

export function ViagensDaCasa({ capitulos = CAPITULOS_CASA }: { capitulos?: Capitulo[] }) {
  const blocos = linhaDoTempo(capitulos);
  return (
    <AbsoluteFill>
      <Fundo />
      {blocos.map((b) => (
        <Sequence key={`${b.tipo}-${b.de}`} from={b.de} durationInFrames={b.duracao} premountFor={30}>
          {b.tipo === 'abertura' ? <Abertura /> : null}
          {b.tipo === 'cartao' ? <Cartao capitulos={capitulos} capitulo={b.capitulo} /> : null}
          {b.tipo === 'passo' ? (
            <>
              <PassoNoEcra capitulos={capitulos} capitulo={b.capitulo} passo={b.passo} />
              <Progresso capitulos={capitulos} capitulo={b.capitulo} />
            </>
          ) : null}
          {b.tipo === 'fecho' ? <Fecho /> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
