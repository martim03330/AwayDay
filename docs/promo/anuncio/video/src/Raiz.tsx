import { Composition } from 'remotion';

import { Anuncio } from './Anuncio';
import { Boleias } from './boleias/Boleias';
import { Demo, DURACAO_DEMO } from './demo/Demo';
import { DURACAO_VIAGENS_CASA, ViagensDaCasa } from './demo/ViagensDaCasa';
import { DURACAO_BOLEIAS } from './boleias/tempos';
import { CAPITULOS } from './longo/capitulos';
import { CapituloSolo, DURACAO_LONGO, duracaoCapitulo, Longo } from './longo/Longo';
import { DURACAO, FPS } from './tempos';

export function Raiz() {
  return (
    <>
      <Composition id="Reels" component={Anuncio} durationInFrames={DURACAO} fps={FPS} width={1080} height={1920} />
      <Composition id="Feed" component={Anuncio} durationInFrames={DURACAO} fps={FPS} width={1080} height={1350} />
      <Composition id="BoleiasReels" component={Boleias} durationInFrames={DURACAO_BOLEIAS} fps={FPS} width={1080} height={1920} />
      <Composition id="BoleiasFeed" component={Boleias} durationInFrames={DURACAO_BOLEIAS} fps={FPS} width={1080} height={1350} />
      <Composition id="Demo" component={Demo} durationInFrames={DURACAO_DEMO} fps={FPS} width={1920} height={1080} />
      <Composition id="ViagensDaCasa" component={ViagensDaCasa} durationInFrames={DURACAO_VIAGENS_CASA} fps={FPS} width={1920} height={1080} />
      <Composition id="Longo" component={Longo} durationInFrames={DURACAO_LONGO} fps={FPS} width={1080} height={1920} />
      <Composition id="LongoFeed" component={Longo} durationInFrames={DURACAO_LONGO} fps={FPS} width={1080} height={1350} />
      {CAPITULOS.map((c, i) => (
        <Composition
          key={c.numero}
          id={`Capitulo-${c.numero}`}
          component={CapituloSolo}
          defaultProps={{ indice: i }}
          durationInFrames={duracaoCapitulo(i)}
          fps={FPS}
          width={1080}
          height={1920}
        />
      ))}
    </>
  );
}
