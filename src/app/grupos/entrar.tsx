import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchGroupByCode, GroupRefused, joinGroupWithCode } from '@/features/groups/api';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

/**
 * O que se vê ao abrir um convite de grupo: que grupo é, quanta gente tem, e um botão para entrar. Quem tem o link
 * entra — não há pedidos nem aprovações —, por isso a app diz claramente em que grupo se está a entrar antes.
 */
export default function EntrarNoGrupoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { code } = useLocalSearchParams<{ code?: string }>();

  const convite = useQuery({
    queryKey: ['groups', 'invite', code ?? null],
    queryFn: code && userId ? () => fetchGroupByCode(code) : skipToken,
    meta: { persist: false },
  });

  const [aEntrar, setAEntrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!code) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Convite sem código"
          message="Pede à malta que te mande o link outra vez."
          action={{ label: 'Voltar', onPress: () => router.replace('/malta') }}
        />
      </Screen>
    );
  }

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Entra na tua conta e abre o link outra vez para entrares no grupo."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  const grupo = convite.data;

  async function entrar() {
    setErro(null);
    setAEntrar(true);
    try {
      const id = await joinGroupWithCode(code as string);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.replace({ pathname: '/grupos/[grupoId]', params: { grupoId: id } });
    } catch (problema) {
      setErro(
        problema instanceof GroupRefused && problema.reason === 'group_not_found'
          ? 'Este convite já não serve. Pede à malta um link novo.'
          : 'Não deu para entrar no grupo. Tenta outra vez daqui a pouco.'
      );
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <Screen>
      {convite.isLoading ? (
        <ThemedText themeColor="textSecondary">A ver o convite…</ThemedText>
      ) : !grupo ? (
        <EmptyState
          icon={icons.naoEncontrado}
          title="Convite já não serve"
          message="O grupo pode ter trocado o link ou deixado de existir. Pede um link novo à malta."
          action={{ label: 'Os meus grupos', onPress: () => router.replace('/malta') }}
        />
      ) : (
        <Card style={styles.grupo}>
          <ThemedText type="title">{grupo.name}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {`${plural(grupo.members, 'pessoa', 'pessoas')} neste grupo.`}
          </ThemedText>
          {grupo.alreadyIn ? (
            <>
              <ThemedText>Já estás neste grupo.</ThemedText>
              <Button
                label="Abrir o grupo"
                onPress={() =>
                  router.replace({ pathname: '/grupos/[grupoId]', params: { grupoId: grupo.id } })
                }
              />
            </>
          ) : (
            <>
              <Button
                label={aEntrar ? 'A entrar…' : 'Entrar no grupo'}
                icon={icons.perfil}
                disabled={aEntrar}
                onPress={() => void entrar()}
              />
              <ThemedText type="small" themeColor="textMuted">
                Ao entrares, a malta do grupo passa a ver o teu nome e o que a app sabe de ti: desde
                quando tens conta, quantas boleias fizeste e quantas faltas tens.
              </ThemedText>
            </>
          )}
          {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
          <LinkTexto neutro label="Agora não" onPress={() => router.replace('/malta')} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Spacing.two,
  },
});
