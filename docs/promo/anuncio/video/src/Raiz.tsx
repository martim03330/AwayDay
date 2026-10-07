import { Composition } from 'remotion';

import { Anuncio } from './Anuncio';
import { CAPITULOS } from './longo/capitulos';
import { CapituloSolo, DURACAO_LONGO, duracaoCapitulo, Longo } from './longo/Longo';
import { DURACAO, FPS } from './tempos';

export function Raiz() {
  return (
    <>
      <Composition id="Reels" component={Anuncio} durationInFrames={DURACAO} fps={FPS} width={1080} height={1920} />
      <Composition id="Feed" component={Anuncio} durationInFrames={DURACAO} fps={FPS} width={1080} height={1350} />
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
