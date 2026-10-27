import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { estadiosParaEscolha, tascosDoEstadio } from '@/lib/estadios-dos-locais';
import { plural } from '@/lib/formatos';
import { clubesDoUtilizador } from '@/lib/jogos';
import { MOSTRAR_CLUBE_DA_TERRA, obterClube } from '@/mocks/clubes';
import type { Divisao, Venue } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { Screen } from '@/ui/screen';
import { Segmentado } from '@/ui/segmentado';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

type Liga = 'liga-1' | 'liga-2' | 'liga-3' | 'outros';

const NOMES_DAS_LIGAS: Record<Liga, string> = {
  'liga-1': 'Liga Betclic',
  'liga-2': 'Liga 2',
  'liga-3': 'Liga 3',
  outros: 'Outros',
};

function ligaDe(divisao: Divisao | null | undefined): Liga {
  return divisao === 1 ? 'liga-1' : divisao === 2 ? 'liga-2' : divisao === 3 ? 'liga-3' : 'outros';
}

/**
 * The club picker of the Locais tab: the fan's own club on top, then the other stadiums of one league at a time (the
 * full list was too long to scroll), those with tascos first.
 */
export default function EscolherEstadioScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { atual } = useLocalSearchParams<{ atual?: string }>();
  const { clubeFavoritoId, clubeDaTerraId } = useAppState();
  const { meus, outros } = estadiosParaEscolha(
    clubesDoUtilizador(clubeFavoritoId, MOSTRAR_CLUBE_DA_TERRA ? clubeDaTerraId : null)
  );

  const ligaDoEstadio = (estadio: Venue) => ligaDe(obterClube(estadio.clubeId)?.divisao);
  const ligas = (Object.keys(NOMES_DAS_LIGAS) as Liga[]).filter((liga) =>
    outros.some((estadio) => ligaDoEstadio(estadio) === liga)
  );
  // Opens on the fan's league (where rivals and neighbours are), or the first one there is.
  const ligaDoAdepto = meus[0] ? ligaDoEstadio(meus[0]) : null;
  const [liga, setLiga] = useState<Liga | null>(null);
  const ligaVista = liga ?? (ligaDoAdepto && ligas.includes(ligaDoAdepto) ? ligaDoAdepto : (ligas[0] ?? 'liga-1'));
  const daLiga = outros.filter((estadio) => ligaDoEstadio(estadio) === ligaVista);

  const escolher = (estadioId: string) => router.dismissTo({ pathname: '/locais', params: { estadio: estadioId } });

  const linhas = (lista: Venue[]) => (
    <Card style={styles.lista}>
      {lista.map((estadio, indice) => {
        const clube = obterClube(estadio.clubeId);
        const tascos = tascosDoEstadio(estadio.id).perto.length;
        const escolhido = estadio.id === atual;
        return (
          <LinhaGrupo
            key={estadio.id}
            onPress={() => escolher(estadio.id)}
            accessibilityLabel={`${clube?.nomeCurto ?? estadio.nome}, ${estadio.nome}, ${tascos > 0 ? plural(tascos, 'tasco', 'tascos') : 'sem tascos ainda'}${escolhido ? ', escolhido' : ''}`}
            leading={clube ? <Escudo clube={clube} size={28} /> : undefined}
            title={clube?.nomeCurto ?? estadio.nome}
            valor={tascos > 0 ? plural(tascos, 'tasco', 'tascos') : undefined}
            trailing={escolhido ? <Icon name={icons.selecionado} size={20} color={theme.accentInk} /> : undefined}
            separador={indice < lista.length - 1}
          />
        );
      })}
    </Card>
  );

  return (
    <Screen voltarAoTopo={false}>
      <ThemedText type="title" accessibilityRole="header">
        Escolher o clube
      </ThemedText>
      {meus.length > 0 ? (
        <>
          <SectionHeader title={meus.length === 1 ? 'O teu clube' : 'Os teus clubes'} />
          {linhas(meus)}
        </>
      ) : null}
      <SectionHeader title={meus.length > 0 ? 'Outros clubes' : 'Clubes'} />
      {ligas.length > 1 ? (
        <Segmentado
          opcoes={ligas.map((valor) => ({ valor, label: NOMES_DAS_LIGAS[valor] }))}
          valor={ligaVista}
          onChange={setLiga}
        />
      ) : null}
      {linhas(daLiga)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingVertical: 0,
  },
});
