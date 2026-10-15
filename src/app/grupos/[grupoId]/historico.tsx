import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import type { GroupHistoryTrip } from '@/features/groups/history';
import { useGroupHistory } from '@/features/groups/hooks/useGroups';
import { useTheme } from '@/hooks/use-theme';
import { usePuxarParaAtualizar } from '@/hooks/use-puxar-para-atualizar';
import { plural } from '@/lib/formatos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { iniciais } from '@/ui/avatar';
import { Escudo } from '@/ui/escudo';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';
import { useFormatarDinheiro } from '@/ui/valor';

const formatoData = new Intl.DateTimeFormat('pt-PT', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Lisbon',
});

/** "Martim, Rui e Ana", "Martim, Rui, Ana e mais 2". */
function quemFoi(nomes: string[]) {
  const curtos = nomes.map((nome) => nome.split(' ')[0]);
  if (curtos.length <= 1) return curtos.join('');
  if (curtos.length <= 3) return `${curtos.slice(0, -1).join(', ')} e ${curtos[curtos.length - 1]}`;
  return `${curtos.slice(0, 3).join(', ')} e mais ${curtos.length - 3}`;
}

/**
 * O histórico do grupo: as viagens já feitas em que foram pelo menos dois da malta. Não é para contas — é para
 * recordar. Cada viagem abre o álbum.
 */
export default function HistoricoDoGrupoScreen() {
  const router = useRouter();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();
  const historico = useGroupHistory(grupoId ?? null);
  const puxar = usePuxarParaAtualizar(() => historico.refetch());
  const lista = historico.data ?? [];

  return (
    <Screen refreshing={puxar.refreshing} onRefresh={puxar.onRefresh}>
      {historico.isLoading ? (
        <>
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </>
      ) : lista.length === 0 ? (
        <EmptyState
          icon={icons.album}
          title="As recordações estão para vir"
          message="Cada jogo em que forem dois ou mais fica aqui, com o álbum."
        />
      ) : (
        lista.map((viagem) => (
          <CartaoDeRecordacao
            key={viagem.sessionId}
            viagem={viagem}
            onPress={() =>
              router.push({
                pathname: '/sessao/[sessaoId]/recordacao',
                params: { sessaoId: viagem.sessionId },
              })
            }
          />
        ))
      )}
    </Screen>
  );
}

function CartaoDeRecordacao({
  viagem,
  onPress,
}: {
  viagem: GroupHistoryTrip;
  onPress: () => void;
}) {
  const dinheiro = useFormatarDinheiro();
  const theme = useTheme();
  const jogo = obterJogo(viagem.fixtureId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const nome = casa && fora ? `${casa.nomeCurto} x ${fora.nomeCurto}` : 'Jogo';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nome}, ${formatoData.format(new Date(viagem.kickoffAt))}. Foram ${quemFoi(viagem.companions)}. Toca para abrir o álbum.`}
      style={({ pressed }) => [
        styles.cartao,
        CardShadow,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.premido,
      ]}>
      <View style={[styles.capa, { backgroundColor: theme.accent }]}>
        {viagem.coverUrl ? (
          <Image
            source={{ uri: viagem.coverUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={StyleSheet.absoluteFill}>
            {[0, 1, 2, 3, 4, 5].map((faixa) => (
              <View
                key={faixa}
                style={[styles.faixa, { top: faixa * 44, backgroundColor: theme.accentPressed }]}
              />
            ))}
          </View>
        )}
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="sombra" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.35" stopColor="#000000" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.72} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sombra)" />
        </Svg>

        {casa && fora ? (
          <View style={styles.escudos}>
            <Escudo clube={casa} size={28} />
            <Escudo clube={fora} size={28} />
          </View>
        ) : null}

        <View style={styles.legenda}>
          <ThemedText type="eyebrow" style={styles.dataCapa}>
            {[formatoData.format(new Date(viagem.kickoffAt)), estadio?.cidade]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
          <ThemedText type="title" style={styles.tituloCapa} numberOfLines={1}>
            {nome}
          </ThemedText>
        </View>
      </View>

      <View style={styles.corpo}>
        <View style={styles.malta}>
          <View style={styles.caras}>
            {viagem.companions.slice(0, 4).map((pessoa, indice) => (
              <View
                key={`${pessoa}-${indice}`}
                style={[
                  styles.cara,
                  {
                    backgroundColor: theme.successBackground,
                    borderColor: theme.backgroundElement,
                    marginLeft: indice === 0 ? 0 : -10,
                  },
                ]}>
                <ThemedText type="smallBold" style={[styles.iniciais, { color: theme.accentInk }]}>
                  {iniciais(pessoa.split(' ')[0])}
                </ThemedText>
              </View>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
            {`Foram ${quemFoi(viagem.companions)}`}
          </ThemedText>
        </View>
        <LinhaDetalhes
          partes={[
            viagem.photos > 0 ? plural(viagem.photos, 'foto', 'fotos') : 'sem fotos',
            `${dinheiro.formatar(viagem.totalCents)} gastos`,
            plural(viagem.people, 'pessoa', 'pessoas'),
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartao: {
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  premido: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  capa: {
    height: 160,
    justifyContent: 'flex-end',
  },
  faixa: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 22,
    opacity: 0.35,
  },
  escudos: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  legenda: {
    padding: Spacing.three,
    gap: 2,
  },
  dataCapa: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  tituloCapa: {
    color: '#FFFFFF',
  },
  corpo: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  malta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  caras: {
    flexDirection: 'row',
  },
  cara: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iniciais: {
    fontSize: 11,
  },
  flex: {
    flex: 1,
  },
});
