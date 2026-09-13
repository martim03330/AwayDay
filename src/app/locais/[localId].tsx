import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useSimulatedLoading } from '@/hooks/use-simulated-loading';
import { formatarDistancia, plural } from '@/lib/formatos';
import { obterEstadio } from '@/mocks/estadios';
import { nomesTipoLocal, obterLocal } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ContadorPessoas } from '@/ui/contador-pessoas';
import { EmptyState } from '@/ui/empty-state';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { Medidor } from '@/ui/medidor';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

export default function LocalScreen() {
  const router = useRouter();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const { loading } = useSimulatedLoading(`local-${localId}`);
  const { fezCheckIn, alternarCheckIn, pessoasAqui } = useAppState();

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
          title="Local não encontrado"
          message="Este local já não está disponível."
          action={{ label: 'Voltar aos locais', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const checkedIn = fezCheckIn(local.id);
  const distancia = `${formatarDistancia(local.distanciaMetros)} · ${local.minutosAPe} min a pé`;

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
      </Card>

      <Button
        label={checkedIn ? 'Check-in feito' : 'Fazer check-in'}
        variant={checkedIn ? 'secondary' : 'primary'}
        icon={checkedIn ? icons.checkInFeito : icons.checkIn}
        onPress={() => alternarCheckIn(local.id)}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
        {checkedIn
          ? `Estás aqui com mais ${plural(local.pessoasAqui, 'adepto', 'adeptos')}. Toca outra vez para anular.`
          : 'Avisa os outros adeptos de que estás aqui.'}
      </ThemedText>

      <SectionHeader title="Avaliação dos adeptos" />
      <Card style={styles.medidores}>
        <Medidor label="Cervejómetro" emoji="🍺" value={local.cervejometro} />
        <Medidor label="Petiscómetro" emoji="🍢" value={local.petiscometro} />
      </Card>

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
