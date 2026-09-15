import { haPrevisaoDeChuva } from '@/lib/meteorologia';
import type {
  AvaliacaoVisita,
  EstadoMissao,
  Jogo,
  Local,
  Missao,
  Prato,
  ProgressoMissao,
  VisitaLocal,
} from '@/mocks/tipos';

export type DadosMissoes = {
  estadiosVisitados: readonly string[];
  notasTascos: Readonly<Partial<Record<string, number>>>;
  pratosRecomendados: ReadonlySet<string>;
  avaliacoes: readonly AvaliacaoVisita[];
  visitasLocais: readonly VisitaLocal[];
  /** Missões que já têm foto de prova no álbum. */
  missoesComFoto: ReadonlySet<string>;
  /** Fotos de tascos que o adepto enviou e foram aprovadas. */
  fotosTascoAprovadas: number;
  rivais: readonly string[];
  obterJogo: (id: string) => Jogo | undefined;
  obterLocal: (id: string) => Local | undefined;
  obterPrato: (id: string) => { prato: Prato } | undefined;
};

function valorDoProgresso(tipo: ProgressoMissao, missao: Missao, dados: DadosMissoes) {
  switch (tipo) {
    case 'estadios-visitados':
      return new Set(dados.estadiosVisitados).size;
    case 'tascos-avaliados':
      return Object.values(dados.notasTascos).filter((nota) => nota !== undefined).length;
    case 'especialidade-recomendada':
      return [...dados.pratosRecomendados].filter((id) => dados.obterPrato(id)?.prato.especialidade)
        .length;
    case 'jogo-a-chuva':
      return dados.avaliacoes.filter((avaliacao) => {
        const jogo = dados.obterJogo(avaliacao.jogoId);
        return jogo ? haPrevisaoDeChuva(jogo.meteorologia) : false;
      }).length;
    case 'check-in-com-rivais':
      return dados.visitasLocais.filter(
        (visita) =>
          visita.verificado &&
          (dados
            .obterLocal(visita.localId)
            ?.clubesAqui.some((clube) => dados.rivais.includes(clube)) ??
            false)
      ).length;
    case 'so-foto':
      return dados.missoesComFoto.has(missao.id) ? 1 : 0;
    case 'fotos-tasco-aprovadas':
      return dados.fotosTascoAprovadas;
  }
}

/** Uma missão só fica concluída com a foto de prova; antes disso, cumprida fica "por comprovar". */
export function progressoDaMissao(missao: Missao, dados: DadosMissoes) {
  const atual = Math.min(missao.meta, valorDoProgresso(missao.progresso, missao, dados));
  const cumprida = atual >= missao.meta;
  // An approved tasco photo is its own proof: no second photo for the album.
  const provada =
    missao.progresso === 'fotos-tasco-aprovadas' || dados.missoesComFoto.has(missao.id);
  const estado: EstadoMissao = cumprida
    ? provada
      ? 'concluida'
      : 'por-comprovar'
    : atual > 0
      ? 'em-curso'
      : 'por-fazer';
  return { atual, meta: missao.meta, estado };
}

/** A câmara só abre quando a foto pode fechar a missão: evita provas tiradas antes do tempo. */
export function podeTirarFoto(missao: Missao, estado: EstadoMissao) {
  return estado === 'por-comprovar' || (missao.progresso === 'so-foto' && estado === 'por-fazer');
}
