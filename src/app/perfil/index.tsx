import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDia } from '@/lib/datas';
import { formatarNota, plural } from '@/lib/formatos';
import { notaMedia } from '@/lib/jogos';
import { DIVISOES, nomesDivisao, obterClube } from '@/mocks/clubes';
import { estadios, obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import type { Avaliacao } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { ProgressBar } from '@/ui/progress-bar';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function LinhaAvaliacao({ avaliacao, onPress }: { avaliacao: Avaliacao; onPress: () => void }) {
  const theme = useTheme();
  const jogo = obterJogo(avaliacao.jogoId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  if (!jogo || !casa || !fora) return null;

  const estadio = obterEstadio(jogo.estadioId);
  const media = formatarNota(notaMedia(avaliacao));

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${casa.nomeCurto} contra ${fora.nomeCurto}, ${formatarDia(new Date(jogo.inicio))}, nota ${media} de 5. Abrir jogo.`}>
      <View style={styles.linhaAvaliacao}>
        <View style={styles.escudos}>
          <Escudo clube={casa} size={28} />
          <Escudo clube={fora} size={28} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold">
            {casa.nomeCurto} x {fora.nomeCurto}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {`${formatarDia(new Date(jogo.inicio))}${estadio ? ` · ${estadio.nome}` : ''}`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`Estádio ${avaliacao.estadio} · Ambiente ${avaliacao.ambiente} · Acessos ${avaliacao.acessos}`}
          </ThemedText>
        </View>
        <ThemedText style={[styles.nota, { color: theme.accent }]}>★ {media}</ThemedText>
      </View>
    </Card>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { clubeFavoritoId, estadiosVisitados, totalCheckIns, avaliacoes } = useAppState();

  const clube = obterClube(clubeFavoritoId);
  const estadioDoClube = clube ? obterEstadio(clube.estadioId) : undefined;
  const visitados = estadios.filter((estadio) => estadiosVisitados.includes(estadio.id)).length;

  const gruposPassaporte = DIVISOES.map((divisao) => {
    const lista = estadios
      .filter((estadio) => obterClube(estadio.clubeId)?.divisao === divisao)
      .sort(
        (a, b) =>
          Number(estadiosVisitados.includes(b.id)) - Number(estadiosVisitados.includes(a.id))
      );
    return {
      divisao,
      lista,
      visitados: lista.filter((estadio) => estadiosVisitados.includes(estadio.id)).length,
    };
  });

  const historico = Object.values(avaliacoes)
    .filter((avaliacao): avaliacao is Avaliacao => avaliacao !== undefined)
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));

  return (
    <Screen>
      <Card style={styles.perfil}>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.avatarEmoji}>🧣</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText type="smallBold" style={styles.nome}>
            Adepto AwayDay
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Modo demo · sem conta
          </ThemedText>
        </View>
      </Card>

      <SectionHeader title="Clube que apoio" />
      {clube ? (
        <Card
          onPress={() => router.push('/perfil/clube')}
          accessibilityLabel={`Clube que apoio: ${clube.nomeCurto}. Toca para mudar.`}>
          <ListRow
            leading={<Escudo clube={clube} size={40} />}
            title={clube.nomeCurto}
            subtitle={`${nomesDivisao[clube.divisao]}${estadioDoClube ? ` · ${estadioDoClube.nome}` : ''}`}
            trailing={<Icon name={icons.seguinte} size={16} color={theme.textSecondary} />}
          />
        </Card>
      ) : null}

      <SectionHeader title="Passaporte de estádios" />
      <Card style={styles.passaporte}>
        <View>
          <ThemedText style={styles.contagem}>
            {visitados} de {estadios.length}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            estádios visitados
          </ThemedText>
        </View>
        <ProgressBar
          progress={visitados / estadios.length}
          accessibilityLabel={`${visitados} de ${estadios.length} estádios visitados`}
        />

        {gruposPassaporte.map((grupo) => (
          <View key={grupo.divisao} style={styles.grupoPassaporte}>
            <View style={styles.cabecalhoGrupo}>
              <ThemedText type="smallBold">{nomesDivisao[grupo.divisao]}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {grupo.visitados} de {grupo.lista.length}
              </ThemedText>
            </View>
            <View style={styles.carimbos}>
              {grupo.lista.map((estadio) => {
                const dono = obterClube(estadio.clubeId);
                const visitado = estadiosVisitados.includes(estadio.id);
                return (
                  <View
                    key={estadio.id}
                    accessible
                    accessibilityLabel={`${estadio.nome}, ${visitado ? 'visitado' : 'por visitar'}`}
                    style={[
                      styles.carimbo,
                      { backgroundColor: theme.background },
                      !visitado && styles.porVisitar,
                    ]}>
                    {dono ? <Escudo clube={dono} size={28} /> : null}
                    <ThemedText type="small" numberOfLines={2} style={styles.carimboNome}>
                      {estadio.nome}
                    </ThemedText>
                    {visitado ? (
                      <Icon name={icons.visitado} size={16} color={theme.success} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader
        title="Jogos avaliados"
        trailing={historico.length > 0 ? plural(historico.length, 'jogo', 'jogos') : undefined}
      />
      {historico.length > 0 ? (
        historico.map((avaliacao) => (
          <LinhaAvaliacao
            key={avaliacao.jogoId}
            avaliacao={avaliacao}
            onPress={() =>
              router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: avaliacao.jogoId } })
            }
          />
        ))
      ) : (
        <Card>
          <EmptyState
            icon={icons.estrela}
            title="Ainda não avaliaste jogos"
            message="No fim de cada jogo, avalia o estádio, o ambiente e os acessos."
          />
        </Card>
      )}

      <Card>
        <ListRow
          leading={<IconCircle name={icons.checkIn} />}
          title="Check-ins nesta sessão"
          subtitle="Faz check-in nos locais antes do jogo."
          trailing={
            <ThemedText type="smallBold" style={styles.contagemCheckIns}>
              {totalCheckIns}
            </ThemedText>
          }
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  perfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  flex: {
    flex: 1,
  },
  nome: {
    fontSize: 18,
    lineHeight: 24,
  },
  passaporte: {
    gap: Spacing.three,
  },
  contagem: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  grupoPassaporte: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cabecalhoGrupo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  carimbos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  carimbo: {
    width: '32%',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: 14,
  },
  porVisitar: {
    opacity: 0.35,
  },
  carimboNome: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  linhaAvaliacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  escudos: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  nota: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  contagemCheckIns: {
    fontSize: 22,
    lineHeight: 28,
  },
});
