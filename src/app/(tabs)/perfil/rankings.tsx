import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchVerifiedPlacesRanking } from '@/features/presence/api';
import { useMyProfile, useUpdateRankingVisibility } from '@/features/profile/hooks/useMyProfile';
import { fetchStadiumRanking } from '@/features/stamps/api';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

type Linha = { chave: string; posicao: number; nome: string; detalhe: string; sou: boolean };

function Tabela({ linhas, vazio }: { linhas: readonly Linha[]; vazio: string }) {
  const theme = useTheme();

  if (linhas.length === 0) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">{vazio}</ThemedText>
      </Card>
    );
  }

  return (
    <Card style={styles.tabela}>
      {linhas.map((linha) => (
        <View
          key={linha.chave}
          style={[
            styles.linha,
            linha.sou && { backgroundColor: theme.backgroundSelected, borderRadius: 12 },
          ]}>
          <ThemedText type="score" style={styles.posicao} themeColor="textSecondary">
            {linha.posicao}
          </ThemedText>
          <View style={styles.flex}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {linha.sou ? `${linha.nome} (tu)` : linha.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {linha.detalhe}
            </ThemedText>
          </View>
        </View>
      ))}
    </Card>
  );
}

/**
 * Os rankings públicos: estádios carimbados no local e tascos verificados. Qualquer pessoa com conta os vê — não é
 * preciso ser amigo de ninguém —, mas só aparece lá quem escolheu aparecer. Contam apenas as coisas confirmadas pela
 * app: carimbos feitos no estádio em dia de jogo, e check-ins feitos no tasco.
 */
export default function RankingsScreen() {
  const router = useRouter();
  const userId = useUserId();
  const theme = useTheme();
  const perfil = useMyProfile(userId);
  const mudarVisibilidade = useUpdateRankingVisibility(userId);

  const estadios = useQuery({
    queryKey: ['rankings', 'stadiums'],
    queryFn: userId ? () => fetchStadiumRanking(20) : skipToken,
    meta: { persist: false },
  });
  const tascos = useQuery({
    queryKey: ['rankings', 'places'],
    queryFn: userId ? fetchVerifiedPlacesRanking : skipToken,
    meta: { persist: false },
  });

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.ranking}
          title="Precisas de conta"
          message="Os rankings são de pessoas reais: entra para os veres e para entrares neles."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  const linhasEstadios: Linha[] = (estadios.data ?? []).map((linha, indice) => ({
    chave: linha.profileId,
    posicao: indice + 1,
    nome: linha.displayName,
    detalhe: `${plural(linha.stadiums, 'estádio', 'estádios')} · ${plural(linha.visits, 'visita', 'visitas')}`,
    sou: linha.isMe,
  }));

  const linhasTascos: Linha[] = (tascos.data ?? []).map((linha) => ({
    chave: `${linha.position}-${linha.displayName}`,
    posicao: linha.position,
    nome: linha.displayName,
    detalhe: plural(linha.value, 'tasco verificado', 'tascos verificados'),
    sou: linha.isMe,
  }));

  const apareco = perfil.data?.showInRankings ?? false;

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Contam só as coisas que a app confirmou: carimbos feitos no estádio em dia de jogo e
        check-ins feitos no tasco. Marcar à mão que se esteve num sítio não conta aqui.
      </ThemedText>

      <Card style={styles.grupo}>
        <View style={styles.linhaSwitch}>
          <ThemedText style={styles.flex}>Aparecer no ranking com o meu nome</ThemedText>
          <Switch
            value={apareco}
            onValueChange={(valor) => mudarVisibilidade.mutate(valor)}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.accentText}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Aparecer no ranking com o meu nome"
          />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {apareco
            ? 'O teu nome e o número de estádios e tascos aparecem a quem abrir esta página.'
            : 'Vês o ranking e a tua posição, mas mais ninguém te vê aqui.'}
        </ThemedText>
      </Card>

      <SectionHeader title="Estádios carimbados" />
      <Tabela
        linhas={linhasEstadios}
        vazio="Ainda ninguém carimbou estádios. Em dia de jogo, no estádio, a app confirma que lá estás."
      />

      <SectionHeader title="Tascos verificados" />
      <Tabela
        linhas={linhasTascos}
        vazio="Ainda ninguém tem tascos verificados. Faz check-in no tasco em dia de jogo."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Spacing.two,
  },
  tabela: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  posicao: {
    minWidth: 28,
    fontSize: 20,
    textAlign: 'center',
  },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
