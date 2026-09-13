import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { LocalCard } from '@/components/local-card';
import { Spacing } from '@/constants/theme';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { plural } from '@/lib/formatos';
import { filtrarPorTempoAPe, MAX_MINUTOS_A_PE } from '@/lib/locais';
import { obterClube } from '@/mocks/clubes';
import { estadiosNacionais, obterEstadio } from '@/mocks/estadios';
import { locaisDoEstadio } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { IconCircle, icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const ESTADIO_COM_LOCAIS = 'luz';

function temLocaisPerto(estadioId: string) {
  return filtrarPorTempoAPe(locaisDoEstadio(estadioId)).perto.length > 0;
}

/** Estádios com locais perto primeiro, mantendo a ordem original dentro de cada grupo. */
const estadiosOrdenados = [...estadiosNacionais].sort(
  (a, b) => Number(temLocaisPerto(b.id)) - Number(temLocaisPerto(a.id))
);

export default function LocaisScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ estadio?: string }>();
  const { clubeFavoritoId, fezCheckIn, pessoasAqui } = useAppState();

  const estadioDoClube = obterClube(clubeFavoritoId)?.estadioId ?? ESTADIO_COM_LOCAIS;
  const estadio =
    obterEstadio(params.estadio ?? estadioDoClube) ?? obterEstadio(estadioDoClube) ?? estadiosNacionais[0];
  const { perto, maisLonge } = filtrarPorTempoAPe(locaisDoEstadio(estadio.id));
  const { loading, refreshing, refresh } = useSimulatedLoading(`locais-${estadio.id}`);

  function renderConteudo() {
    if (loading) {
      return (
        <>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </>
      );
    }

    if (perto.length === 0) {
      return (
        <EmptyState
          icon={icons.semLocais}
          title="Zona sem tasco à vista"
          message={
            maisLonge > 0
              ? `Os tascos que conhecemos ficam a mais de ${MAX_MINUTOS_A_PE} min a pé do ${estadio.nome}. Longe demais para ir a pé.`
              : `Ainda não mapeámos tascos perto do ${estadio.nome}.`
          }
          action={{
            label: 'Ver tascos perto da Luz',
            onPress: () => router.setParams({ estadio: ESTADIO_COM_LOCAIS }),
          }}
        />
      );
    }

    return (
      <>
        {perto.map((local) => (
          <LocalCard
            key={local.id}
            local={local}
            pessoas={pessoasAqui(local)}
            checkedIn={fezCheckIn(local.id)}
            onPress={() =>
              router.push({ pathname: '/locais/[localId]', params: { localId: local.id } })
            }
          />
        ))}
        {maisLonge > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
            {maisLonge === 1
              ? `1 tasco fica a mais de ${MAX_MINUTOS_A_PE} min a pé e ficou no banco.`
              : `${maisLonge} tascos ficam a mais de ${MAX_MINUTOS_A_PE} min a pé e ficaram no banco.`}
          </ThemedText>
        ) : null}
      </>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}>
        {estadiosOrdenados.map((opcao) => (
          <Chip
            key={opcao.id}
            label={obterClube(opcao.clubeId)?.nomeCurto ?? opcao.nome}
            selected={opcao.id === estadio.id}
            onPress={() => router.setParams({ estadio: opcao.id })}
          />
        ))}
      </ScrollView>

      <View style={styles.cabecalho}>
        <IconCircle name={icons.estadio} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">{estadio.nome}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {loading
              ? 'A procurar locais…'
              : `${plural(perto.length, 'local', 'locais')} a menos de ${MAX_MINUTOS_A_PE} min a pé · ${estadio.cidade}`}
          </ThemedText>
        </View>
      </View>

      {renderConteudo()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipsScroll: {
    marginHorizontal: -Spacing.three,
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  centro: {
    textAlign: 'center',
  },
});
