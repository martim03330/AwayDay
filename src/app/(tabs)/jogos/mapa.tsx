import { useLocalSearchParams, useRouter } from 'expo-router';

import { MapaJogo } from '@/components/mapa-jogo';
import { useSafetyNotes } from '@/features/safety/hooks/useSafetyNotes';
import { eClassico, notasParaVisitante } from '@/lib/classicos';
import { filtrarPorTempoAPe } from '@/lib/locais';
import { plural } from '@/lib/formatos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { locaisDoEstadio } from '@/mocks/locais';
import { Button } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';

/**
 * O mapa à volta do estádio: tascos, parques e WC, com o estádio ao centro.
 *
 * As zonas de adeptos da casa só se desenham nos clássicos, onde a informação serve para **evitar** sarilhos. Num
 * jogo qualquer, marcar no mapa onde está a claque da casa era convidar a ir lá — e isso não é serviço nenhum.
 */
export default function MapaScreen() {
  const router = useRouter();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();

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

  const notasVisitante = notasParaVisitante(notasSeguranca.data ?? [], fora.id);
  const zonas = notasVisitante.flatMap((nota: ZonaNota) =>
    nota.kind === 'zona_a_evitar' && nota.point && nota.radiusM
      ? [{ id: nota.id, titulo: nota.title, centro: nota.point, raioM: nota.radiusM }]
      : []
  );
  const zonasCasa = classico
    ? notasVisitante.flatMap((nota: ZonaNota) =>
        nota.kind === 'zona_adeptos_casa' && nota.point && nota.radiusM
          ? [{ id: nota.id, titulo: nota.title, centro: nota.point, raioM: nota.radiusM }]
          : []
      )
    : [];

  const { perto } = filtrarPorTempoAPe(locaisDoEstadio(estadio.id));

  // The native header already says «Mapa», and the map card carries its own hint: no title or help text on top.
  return (
    <Screen>
      <MapaJogo
        inicio="estadio"
        venue={estadio}
        zonas={zonas}
        zonasCasa={zonasCasa}
        jogo={{
          id: jogo.id,
          inicio: jogo.inicio,
          casaId: jogo.casaId,
          foraId: jogo.foraId,
          competicao: jogo.competicao,
        }}
      />

      <Button
        label={
          perto.length > 0
            ? `Ver ${plural(perto.length, 'local', 'locais')} perto do estádio`
            : 'Ver locais perto do estádio'
        }
        icon={icons.locais}
        onPress={() => router.navigate({ pathname: '/locais', params: { estadio: estadio.id } })}
      />
    </Screen>
  );
}

/** O que uma nota de segurança precisa de ter para virar uma zona no mapa. */
type ZonaNota = {
  id: string;
  kind: string;
  title: string;
  point: { latitude: number; longitude: number } | null;
  radiusM: number | null;
};
