import { useLocalSearchParams, useRouter } from 'expo-router';

import { CuidadosVisitantes } from '@/components/cuidados-visitantes';
import { EstadioCard } from '@/components/estadio-card';
import { MapaPontoEncontro } from '@/components/mapa-ponto-encontro';
import { MeteorologiaCard } from '@/components/meteorologia-card';
import { PontoEncontroCard } from '@/components/ponto-encontro-card';
import { WcMaisProximo } from '@/components/wc-mais-proximo';
import { useSafetyNotes } from '@/features/safety/hooks/useSafetyNotes';
import { eClassico, notasParaVisitante } from '@/lib/classicos';
import { eCompeticaoEuropeia } from '@/lib/jogos';
import { notaDoEstadio } from '@/lib/avaliacoes';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';

/**
 * O estádio deste jogo: a ficha, o tempo que se espera, o ponto de encontro (nas europeias), os cuidados para quem
 * vai de fora e o WC mais próximo.
 *
 * Vive numa página à parte porque é informação que se lê uma vez antes de sair de casa — não tem de estar no
 * caminho de quem abre o jogo só para ver a que horas é.
 */
export default function EstadioScreen() {
  const router = useRouter();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();
  const { avaliacoes } = useAppState();

  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const classico = jogo ? eClassico(jogo) : false;
  const notasSeguranca = useSafetyNotes(jogo?.estadioId ?? null, true);

  if (!jogo || !estadio || !fora) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Volta aos jogos e tenta outra vez."
          action={{ label: 'Voltar aos jogos', onPress: () => router.replace('/jogos') }}
        />
      </Screen>
    );
  }

  // Só o que um visitante precisa de saber: onde estão os adeptos da casa e por onde se entra.
  const notasVisitante = notasParaVisitante(notasSeguranca.data ?? [], fora.id).filter(
    (nota: { kind: string }) => classico || nota.kind === 'percurso_visitantes'
  );

  // The native header already says «O estádio»: the card opens the screen, without a second title on top.
  return (
    <Screen>
      <EstadioCard venue={estadio} nota={notaDoEstadio(avaliacoes, estadio.id)} />

      {jogo.meteorologia ? (
        <>
          <SectionHeader
            title="Meteorologia"
            trailing={jogo.meteorologia.fonte ? `Previsão ${jogo.meteorologia.fonte}` : 'Previsão simulada'}
          />
          <MeteorologiaCard meteorologia={jogo.meteorologia} />
        </>
      ) : null}

      {eCompeticaoEuropeia(jogo.competicao) ? (
        <>
          <SectionHeader
            title="Ponto de encontro"
            trailing={jogo.pontoEncontro ? 'Oficial' : undefined}
          />
          <PontoEncontroCard ponto={jogo.pontoEncontro} />
          {jogo.pontoEncontro?.coordenadas ? (
            <MapaPontoEncontro
              nome={jogo.pontoEncontro.nome}
              coordenadas={jogo.pontoEncontro.coordenadas}
              estadio={estadio}
            />
          ) : null}
        </>
      ) : null}

      {notasVisitante.length > 0 ? (
        <>
          <SectionHeader title="Cuidados a ter" trailing={`Adeptos do ${fora.nomeCurto}`} />
          <CuidadosVisitantes notas={notasVisitante} />
        </>
      ) : null}

      <WcMaisProximo origem={estadio.coordenadas} estadioId={estadio.id} titulo="WC mais próximo" />
    </Screen>
  );
}
