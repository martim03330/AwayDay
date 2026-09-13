import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { JogoCard } from '@/components/jogo-card';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { chaveDoDia, formatarDia } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { correspondeCompeticao, estadoDoJogo, type FiltroCompeticao } from '@/lib/jogos';
import { obterClube } from '@/mocks/clubes';
import { jogos } from '@/mocks/jogos';
import type { Jogo } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';

const filtrosCompeticao: { id: FiltroCompeticao; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'liga', label: 'Liga Betclic' },
  { id: 'liga-2', label: 'Liga 2' },
  { id: 'liga-3', label: 'Liga 3' },
  { id: 'tacas', label: 'Taças' },
];

type GrupoDeJogos = {
  chave: string;
  titulo: string;
  jogos: Jogo[];
};

function agruparPorDia(lista: Jogo[]) {
  const grupos: GrupoDeJogos[] = [];
  for (const jogo of lista) {
    const inicio = new Date(jogo.inicio);
    const chave = chaveDoDia(inicio);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.chave === chave) {
      ultimo.jogos.push(jogo);
    } else {
      grupos.push({ chave, titulo: formatarDia(inicio), jogos: [jogo] });
    }
  }
  return grupos;
}

export default function JogosScreen() {
  const router = useRouter();
  const agora = useNow();
  const { clubeFavoritoId, avaliacoes } = useAppState();
  const [competicao, setCompeticao] = useState<FiltroCompeticao>('todas');
  const [soMeuClube, setSoMeuClube] = useState(false);
  const { loading, refreshing, refresh } = useSimulatedLoading('jogos');

  const clubeFavorito = obterClube(clubeFavoritoId);
  const filtrados = jogos.filter(
    (jogo) =>
      correspondeCompeticao(jogo, competicao) &&
      (!soMeuClube || jogo.casaId === clubeFavoritoId || jogo.foraId === clubeFavoritoId)
  );
  const proximos = filtrados.filter((jogo) => estadoDoJogo(jogo, agora) !== 'terminado');
  const terminados = filtrados
    .filter((jogo) => estadoDoJogo(jogo, agora) === 'terminado')
    .reverse();
  const grupos = agruparPorDia(proximos);

  function limparFiltros() {
    setCompeticao('todas');
    setSoMeuClube(false);
  }

  function renderJogo(jogo: Jogo) {
    return (
      <JogoCard
        key={jogo.id}
        jogo={jogo}
        estado={estadoDoJogo(jogo, agora)}
        avaliacao={avaliacoes[jogo.id]}
        onPress={() => router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: jogo.id } })}
      />
    );
  }

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

    if (filtrados.length === 0) {
      const nomeCompeticao = filtrosCompeticao.find((filtro) => filtro.id === competicao)?.label;
      const emCompeticao = competicao === 'todas' ? '' : ` na ${nomeCompeticao}`;
      return (
        <EmptyState
          icon={icons.semJogos}
          title="Sem jogos com estes filtros"
          message={
            soMeuClube
              ? `${clubeFavorito?.nomeCurto ?? 'O teu clube'} não tem jogos${emCompeticao} nos próximos dias.`
              : `Não há jogos${emCompeticao} nos próximos dias.`
          }
          action={{ label: 'Limpar filtros', onPress: limparFiltros }}
        />
      );
    }

    return (
      <>
        {grupos.map((grupo) => (
          <View key={grupo.chave} style={styles.grupo}>
            <SectionHeader
              title={grupo.titulo}
              trailing={plural(grupo.jogos.length, 'jogo', 'jogos')}
            />
            {grupo.jogos.map(renderJogo)}
          </View>
        ))}
        {terminados.length > 0 ? (
          <View style={styles.grupo}>
            <SectionHeader
              title="Terminados"
              trailing={plural(terminados.length, 'jogo', 'jogos')}
            />
            {terminados.map(renderJogo)}
          </View>
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
        {filtrosCompeticao.map((filtro) => (
          <Chip
            key={filtro.id}
            label={filtro.label}
            selected={competicao === filtro.id}
            onPress={() => setCompeticao(filtro.id)}
          />
        ))}
      </ScrollView>
      <View style={styles.filtrosClube}>
        <Chip label="Todos os clubes" selected={!soMeuClube} onPress={() => setSoMeuClube(false)} />
        <Chip
          label={clubeFavorito ? `Só ${clubeFavorito.nomeCurto}` : 'O meu clube'}
          selected={soMeuClube}
          onPress={() => setSoMeuClube(true)}
        />
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
  filtrosClube: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  grupo: {
    gap: Spacing.two,
  },
});
