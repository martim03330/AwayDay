import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { estadiosParaEscolha, tascosDoEstadio } from '@/lib/estadios-dos-locais';
import { plural } from '@/lib/formatos';
import { clubesDoUtilizador } from '@/lib/jogos';
import { MOSTRAR_CLUBE_DA_TERRA, obterClube } from '@/mocks/clubes';
import type { Venue } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** The club picker of the Locais tab: the fan's own club on top, then every other stadium (those with tascos first). */
export default function EscolherEstadioScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { atual } = useLocalSearchParams<{ atual?: string }>();
  const { clubeFavoritoId, clubeDaTerraId } = useAppState();
  const { meus, outros } = estadiosParaEscolha(
    clubesDoUtilizador(clubeFavoritoId, MOSTRAR_CLUBE_DA_TERRA ? clubeDaTerraId : null)
  );

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
            accessibilityLabel={`${clube?.nomeCurto ?? estadio.nome}, ${estadio.nome}${escolhido ? ', escolhido' : ''}`}
            leading={clube ? <Escudo clube={clube} size={28} /> : undefined}
            title={clube?.nomeCurto ?? estadio.nome}
            subtitle={`${estadio.nome} · ${tascos > 0 ? plural(tascos, 'tasco', 'tascos') : 'sem tascos ainda'}`}
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
      {linhas(outros)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingVertical: 0,
  },
});
