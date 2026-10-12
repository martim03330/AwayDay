import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useModeracao } from '@/features/moderation/components/Moderacao';
import { usePublicProfile } from '@/features/profile/hooks/useMyProfile';
import { plural } from '@/lib/formatos';
import { obterClube } from '@/mocks/clubes';
import { Avatar } from '@/ui/avatar';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

/** "setembro de 2026". */
function mesEAno(data: string) {
  return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(data));
}

/**
 * Someone else's profile, opened from a group or a car chat. Only what is public: photo, name, city, club, since when,
 * rides and stamped stadiums. Never where the person is. The server only answers for people you share a group, a ride
 * or a friendship with.
 */
export default function PerfilPublicoScreen() {
  const { pessoaId } = useLocalSearchParams<{ pessoaId?: string }>();
  const perfil = usePublicProfile(pessoaId ?? null);
  const moderacao = useModeracao();
  const pessoa = perfil.data;

  if (perfil.isLoading) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">A abrir o perfil…</ThemedText>
      </Screen>
    );
  }

  if (!pessoa) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title={perfil.isError ? 'Sem ligação' : 'Perfil indisponível'}
          message={
            perfil.isError
              ? 'Tenta outra vez daqui a pouco.'
              : 'Só vês o perfil de quem está contigo num grupo, numa boleia ou nos amigos.'
          }
        />
      </Screen>
    );
  }

  const clube = obterClube(pessoa.supporterClubId);
  const desde = pessoa.memberSince ? mesEAno(pessoa.memberSince) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: pessoa.displayName }} />
      {moderacao.elemento}

      <View style={styles.cabecalho}>
        <Avatar nome={pessoa.displayName} url={pessoa.avatarUrl} size={96} />
        <ThemedText type="subtitle" style={styles.centro}>
          {pessoa.isMe ? `${pessoa.displayName} (tu)` : pessoa.displayName}
        </ThemedText>
        {pessoa.homeCity || desde ? (
          <ThemedText themeColor="textSecondary" style={styles.centro}>
            {[pessoa.homeCity, desde ? `na app desde ${desde}` : null].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
      </View>

      {clube ? (
        <Card style={styles.linha}>
          <Escudo clube={clube} size={36} />
          <View style={styles.flex}>
            <ThemedText type="small" themeColor="textSecondary">
              Clube
            </ThemedText>
            <ThemedText type="smallBold">{clube.nomeCurto}</ThemedText>
          </View>
        </Card>
      ) : null}

      <View style={styles.numeros}>
        <Card style={styles.numero}>
          <ThemedText type="subtitle">{pessoa.stadiumsStamped}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {pessoa.stadiumsStamped === 1 ? 'estádio carimbado' : 'estádios carimbados'}
          </ThemedText>
        </Card>
        <Card style={styles.numero}>
          <ThemedText type="subtitle">{pessoa.ridesCompleted}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {pessoa.ridesCompleted === 1 ? 'boleia feita' : 'boleias feitas'}
          </ThemedText>
        </Card>
      </View>
      {pessoa.ridesFaults > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centro}>
          {`${plural(pessoa.ridesFaults, 'falta', 'faltas')} em boleias`}
        </ThemedText>
      ) : null}

      {pessoa.isMe ? null : (
        <LinkTexto
          neutro
          label="Denunciar ou bloquear"
          onPress={() =>
            moderacao.abrirPessoa({
              pessoa: { profileId: pessoa.profileId, nome: pessoa.displayName },
              temFoto: pessoa.avatarUrl !== null,
            })
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabecalho: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  centro: {
    textAlign: 'center',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  numeros: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  numero: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
});
