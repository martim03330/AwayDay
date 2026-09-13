import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { HistoricoAvaliacoes } from '@/components/historico-avaliacoes';
import { HistoricoTascos } from '@/components/historico-tascos';
import { PassaporteCard } from '@/components/passaporte-card';
import { RankingCard } from '@/components/ranking-card';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarNumero, plural } from '@/lib/formatos';
import { contarTascosVerificados, ID_UTILIZADOR, montarRanking } from '@/lib/tascos';
import { nomesDivisao, obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { TIPOS_NOTIFICACAO } from '@/mocks/notificacoes';
import { rankingMock } from '@/mocks/ranking';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

export default function PerfilScreen() {
  const router = useRouter();
  const theme = useTheme();
  const {
    clubeFavoritoId,
    clubeDaTerraId,
    estadiosVisitados,
    estadiosPorCarimbar,
    marcarCarimbosVistos,
    avaliacoes,
    visitasLocais,
    sonsLigados,
    alternarSons,
    notificacoes,
  } = useAppState();

  const clube = obterClube(clubeFavoritoId);
  const estadioDoClube = clube ? obterEstadio(clube.estadioId) : undefined;
  const clubeDaTerra = clubeDaTerraId ? obterClube(clubeDaTerraId) : undefined;
  const tascosVerificados = contarTascosVerificados(visitasLocais);
  const ranking = montarRanking(rankingMock, {
    id: ID_UTILIZADOR,
    nome: 'Tu',
    clubeId: clubeFavoritoId,
    tascosVerificados,
  });
  const notificacoesLigadas = TIPOS_NOTIFICACAO.filter((tipo) => notificacoes[tipo]).length;
  const chevron = <Icon name={icons.seguinte} size={16} color={theme.textSecondary} />;

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
            {`Modo demo · ${plural(tascosVerificados, 'tasco verificado', 'tascos verificados')}`}
          </ThemedText>
        </View>
      </Card>

      <SectionHeader title="Clube que apoio" />
      {clube ? (
        <Card
          onPress={() => router.push('/perfil/clube')}
          accessibilityLabel={`Clube que apoio: ${clube.nomeCurto}, ${formatarNumero(clube.adeptosNaApp)} adeptos na app. Toca para mudar.`}>
          <ListRow
            leading={<Escudo clube={clube} size={40} />}
            title={clube.nomeCurto}
            subtitle={[
              clube.divisao ? nomesDivisao[clube.divisao] : null,
              estadioDoClube?.nome ?? null,
              `${formatarNumero(clube.adeptosNaApp)} adeptos na app`,
            ]
              .filter(Boolean)
              .join(' · ')}
            trailing={chevron}
          />
        </Card>
      ) : null}

      <SectionHeader title="Clube da terra" />
      {clubeDaTerra ? (
        <Card
          onPress={() => router.push('/perfil/clube-terra')}
          accessibilityLabel={`Clube da terra: ${clubeDaTerra.nomeCurto}. Toca para mudar.`}>
          <ListRow
            leading={<Escudo clube={clubeDaTerra} size={40} />}
            title={clubeDaTerra.nomeCurto}
            subtitle={`${formatarNumero(clubeDaTerra.adeptosNaApp)} adeptos na app`}
            trailing={chevron}
          />
        </Card>
      ) : (
        <Card>
          <ListRow
            leading={<IconCircle name={icons.casa} />}
            title="Ainda sem clube da terra"
            subtitle="Diz-nos de onde és. Nós sugerimos, tu confirmas."
          />
          <Button
            label="Escolher clube da terra"
            variant="secondary"
            icon={icons.localizacao}
            onPress={() => router.push('/perfil/clube-terra')}
          />
        </Card>
      )}

      <SectionHeader title="Passaporte de estádios" />
      <PassaporteCard
        estadiosVisitados={estadiosVisitados}
        avaliacoes={avaliacoes}
        estadiosPorCarimbar={estadiosPorCarimbar}
        onCarimbosVistos={marcarCarimbosVistos}
      />

      <SectionHeader
        title="Avaliações de estádios"
        trailing={avaliacoes.length > 0 ? plural(avaliacoes.length, 'visita', 'visitas') : undefined}
      />
      <HistoricoAvaliacoes
        avaliacoes={avaliacoes}
        onEditar={(jogoId) => router.push({ pathname: '/perfil/avaliar', params: { jogoId } })}
      />

      <SectionHeader title="Tascos visitados" trailing={`${tascosVerificados} pontos`} />
      <HistoricoTascos
        visitas={visitasLocais}
        onAbrirLocal={(localId) =>
          router.push({ pathname: '/locais/[localId]', params: { localId } })
        }
      />

      <SectionHeader title="Ranking de tascos verificados" />
      <RankingCard ranking={ranking} />

      <SectionHeader title="Definições" />
      <Card>
        <ListRow
          leading={<IconCircle name={icons.som} />}
          title="Sons"
          subtitle="Um som curto no check-in e quando ganhas um carimbo."
          trailing={
            <Switch
              value={sonsLigados}
              onValueChange={alternarSons}
              trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
              accessibilityLabel="Sons"
            />
          }
        />
      </Card>
      <Card
        onPress={() => router.push('/perfil/notificacoes')}
        accessibilityLabel={`Notificações: ${notificacoesLigadas} de ${TIPOS_NOTIFICACAO.length} ligadas. Toca para escolher.`}>
        <ListRow
          leading={<IconCircle name={icons.notificacoes} />}
          title="Notificações"
          subtitle={`${notificacoesLigadas} de ${TIPOS_NOTIFICACAO.length} ligadas`}
          trailing={chevron}
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
});
