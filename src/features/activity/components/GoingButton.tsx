import { Alert, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAttendance, useSetGoing } from '@/features/activity/hooks/useAttendance';
import { useUserId } from '@/lib/session';
import { BotaoAlternar } from '@/ui/botao-alternar';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** "Vou a este jogo" on an upcoming fixture. Only with an account: it feeds the match-day suggestions. */
export function GoingButton({ fixtureId }: { fixtureId: string }) {
  const userId = useUserId();
  const attendance = useAttendance(userId, fixtureId);
  const setGoing = useSetGoing(userId, fixtureId);

  if (!userId) return null;

  const going = attendance.data === 'going' || attendance.data === 'attended';

  function toggle() {
    if (setGoing.isPending) return;
    setGoing.mutate(!going, {
      onError: () => Alert.alert('Não deu para guardar', 'Tenta outra vez daqui a nada.'),
    });
  }

  return (
    <View style={styles.block}>
      <BotaoAlternar
        ativo={going}
        onPress={toggle}
        label={{ ativo: 'Vais a este jogo', inativo: 'Vou a este jogo' }}
        icon={{ ativo: icons.selecionado, inativo: icons.jogos }}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {going
          ? 'Toca outra vez se mudares de planos.'
          : 'Marca e dizemos-te o que há perto do estádio no dia.'}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
});
