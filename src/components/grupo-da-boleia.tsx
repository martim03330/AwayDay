import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
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

  if (!userId || !participante || !boleia.groupId || !boleia.groupName) return null;
  const grupoId = boleia.groupId;
  const soDoGrupo = boleia.visibility === 'grupo';

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
        onPress={() => router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } })}
        accessibilityRole="button"
        accessibilityLabel={`Boleia do grupo ${boleia.groupName}. ${soDoGrupo ? 'Só a malta do grupo a vê' : 'Aberta a toda a gente'}. Toca para abrir o grupo.`}
        style={({ pressed }) => [styles.linha, pressed && styles.premido]}>
        <Icon name={icons.perfil} size={20} color={theme.accentInk} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">{`Boleia do grupo ${boleia.groupName}`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {soDoGrupo ? 'Só a malta do grupo a vê' : 'Aberta a toda a gente'}
          </ThemedText>
        </View>
        <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
      </Pressable>
      {boleia.isMine && soDoGrupo ? (
        <LinkTexto
          label={aTratar ? 'A abrir…' : 'O carro não enche? Abrir a toda a gente'}
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
    gap: Spacing.half,
  },
  premido: {
    opacity: 0.7,
  },
});
