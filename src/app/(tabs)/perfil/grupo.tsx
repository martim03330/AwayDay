import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { inviteFriendToGroup } from '@/features/friends/api';
import { useMyFriends } from '@/features/friends/hooks/useFriends';
import {
  fetchGroupMembers,
  fetchGroupPlans,
  fetchGroupTrips,
  fetchMyGroups,
  GroupRefused,
  leaveGroup,
  removeGroupMember,
  renameGroup,
  rotateGroupInvite,
  type GroupMember,
} from '@/features/groups/api';
import { useProfileCards } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { setRideVisibility } from '@/features/rides/api';
import { setStayVisibility } from '@/features/stays/api';
import { formatarData, formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
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
  const planos = useQuery({
    queryKey: ['groups', 'plans', grupoId ?? null],
    queryFn: grupoId ? () => fetchGroupPlans(grupoId) : skipToken,
    meta: { persist: false },
  });
  const amigos = useMyFriends(userId !== null);
  const membros = useQuery({
    queryKey: ['groups', 'members', grupoId ?? null],
    queryFn: grupoId ? () => fetchGroupMembers(grupoId) : skipToken,
    meta: { persist: false },
  });

  const cartoes = useProfileCards((membros.data ?? []).map((pessoa) => pessoa.profileId));

  const [convidados, setConvidados] = useState<string[]>([]);
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

      {(amigos.data ?? []).filter(
        (amigo) => !lista.some((pessoa) => pessoa.profileId === amigo.profileId)
      ).length > 0 ? (
        <>
          <SectionHeader title="Convidar amigos" />
          <Card style={styles.grupo}>
            <ThemedText themeColor="textSecondary">
              O convite fica à espera que a pessoa aceite — ninguém entra num grupo sem querer.
            </ThemedText>
            {(amigos.data ?? [])
              .filter((amigo) => !lista.some((pessoa) => pessoa.profileId === amigo.profileId))
              .map((amigo) => (
                <LinhaGrupo
                  key={amigo.profileId}
                  leading={<IconCircle name={icons.perfil} tone="neutral" />}
                  title={amigo.displayName}
                  subtitle={
                    amigo.tripsTogether > 0
                      ? plural(amigo.tripsTogether, 'viagem juntos', 'viagens juntos')
                      : 'ainda sem viagens juntos'
                  }
                  trailing={
                    <LinkTexto
                      label={convidados.includes(amigo.profileId) ? 'Convidado' : 'Convidar'}
                      onPress={() => {
                        if (convidados.includes(amigo.profileId)) return;
                        void tratar(() => inviteFriendToGroup(grupo.id, amigo.profileId)).then(
                          (feito) => {
                            if (feito) setConvidados((atuais) => [...atuais, amigo.profileId]);
                          }
                        );
                      }}
                    />
                  }
                />
              ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Quem está no grupo" trailing={String(lista.length)} />
      {lista.map((pessoa) => (
        <Card key={pessoa.profileId} style={styles.grupo}>
          <View style={styles.linha}>
            <Avatar
              nome={pessoa.displayName}
              url={
                (cartoes.data ?? []).find((cartao) => cartao.profileId === pessoa.profileId)
                  ?.avatarUrl
              }
            />
            <View style={styles.flex}>
              <ThemedText style={styles.nome} numberOfLines={1}>
                {pessoa.isMine ? `${pessoa.displayName} (tu)` : pessoa.displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {[
                  (cartoes.data ?? []).find((cartao) => cartao.profileId === pessoa.profileId)
                    ?.homeCity,
                  sinais(pessoa),
                ]
                  .filter(Boolean)
                  .join(' · ')}
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

      <SectionHeader title="O que o grupo tem em mãos" />
      {(planos.data ?? []).length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            Nada por agora. Quando alguém oferecer boleia ou propuser uma casa, pode marcá-la como
            sendo deste grupo — e aparece aqui, para a malta encher antes de abrir a toda a gente.
          </ThemedText>
        </Card>
      ) : (
        (planos.data ?? []).map((plano) => {
          const jogoDoPlano = obterJogo(plano.fixtureId);
          const nomeDoJogo = jogoDoPlano
            ? `${obterClube(jogoDoPlano.casaId)?.nomeCurto ?? ''} x ${obterClube(jogoDoPlano.foraId)?.nomeCurto ?? ''}`
            : 'Jogo';
          const livres = Math.max(0, plano.seatsTotal - plano.taken);
          return (
            <Card
              key={`${plano.kind}-${plano.id}`}
              style={styles.grupo}
              onPress={() =>
                plano.kind === 'boleia'
                  ? router.push({
                      pathname: '/jogos/boleia',
                      params: { rideId: plano.id, jogoId: plano.fixtureId },
                    })
                  : router.push({
                      pathname: '/jogos/[jogoId]',
                      params: { jogoId: plano.fixtureId },
                    })
              }
              accessibilityLabel={`${plano.kind === 'boleia' ? 'Boleia' : 'Casa'} de ${plano.ownerName} para ${nomeDoJogo}. Toca para abrir.`}>
              <ThemedText style={styles.nome}>
                {`${plano.kind === 'boleia' ? 'Boleia' : 'Casa'} de ${plano.isMine ? 'ti' : plano.ownerName} · ${nomeDoJogo}`}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[
                  plano.kind === 'boleia' && plano.departureAt
                    ? `sai ${formatarDiaEHora(new Date(plano.departureAt)).toLowerCase()}`
                    : formatarData(new Date(plano.kickoffAt)),
                  livres > 0
                    ? plural(livres, 'lugar por encher', 'lugares por encher')
                    : 'sem lugares',
                  `${formatarCentimos(plano.shareNowCents)} cada`,
                ].join(' · ')}
              </ThemedText>
              <View style={styles.etiquetas}>
                <Etiqueta
                  icon={plano.visibility === 'grupo' ? icons.perfil : icons.partilhar}
                  label={plano.visibility === 'grupo' ? 'Só do grupo' : 'Aberta a toda a gente'}
                  tone={plano.visibility === 'grupo' ? 'info' : 'positivo'}
                />
                {plano.status === 'reservada' ? (
                  <Etiqueta icon={icons.selecionado} label="Casa reservada" tone="positivo" />
                ) : null}
              </View>
              {plano.isMine && plano.visibility === 'grupo' && livres > 0 ? (
                <LinkTexto
                  label="Não enche? Abrir a toda a gente"
                  onPress={() =>
                    void tratar(async () => {
                      if (plano.kind === 'boleia') await setRideVisibility(plano.id, true);
                      else await setStayVisibility(plano.id, true);
                      void queryClient.invalidateQueries({ queryKey: ['rides'] });
                      void queryClient.invalidateQueries({ queryKey: ['stays'] });
                    })
                  }
                />
              ) : null}
            </Card>
          );
        })
      )}

      <SectionHeader title="Viagens do grupo" />
      {(viagens.data ?? []).length === 0 ? (
        <Card>
          <ThemedText themeColor="textSecondary">
            Ainda não há viagens deste grupo. Assim que alguém oferecer uma boleia, propuser uma
            casa ou abrir as contas de um jogo, a viagem fica aqui — mesmo depois do jogo acabar.
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
                  viagem.expenses > 0 ? `${formatarCentimos(viagem.totalCents)} em contas` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
              <LinkTexto
                label={viagem.expenses > 0 ? 'Ver as contas' : 'Contas da viagem'}
                onPress={() =>
                  router.push({
                    pathname: '/jogos/contas',
                    params: { jogoId: viagem.fixtureId, grupoId: grupo.id },
                  })
                }
              />
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
        O grupo serve para juntar a malta, encher os carros e as casas, e dividir as contas de cada
        viagem. A app não move dinheiro nenhum: só diz quem paga a quem.
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
    gap: Spacing.two,
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
