import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AvaliacaoJogo } from '@/components/avaliacao-jogo';
import { BarulhometroCard } from '@/components/barulhometro-card';
import { ComoChegar } from '@/components/como-chegar';
import { DistanciaCard } from '@/components/distancia-card';
import { Equipa } from '@/components/equipa';
import { EstadioCard } from '@/components/estadio-card';
import { MapaJogo } from '@/components/mapa-jogo';
import { MeteorologiaCard } from '@/components/meteorologia-card';
import { PontoEncontroCard } from '@/components/ponto-encontro-card';
import { RelogioDiaDeJogo } from '@/components/relogio-dia-de-jogo';
import { WcMaisProximo } from '@/components/wc-mais-proximo';
import { Spacing } from '@/constants/theme';
import { GoingButton } from '@/features/activity/components/GoingButton';
import { useNow } from '@/hooks/use-now';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { notaDoEstadio } from '@/lib/avaliacoes';
import { mostrarBarulhometro } from '@/lib/barulhometro';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { eCompeticaoEuropeia, estadoDoJogo } from '@/lib/jogos';
import { filtrarPorTempoAPe } from '@/lib/locais';
import { avisoDeChuva } from '@/lib/meteorologia';
import { mostrarRelogio } from '@/lib/relogio';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { nomesCompeticao, obterJogo } from '@/mocks/jogos';
import { locaisDoEstadio } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';
import { Aviso } from '@/ui/aviso';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

export default function JogoScreen() {
  const router = useRouter();
  const agora = useNow();
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  const { loading } = useSimulatedLoading(`jogo-${jogoId}`);
  const { avaliacoes, avaliacaoDoJogo, medicoesBarulho } = useAppState();

  const jogo = obterJogo(jogoId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;

  if (loading) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  if (!jogo || !casa || !fora || !estadio) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Este jogo foi adiado para parte incerta."
          action={{ label: 'Voltar aos jogos', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const estado = estadoDoJogo(jogo, agora);
  const relogioVisivel = mostrarRelogio(jogo, agora);
  const aviso = estado === 'terminado' ? null : avisoDeChuva(jogo.meteorologia, estadio);
  const { perto } = filtrarPorTempoAPe(locaisDoEstadio(estadio.id));

  const avaliacao = (
    <AvaliacaoJogo
      jogo={jogo}
      agora={agora}
      avaliacao={avaliacaoDoJogo(jogo.id)}
      onAvaliar={() => router.push({ pathname: '/jogos/avaliar', params: { jogoId: jogo.id } })}
    />
  );

  return (
    <Screen
      cabecalhoFixo={relogioVisivel ? <RelogioDiaDeJogo jogo={jogo} venue={estadio} /> : undefined}>
      <Stack.Screen options={{ title: `${casa.nomeCurto} x ${fora.nomeCurto}` }} />

      <Card style={styles.destaque}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
          {nomesCompeticao[jogo.competicao]} · {jogo.fase}
        </ThemedText>
        <View style={styles.equipas}>
          <Equipa clube={casa} size={64} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            vs
          </ThemedText>
          <Equipa clube={fora} size={64} />
        </View>
        <ThemedText type="smallBold" style={styles.centro}>
          {formatarDiaEHora(new Date(jogo.inicio))}
        </ThemedText>
        {estado !== 'agendado' ? (
          <View style={styles.estado}>
            <Badge
              label={estado === 'a-decorrer' ? 'A decorrer' : 'Terminado'}
              tone={estado === 'a-decorrer' ? 'accent' : 'neutral'}
            />
          </View>
        ) : null}
      </Card>

      {estado === 'agendado' ? <GoingButton fixtureId={jogo.id} /> : null}

      {aviso ? <Aviso title={aviso.titulo} message={aviso.mensagem} /> : null}

      {mostrarBarulhometro(jogo, agora, medicoesBarulho) ? (
        <>
          <SectionHeader title="Barulhómetro" trailing={estado === 'a-decorrer' ? 'Em jogo' : undefined} />
          <BarulhometroCard jogo={jogo} agora={agora} />
        </>
      ) : null}

      {estado === 'terminado' && !relogioVisivel ? avaliacao : null}

      {eCompeticaoEuropeia(jogo.competicao) ? (
        <>
          <SectionHeader title="Ponto de encontro oficial" />
          <PontoEncontroCard ponto={jogo.pontoEncontro} />
        </>
      ) : null}

      <SectionHeader title="Estádio" />
      <EstadioCard venue={estadio} nota={notaDoEstadio(avaliacoes, estadio.id)} />

      <SectionHeader title="WC mais próximo" />
      <WcMaisProximo origem={estadio.coordenadas} />

      <SectionHeader title="Mapa" />
      <MapaJogo venue={estadio} />

      <SectionHeader title="Meteorologia" trailing="Previsão simulada" />
      <MeteorologiaCard meteorologia={jogo.meteorologia} />

      <SectionHeader title="Distância" />
      <DistanciaCard venue={estadio} />

      <SectionHeader title="Como chegar" />
      <ComoChegar opcoes={estadio.transportes} />

      <Button
        label={
          perto.length > 0
            ? `Ver ${plural(perto.length, 'local', 'locais')} perto do estádio`
            : 'Ver locais perto do estádio'
        }
        icon={icons.locais}
        onPress={() => router.navigate({ pathname: '/locais', params: { estadio: estadio.id } })}
      />

      {estado === 'terminado' && !relogioVisivel ? null : avaliacao}
    </Screen>
  );
}

const styles = StyleSheet.create({
  destaque: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  centro: {
    textAlign: 'center',
  },
  equipas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  estado: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
