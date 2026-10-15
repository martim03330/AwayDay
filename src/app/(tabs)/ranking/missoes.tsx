import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { iconeDaMissao, LinhaMissao } from '@/features/ranks/components/LinhaMissao';
import { useAcaoDaMissao } from '@/features/ranks/hooks/useAcaoDaMissao';
import { rankingKey, useMyMissions } from '@/features/ranks/hooks/useRanking';
import { conquistasPorFamilia, nomeDoPatamar, segundaFeiraDe } from '@/features/ranks/labels';
import type { Mission } from '@/features/ranks/types';
import { useTheme } from '@/hooks/use-theme';
import { usePuxarParaAtualizar } from '@/hooks/use-puxar-para-atualizar';
import { chaveDoDia } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Icon, icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';
import { Expansor } from '@/ui/expansor';

function contagem(missoes: readonly Mission[]) {
  const feitas = missoes.filter((missao) => missao.completedAt !== null).length;
  return missoes.length > 0 ? `${feitas} de ${missoes.length}` : undefined;
}

/** Earned badges, as a shelf of tiles. */
function Distintivos({ ganhos }: { ganhos: readonly Mission[] }) {
  const theme = useTheme();
  if (ganhos.length === 0) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          Ainda sem distintivos. O primeiro está a três estádios de distância.
        </ThemedText>
      </Card>
    );
  }
  return (
    <Card style={styles.prateleira}>
      {ganhos.map((missao) => (
        <View
          key={missao.id}
          style={styles.distintivo}
          accessible
          accessibilityLabel={`Distintivo ${missao.badge ?? missao.title}`}>
          <View style={[styles.azulejo, { backgroundColor: theme.accent }]}>
            <Icon name={iconeDaMissao(missao.icon)} size={22} color={theme.accentText} />
          </View>
          <ThemedText type="small" numberOfLines={2} style={styles.distintivoNome}>
            {missao.badge ?? missao.title}
          </ThemedText>
          {missao.tier ? (
            <ThemedText type="small" themeColor="textMuted" style={styles.distintivoNome}>
              {nomeDoPatamar(missao.tier)}
            </ThemedText>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

/** How points are earned, in the same order as the server adds them. */
const REGRAS: readonly [string, string][] = [
  ['Estádio carimbado no local, em dia de jogo', '+100'],
  ['Primeira vez nesse estádio', '+150'],
  ['Jogo fora, com o teu clube de visitante', '+50'],
  ['Check-in num tasco (até 2 por dia)', '+20'],
  ['Foto de tasco aprovada', '+15'],
  ['Avaliação de onde estiveste', '+10'],
  ['Missões e desafios', 'os pontos de cada um'],
];

/**
 * Todas as missões: os desafios da semana (e os da próxima, para planear), as da época e as conquistas para a vida,
 * em patamares de bronze, prata e ouro. O progresso vem do servidor, com o que a app confirmou.
 */
export default function MissoesScreen() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const { fonte } = useAppState();
  const conta = fonte === 'conta' ? userId : null;
  const missoes = useMyMissions(conta);
  const puxar = usePuxarParaAtualizar(() => queryClient.invalidateQueries({ queryKey: rankingKey(conta) }));
  const agir = useAcaoDaMissao();
  const [verRegras, setVerRegras] = useState(false);

  if (!conta) {
    return (
      <Screen>
        <EmptyState
          icon={icons.missao}
          title="As missões precisam de conta"
          message="O progresso é confirmado pelo servidor, no estádio e nos tascos. Entra para começares."
        />
      </Screen>
    );
  }

  const todas = missoes.data ?? [];
  const estaSemana = segundaFeiraDe(chaveDoDia(new Date()));
  const desafios = todas.filter((missao) => missao.kind === 'weekly' && missao.weekStart === estaSemana);
  const proximos = todas.filter(
    (missao) => missao.kind === 'weekly' && missao.weekStart !== null && missao.weekStart > estaSemana
  );
  const daEpoca = todas
    .filter((missao) => missao.kind === 'season')
    .sort((a, b) => a.sort - b.sort);
  const familias = conquistasPorFamilia(todas);
  const ganhos = familias.flatMap((familia) => familia.ganhos);
  const conquistas = todas.filter((missao) => missao.kind === 'achievement');

  const lista = (itens: readonly Mission[]) => (
    <Card style={styles.lista}>
      {itens.map((missao, indice) => (
        <LinhaMissao
          key={`${missao.weekStart ?? ''}-${missao.id}`}
          missao={missao}
          separador={indice < itens.length - 1}
          onAcao={(acao) => agir(missao, acao)}
        />
      ))}
    </Card>
  );

  return (
    <Screen
      refreshing={puxar.refreshing}
      onRefresh={puxar.onRefresh}>
      {missoes.isLoading ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : (
        <>
          <SectionHeader title="Desafios da semana" trailing={contagem(desafios)} />
          {desafios.length > 0 ? (
            lista(desafios)
          ) : (
            <ThemedText themeColor="textSecondary">
              Esta semana não há jogos no calendário, por isso não há desafios.
            </ThemedText>
          )}

          {proximos.length > 0 ? (
            <>
              <SectionHeader title="Na próxima semana" />
              {lista(proximos)}
            </>
          ) : null}

          {daEpoca.length > 0 ? (
            <>
              <SectionHeader title="Esta época" trailing={contagem(daEpoca)} />
              {lista(daEpoca)}
            </>
          ) : null}

          <SectionHeader title="Conquistas" trailing={contagem(conquistas)} />
          <Distintivos ganhos={ganhos} />
          {lista(familias.map(({ atual }) => atual))}

          <Expansor
            icon={icons.ranking}
            titulo="Como se ganham pontos"
            aberto={verRegras}
            onPress={() => setVerRegras((atual) => !atual)}
          />
          {verRegras ? (
            <Card style={styles.regras}>
              {REGRAS.map(([regra, pontos]) => (
                <View key={regra} style={styles.regraLinha}>
                  <ThemedText type="small" style={styles.flex}>
                    {regra}
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="accentInk">
                    {pontos}
                  </ThemedText>
                </View>
              ))}
              <ThemedText type="small" themeColor="textMuted">
                Só conta o que a app confirmou no local. Nenhuma missão pede contacto físico nem
                trocas: quando a prova é uma foto, é tirada na hora.
              </ThemedText>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  regras: {
    gap: Spacing.two,
  },
  regraLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  prateleira: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  distintivo: {
    width: 76,
    alignItems: 'center',
    gap: Spacing.one,
  },
  azulejo: {
    width: 52,
    height: 52,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distintivoNome: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 15,
  },
});
