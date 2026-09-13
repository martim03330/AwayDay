import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DestaquesMenu } from '@/components/destaques-menu';
import { MenuTasco } from '@/components/menu-tasco';
import { WcMaisProximo } from '@/components/wc-mais-proximo';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { formatarDiaEHora } from '@/lib/datas';
import { formatarDistancia, plural } from '@/lib/formatos';
import { proximoJogoNoEstadio } from '@/lib/jogos';
import { lembretePelaMeteorologia } from '@/lib/pratos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { jogos } from '@/mocks/jogos';
import { nomesTipoLocal, obterLocal } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';
import { useSons } from '@/state/sons';
import { Badge } from '@/ui/badge';
import { BotaoAlternar } from '@/ui/botao-alternar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ContadorPessoas } from '@/ui/contador-pessoas';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { Medidor } from '@/ui/medidor';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SeletorNota } from '@/ui/seletor-nota';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

export default function LocalScreen() {
  const router = useRouter();
  const agora = useNow();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const { loading } = useSimulatedLoading(`local-${localId}`);
  const {
    fezCheckIn,
    alternarCheckIn,
    pessoasAqui,
    visitaDoLocal,
    registarVisitaManual,
    pratosRecomendados,
    alternarRecomendacao,
    notasTascos,
    darNotaTasco,
  } = useAppState();
  const { tocarCheckIn } = useSons();

  const local = obterLocal(localId);
  const estadio = local ? obterEstadio(local.estadioId) : undefined;

  if (loading) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={1} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  if (!local || !estadio) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Tasco não encontrado"
          message="Este tasco fechou as portas ou nunca existiu."
          action={{ label: 'Voltar aos locais', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const checkedIn = fezCheckIn(local.id);
  const visita = visitaDoLocal(local.id);
  const distancia = `${formatarDistancia(local.distanciaMetros)} · ${local.minutosAPe} min a pé`;
  const proximoJogo = proximoJogoNoEstadio(jogos, local.estadioId, agora);
  const lembrete = lembretePelaMeteorologia(proximoJogo?.meteorologia, local.pratos);
  const clubesAqui = local.clubesAqui
    .map((clubeId) => obterClube(clubeId)?.nomeCurto)
    .filter((nome): nome is string => Boolean(nome));

  function alternar() {
    if (!local) return;
    // O som só toca ao fazer check-in, nunca ao anular.
    if (!checkedIn) tocarCheckIn();
    alternarCheckIn(local.id);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: local.nome }} />

      <Card style={styles.destaque}>
        <View style={styles.etiquetas}>
          <Badge label={nomesTipoLocal[local.tipo]} tone="neutral" />
          <Badge label={'€'.repeat(local.precoMedio)} tone="neutral" />
          {checkedIn ? <Badge label="Estás aqui" /> : null}
        </View>
        <ThemedText style={styles.nome}>{local.nome}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`Perto do ${estadio.nome} · ${distancia}`}
        </ThemedText>
        <ContadorPessoas count={pessoasAqui(local)} large />
        {clubesAqui.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`Hoje por cá: adeptos do ${clubesAqui.join(' e do ')}`}
          </ThemedText>
        ) : null}
      </Card>

      <BotaoAlternar
        ativo={checkedIn}
        onPress={alternar}
        label={{ ativo: 'Check-in feito', inativo: 'Fazer check-in' }}
        icon={{ ativo: icons.checkInFeito, inativo: icons.checkIn }}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
        {checkedIn
          ? `Já contas para a claque: tu e mais ${plural(local.pessoasAqui, 'adepto', 'adeptos')}. Toca outra vez para anular.`
          : 'Diz à malta que já cá estás.'}
      </ThemedText>

      {visita ? (
        <View style={styles.visita}>
          <Etiqueta
            icon={visita.verificado ? icons.selecionado : icons.porVerificar}
            label={visita.verificado ? 'Visita verificada' : 'Visita por verificar'}
            tone={visita.verificado ? 'positivo' : 'aviso'}
          />
          {visita.verificado ? null : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
              Só conta para a pontuação depois de fazeres check-in no local.
            </ThemedText>
          )}
        </View>
      ) : (
        <Button
          label="Já estive aqui"
          variant="secondary"
          icon={icons.tasco}
          onPress={() => registarVisitaManual(local.id)}
        />
      )}

      <SectionHeader
        title="O que pedir"
        trailing={
          proximoJogo
            ? `Jogo ${formatarDiaEHora(new Date(proximoJogo.inicio)).toLowerCase()}`
            : undefined
        }
      />
      <DestaquesMenu pratos={local.pratos} recomendados={pratosRecomendados} lembrete={lembrete} />

      <SectionHeader title="WC mais próximo" />
      <WcMaisProximo origem={local.coordenadas} />

      <SectionHeader title="A tua nota" />
      <Card>
        <SeletorNota
          label="Dá nota a este tasco"
          description="Conta para a missão Crítico de tasco."
          value={notasTascos[local.id] ?? null}
          onChange={(nota) => darNotaTasco(local.id, nota)}
        />
      </Card>

      <SectionHeader title="Avaliação dos adeptos" />
      <Card style={styles.medidores}>
        <Medidor label="Cervejómetro" emoji="🍺" value={local.cervejometro} />
        <Medidor label="Petiscómetro" emoji="🍢" value={local.petiscometro} />
      </Card>

      <SectionHeader title="Menu" trailing={plural(local.pratos.length, 'prato', 'pratos')} />
      <MenuTasco
        pratos={local.pratos}
        recomendados={pratosRecomendados}
        onAlternarRecomendacao={alternarRecomendacao}
      />

      <SectionHeader title="Detalhes" />
      <Card style={styles.detalhes}>
        <ListRow
          leading={<IconCircle name={icons.especialidade} />}
          title="Especialidade"
          subtitle={local.especialidade}
        />
        <ListRow leading={<IconCircle name={icons.horario} />} title="Horário" subtitle={local.horario} />
        <ListRow leading={<IconCircle name={icons.aPe} />} title="Distância a pé" subtitle={distancia} />
      </Card>

      <SectionHeader title="Notas" />
      <Card>
        {local.notas.map((nota) => (
          <View key={nota} style={styles.nota}>
            <ThemedText type="small" themeColor="textSecondary">
              •
            </ThemedText>
            <ThemedText type="small" style={styles.flex}>
              {nota}
            </ThemedText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  destaque: {
    gap: Spacing.two,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  nome: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 700,
  },
  centro: {
    textAlign: 'center',
  },
  visita: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  medidores: {
    gap: Spacing.three,
  },
  detalhes: {
    gap: Spacing.three,
  },
  nota: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
