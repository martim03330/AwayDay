import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchMyGroups } from '@/features/groups/api';
import { rotuloDeOutroGrupo } from '@/features/groups/partilha';
import { setRideVisibility, type RideSummary } from '@/features/rides/api';
import { useRefreshRides } from '@/features/rides/hooks/useRides';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/**
 * A boleia de um grupo, numa linha: de que grupo é e quem a vê. O grupo escolhe-se ao oferecer a boleia (ou vem do
 * plano); aqui já não se muda — eram duas maneiras de fazer a mesma coisa. Sem grupo, não aparece nada.
 */
export function GrupoDaBoleia({ boleia, participante }: { boleia: RideSummary; participante: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const atualizar = useRefreshRides();
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState(false);
  const meusGrupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });

  if (!userId || !participante || !boleia.groupId || !boleia.groupName) return null;
  const grupoId = boleia.groupId;
  const soDoGrupo = boleia.visibility === 'grupo';
  // A car of a group I am not in: I see it because a plan was sent to one of my groups.
  const deOutroGrupo = meusGrupos.data !== undefined && !meusGrupos.data.some((grupo) => grupo.id === grupoId);
  // Opening a full car to everyone makes no sense: the offer only shows while there are free seats.
  const temLugares = boleia.seatsTaken < boleia.seatsOffered;
  const titulo = deOutroGrupo ? rotuloDeOutroGrupo('boleia', boleia.groupName) : `Boleia do grupo ${boleia.groupName}`;

  async function abrirATodos() {
    setErro(false);
    setATratar(true);
    try {
      await setRideVisibility(boleia.id, true);
      await atualizar();
    } catch {
      setErro(true);
    } finally {
      setATratar(false);
    }
  }

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={deOutroGrupo ? undefined : () => router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } })}
        accessibilityRole={deOutroGrupo ? 'text' : 'button'}
        accessibilityLabel={`${titulo}. ${soDoGrupo ? 'Só a malta do grupo a vê' : 'Aberta a toda a gente'}.${deOutroGrupo ? '' : ' Toca para abrir o grupo.'}`}
        style={({ pressed }) => [styles.linha, pressed && styles.premido]}>
        <Icon name={icons.perfil} size={20} color={theme.accentInk} />
        <ThemedText type="smallBold" style={styles.flex}>
          {titulo}
        </ThemedText>
        {deOutroGrupo ? null : <Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
      </Pressable>
      {boleia.isMine && soDoGrupo && temLugares ? (
        <LinkTexto
          label={aTratar ? 'A abrir…' : 'Abrir a toda a gente'}
          disabled={aTratar}
          onPress={() => void abrirATodos()}
        />
      ) : null}
      {erro ? (
        <ThemedText type="small" style={{ color: theme.dangerText }}>
          Não deu para abrir a boleia. Tenta outra vez.
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  flex: {
    flex: 1,
  },
  premido: {
    opacity: 0.7,
  },
});
