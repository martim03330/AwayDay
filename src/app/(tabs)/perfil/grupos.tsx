import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { acceptGroupInvite, declineGroupInvite } from '@/features/friends/api';
import { useMyGroupInvites, useRefreshFriends } from '@/features/friends/hooks/useFriends';
import { createGroup, fetchMyGroups, GroupRefused } from '@/features/groups/api';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ListRow } from '@/ui/list-row';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof GroupRefused)) return 'Não deu para criar o grupo. Tenta outra vez.';
  switch (erro.reason) {
    case 'bad_name':
      return 'O nome do grupo tem de ter entre 2 e 60 letras.';
    case 'rate_limited':
      return 'Já criaste grupos que cheguem por hoje.';
    default:
      return 'Não deu para criar o grupo. Tenta outra vez.';
  }
}

/**
 * Os grupos da malta com quem se vai aos jogos. Alguns são criados aqui, outros nascem sozinhos de uma boleia —
 * quando alguém entra no teu carro, fica logo um grupo com quem vai.
 */
export default function GruposScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const grupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });

  const convites = useMyGroupInvites(userId !== null);
  const refrescarAmigos = useRefreshFriends();

  const [nome, setNome] = useState('');
  const [aCriar, setACriar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Os grupos juntam pessoas reais: entra para criares o teu."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  async function criar() {
    const limpo = nome.trim();
    if (limpo.length < 2) {
      setErro('Escreve um nome para o grupo.');
      return;
    }
    setErro(null);
    setACriar(true);
    try {
      const id = await createGroup(limpo);
      setNome('');
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      router.push({ pathname: '/perfil/grupo', params: { grupoId: id } });
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setACriar(false);
    }
  }

  const lista = grupos.data ?? [];
  const porResponder = convites.data ?? [];

  async function responder(acao: () => Promise<void>) {
    setErro(null);
    try {
      await acao();
      void refrescarAmigos();
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    } catch {
      setErro('Não deu para responder ao convite. Tenta outra vez.');
    }
  }

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Um grupo é a malta com quem costumas ir aos jogos. Lá dentro combinam a boleia, a casa e as
        contas — e podes convidar quem quiseres por link.
      </ThemedText>

      {porResponder.length > 0 ? (
        <>
          <SectionHeader title="Convites" trailing={String(porResponder.length)} />
          {porResponder.map((convite) => (
            <Card key={convite.groupId} style={styles.grupo}>
              <ThemedText style={styles.nome}>{convite.groupName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[
                  convite.invitedByName ? `${convite.invitedByName} convidou-te` : 'Convite',
                  plural(convite.members, 'pessoa', 'pessoas'),
                ].join(' · ')}
              </ThemedText>
              <Button
                label="Entrar no grupo"
                icon={icons.perfil}
                onPress={() => void responder(() => acceptGroupInvite(convite.groupId))}
              />
              <LinkTexto
                label="Agora não"
                onPress={() => void responder(() => declineGroupInvite(convite.groupId))}
              />
            </Card>
          ))}
        </>
      ) : null}

      {lista.length > 0 ? (
        <>
          <SectionHeader title="Os teus grupos" trailing={String(lista.length)} />
          {lista.map((grupo) => (
            <Card
              key={grupo.id}
              onPress={() =>
                router.push({ pathname: '/perfil/grupo', params: { grupoId: grupo.id } })
              }
              accessibilityLabel={`${grupo.name}, ${plural(grupo.members, 'pessoa', 'pessoas')}. Toca para abrir.`}>
              <ListRow
                leading={
                  <IconCircle
                    name={icons.perfil}
                    tone={grupo.role === 'owner' ? 'green' : 'neutral'}
                  />
                }
                title={grupo.name}
                subtitle={plural(grupo.members, 'pessoa', 'pessoas')}
                trailing={
                  grupo.source === 'boleia' ? (
                    <Etiqueta icon={icons.carro} label="Da boleia" tone="info" />
                  ) : undefined
                }
              />
            </Card>
          ))}
        </>
      ) : grupos.isLoading ? (
        <ThemedText themeColor="textSecondary">A procurar os teus grupos…</ThemedText>
      ) : (
        <Card>
          <ThemedText themeColor="textSecondary">
            Ainda não estás em nenhum grupo. Cria um para a malta do costume, ou espera que te
            convidem: quem já foi contigo a um jogo pode adicionar-te como amigo e convidar-te.
          </ThemedText>
        </Card>
      )}

      <SectionHeader title="Criar um grupo" />
      <Card style={styles.grupo}>
        <Campo
          label="Nome do grupo"
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: A malta do café"
          maxLength={60}
        />
        {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
        <Button
          label={aCriar ? 'A criar…' : 'Criar grupo'}
          icon={icons.perfil}
          disabled={aCriar}
          onPress={() => void criar()}
        />
        <ThemedText type="small" themeColor="textMuted">
          Depois de criado, partilhas um link e quem o abrir entra no grupo. Podes trocar o link
          quando quiseres.
        </ThemedText>
      </Card>

      <View style={styles.rodape}>
        <LinkTexto label="Voltar ao perfil" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nome: {
    fontWeight: '600',
  },
  grupo: {
    gap: Spacing.two,
  },
  rodape: {
    alignItems: 'flex-start',
  },
});
