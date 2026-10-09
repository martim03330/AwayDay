import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { AreaFeedback, FeedbackItem } from '@/features/feedback/api';
import {
  useFeedbackInbox,
  useSetFeedbackStatus,
  type FeedbackStatus,
} from '@/features/feedback/hooks/useFeedbackInbox';
import { useMyProfile } from '@/features/profile/hooks/useMyProfile';
import { formatarDiaEHora } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const AREAS: Record<AreaFeedback, string> = {
  jogos: 'Jogos',
  boleias: 'Boleias',
  contas: 'Contas',
  locais: 'Tascos',
  mapa: 'Mapa',
  perfil: 'Perfil',
  grupos: 'Grupos',
  outro: 'Outro',
};

const ESTADOS: readonly { valor: FeedbackStatus; rotulo: string }[] = [
  { valor: 'novo', rotulo: 'Novos' },
  { valor: 'visto', rotulo: 'Vistos' },
  { valor: 'resolvido', rotulo: 'Resolvidos' },
];

/**
 * Admins read what people sent from «Ajudar a melhorar» (and the automatic error reports), and mark each one as
 * seen or handled. Only for `profile.is_admin`; the RPC refuses everyone else anyway.
 */
export default function FeedbackAdminScreen() {
  const router = useRouter();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const eAdmin = perfil.data?.isAdmin === true;
  const [estado, setEstado] = useState<FeedbackStatus>('novo');
  const caixa = useFeedbackInbox(eAdmin, estado);
  const mudar = useSetFeedbackStatus();

  function marcar(item: FeedbackItem, novo: FeedbackStatus) {
    mudar.mutate(
      { id: item.id, status: novo },
      { onError: () => Alert.alert('Não foi possível', 'Verifica a ligação e tenta outra vez.') }
    );
  }

  const titulo = <Stack.Screen options={{ title: 'Erros e ideias' }} />;

  if (perfil.isLoading || (eAdmin && caixa.isLoading)) {
    return (
      <Screen>
        {titulo}
        <SkeletonCard lines={4} />
      </Screen>
    );
  }

  if (!eAdmin) {
    return (
      <Screen>
        {titulo}
        <EmptyState
          icon={icons.perfil}
          title="Só para administradores"
          message="Este ecrã serve para ler os erros e as ideias que os adeptos enviam."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const lista = caixa.data ?? [];

  return (
    <Screen refreshing={caixa.isRefetching} onRefresh={() => void caixa.refetch()}>
      {titulo}
      <View style={styles.estados}>
        {ESTADOS.map((opcao) => (
          <Chip
            key={opcao.valor}
            label={opcao.rotulo}
            selected={estado === opcao.valor}
            onPress={() => setEstado(opcao.valor)}
          />
        ))}
      </View>

      {caixa.isError ? (
        <EmptyState
          icon={icons.erro}
          title="Sem ligação"
          message="Puxa para baixo para tentar outra vez."
          action={{ label: 'Tentar outra vez', onPress: () => void caixa.refetch() }}
        />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={icons.selecionado}
          title="Nada por aqui"
          message={
            estado === 'novo' ? 'Não há nada novo. A app anda a portar-se bem.' : 'Ainda não há nenhum.'
          }
        />
      ) : (
        lista.map((item) => (
          <Card key={item.id} style={styles.card}>
            <View style={styles.cabecalho}>
              <Etiqueta
                label={item.kind === 'erro' ? 'Erro' : 'Ideia'}
                tone={item.kind === 'erro' ? 'aviso' : 'info'}
              />
              <Etiqueta label={AREAS[item.area]} tone="neutro" />
            </View>
            <ThemedText style={styles.corpo}>{item.body}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                item.fromName ?? 'Sem conta',
                item.createdAt ? formatarDiaEHora(new Date(item.createdAt)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {[item.device, item.appVersion ? `versão ${item.appVersion}` : null]
                .filter(Boolean)
                .join(' · ') || 'Sem dados do aparelho'}
            </ThemedText>
            <View style={styles.botoes}>
              {item.status !== 'resolvido' ? (
                <View style={styles.flex}>
                  <Button
                    label="Já tratei"
                    icon={icons.selecionado}
                    disabled={mudar.isPending}
                    onPress={() => marcar(item, 'resolvido')}
                  />
                </View>
              ) : null}
              {item.status === 'novo' ? (
                <View style={styles.flex}>
                  <Button
                    label="Visto"
                    variant="secondary"
                    disabled={mudar.isPending}
                    onPress={() => marcar(item, 'visto')}
                  />
                </View>
              ) : (
                <View style={styles.flex}>
                  <Button
                    label="Voltar a novo"
                    variant="secondary"
                    disabled={mudar.isPending}
                    onPress={() => marcar(item, 'novo')}
                  />
                </View>
              )}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  estados: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
  cabecalho: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  corpo: {
    fontSize: 16,
    lineHeight: 22,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
