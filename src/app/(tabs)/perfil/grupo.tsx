import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  fetchGroupMembers,
  fetchGroupTrips,
  fetchMyGroups,
  GroupRefused,
  leaveGroup,
  removeGroupMember,
  renameGroup,
  rotateGroupInvite,
  type GroupMember,
} from '@/features/groups/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof GroupRefused)) return 'Não deu para fazer isso. Tenta outra vez.';
  switch (erro.reason) {
    case 'not_owner':
      return 'Só quem criou o grupo é que pode fazer isso.';
    case 'bad_name':
      return 'O nome do grupo tem de ter entre 2 e 60 letras.';
    case 'own_membership':
      return 'Para saíres do grupo usa «Sair do grupo».';
    default:
      return 'Não deu para fazer isso. Tenta outra vez.';
  }
}

/** "na app desde setembro de 2026 · 3 boleias": o que a app sabe mesmo de cada um. */
function sinais(pessoa: GroupMember) {
  const desde = pessoa.memberSince
    ? new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(
        new Date(pessoa.memberSince)
      )
    : null;
  return [
    desde ? `na app desde ${desde}` : null,
    plural(pessoa.ridesCompleted, 'boleia', 'boleias'),
    pessoa.ridesFaults > 0 ? plural(pessoa.ridesFaults, 'falta', 'faltas') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Um grupo: quem está lá dentro, o link do convite e o que só quem o criou pode mudar. */
export default function GrupoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { grupoId } = useLocalSearchParams<{ grupoId?: string }>();

  const grupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });
  const viagens = useQuery({
    queryKey: ['groups', 'trips', grupoId ?? null],
    queryFn: grupoId ? () => fetchGroupTrips(grupoId) : skipToken,
    meta: { persist: false },
  });
  const membros = useQuery({
    queryKey: ['groups', 'members', grupoId ?? null],
    queryFn: grupoId ? () => fetchGroupMembers(grupoId) : skipToken,
    meta: { persist: false },
  });

  const [nome, setNome] = useState('');
  const [aMudarNome, setAMudarNome] = useState(false);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const grupo = (grupos.data ?? []).find((candidato) => candidato.id === grupoId);

  if (!userId || !grupoId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Grupo não encontrado"
          message="Volta aos teus grupos e tenta outra vez."
          action={{ label: 'Os meus grupos', onPress: () => router.replace('/perfil/grupos') }}
        />
      </Screen>
    );
  }

  if (!grupo) {
    return (
      <Screen>
        {grupos.isLoading ? (
          <ThemedText themeColor="textSecondary">A abrir o grupo…</ThemedText>
        ) : (
          <EmptyState
            icon={icons.naoEncontrado}
            title="Já não estás neste grupo"
            message="Podes ter saído, ou alguém pode ter-te tirado."
            action={{ label: 'Os meus grupos', onPress: () => router.replace('/perfil/grupos') }}
          />
        )}
      </Screen>
    );
  }

  const souDono = grupo.role === 'owner';
  const lista = membros.data ?? [];

  async function tratar(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      return true;
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      return false;
    } finally {
      setATratar(false);
    }
  }

  const convidar = async () => {
    const link = Linking.createURL('/grupos/entrar', { queryParams: { code: grupo.inviteCode } });
    await Share.share({
      message: `Anda para o grupo "${grupo.name}" no AwayDay: ${link}`,
    }).catch(() => undefined);
  };

  const sair = () => {
    const alvo = grupo.id;
    Alert.alert(
      'Sair do grupo?',
      souDono
        ? 'O grupo fica com o membro mais antigo. Se fores o último, o grupo acaba.'
        : 'Deixas de ver o que a malta combinar por aqui.',
      [
        { text: 'Ficar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () =>
            void tratar(() => leaveGroup(alvo)).then((saiu) => {
              if (saiu) router.replace('/perfil/grupos');
            }),
        },
      ]
    );
  };

  return (
    <Screen>
      <ThemedText type="title">{grupo.name}</ThemedText>
      <View style={styles.etiquetas}>
        <Etiqueta
          icon={icons.perfil}
          label={plural(grupo.members, 'pessoa', 'pessoas')}
          tone="neutro"
        />
        {grupo.source === 'boleia' ? (
          <Etiqueta icon={icons.carro} label="Nasceu de uma boleia" tone="info" />
        ) : null}
        {souDono ? (
          <Etiqueta icon={icons.selecionado} label="Criaste este grupo" tone="positivo" />
        ) : null}
      </View>

      <SectionHeader title="Convidar" />
      <Card style={styles.grupo}>
        <ThemedText themeColor="textSecondary">
          Manda o link a quem quiseres. Quem o abrir entra no grupo — por isso manda-o só a quem
          queres mesmo lá dentro.
        </ThemedText>
        <Button
          label="Partilhar o link do grupo"
          icon={icons.partilhar}
          onPress={() => void convidar()}
        />
        {souDono ? (
          <LinkTexto
            label="Trocar o link (o antigo deixa de servir)"
            onPress={() =>
              void tratar(async () => {
                await rotateGroupInvite(grupo.id);
              })
            }
          />
        ) : null}
      </Card>

      <SectionHeader title="Quem está no grupo" trailing={String(lista.length)} />
      {lista.map((pessoa) => (
        <Card key={pessoa.profileId} style={styles.grupo}>
          <View style={styles.linha}>
            <View style={styles.flex}>
              <ThemedText style={styles.nome} numberOfLines={1}>
                {pessoa.isMine ? `${pessoa.displayName} (tu)` : pessoa.displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {sinais(pessoa)}
              </ThemedText>
            </View>
            {pessoa.role === 'owner' ? (
              <Etiqueta icon={icons.selecionado} label="Dono" tone="neutro" />
            ) : null}
          </View>
          {souDono && !pessoa.isMine ? (
            <LinkTexto
              label="Tirar do grupo"
              onPress={() => void tratar(() => removeGroupMember(grupo.id, pessoa.profileId))}
            />
          ) : null}
        </Card>
      ))}

      <SectionHeader title="Viagens do grupo" />
      {(viagens.data ?? []).length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            Ainda não há viagens deste grupo. Quando alguém oferecer uma boleia ou propuser uma
            casa, pode dizer que é deste grupo — e fica aqui.
          </ThemedText>
        </Card>
      ) : (
        (viagens.data ?? []).map((viagem) => {
          const jogo = obterJogo(viagem.fixtureId);
          const nome = jogo
            ? `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`
            : 'Jogo';
          return (
            <Card
              key={viagem.fixtureId}
              onPress={
                jogo
                  ? () =>
                      router.push({
                        pathname: '/jogos/[jogoId]',
                        params: { jogoId: viagem.fixtureId },
                      })
                  : undefined
              }
              accessibilityLabel={`${nome}. Toca para abrir o jogo.`}>
              <ThemedText style={styles.nome}>{nome}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[
                  formatarData(new Date(viagem.kickoffAt)),
                  viagem.rides > 0 ? plural(viagem.rides, 'boleia', 'boleias') : null,
                  viagem.seatsTaken > 0
                    ? `${plural(viagem.seatsTaken, 'lugar', 'lugares')} dados`
                    : null,
                  viagem.houses > 0 ? plural(viagem.houses, 'casa', 'casas') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            </Card>
          );
        })
      )}

      {souDono ? (
        <>
          <SectionHeader title="Nome do grupo" />
          <Card style={styles.grupo}>
            {aMudarNome ? (
              <>
                <Campo
                  label="Novo nome"
                  value={nome}
                  onChangeText={setNome}
                  placeholder={grupo.name}
                  maxLength={60}
                />
                <Button
                  label="Guardar"
                  disabled={aTratar}
                  onPress={() =>
                    void tratar(() => renameGroup(grupo.id, nome)).then((mudou) => {
                      if (mudou) setAMudarNome(false);
                    })
                  }
                />
                <LinkTexto label="Deixa estar" onPress={() => setAMudarNome(false)} />
              </>
            ) : (
              <LinkTexto
                label="Mudar o nome"
                onPress={() => {
                  setNome(grupo.name);
                  setAMudarNome(true);
                }}
              />
            )}
          </Card>
        </>
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}

      <Card style={styles.grupo}>
        <LinkTexto label="Sair do grupo" onPress={sair} />
      </Card>

      <ThemedText type="small" themeColor="textMuted">
        Para já, o grupo serve para juntar a malta e ver quem é quem. A divisão de contas da viagem
        entra a seguir.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grupo: {
    gap: Spacing.two,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  nome: {
    fontWeight: 700,
  },
});
