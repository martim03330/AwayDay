import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { proximoPlano } from '@/features/groups/fase-do-plano';
import type { FixturePlan } from '@/features/groups/plans';
import { useRealNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaEHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { obterClube } from '@/mocks/clubes';
import { obterJogo } from '@/mocks/jogos';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/**
 * The combined game, pinned under the chat header like a pinned message: with the group talking, the plan card soon
 * scrolls away. Tapping it opens the plan; «+2» says there are more (they are in «Planos»).
 */
export function PlanoFixado({
  planos,
  onAbrir,
}: {
  planos: readonly FixturePlan[];
  onAbrir: (plano: FixturePlan) => void;
}) {
  const theme = useTheme();
  const agora = useRealNow();
  const plano = proximoPlano(planos, agora);
  if (!plano) return null;

  const jogo = obterJogo(plano.fixtureId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const nome = casa && fora ? `${casa.nomeCurto} x ${fora.nomeCurto}` : 'Jogo combinado';
  const outros = planos.filter((outro) => outro.id !== plano.id && Date.parse(outro.kickoffAt) > agora).length;
  const quem = plano.going > 0 ? ` · ${plural(plano.going, 'vai', 'vão')}` : '';

  return (
    <Pressable
      onPress={() => onAbrir(plano)}
      accessibilityRole="button"
      accessibilityLabel={`Jogo combinado: ${nome}, ${formatarDiaEHora(new Date(plano.kickoffAt), agora)}. Toca para abrir o plano.`}
      style={({ pressed }) => [
        styles.barra,
        { backgroundColor: theme.backgroundElement, borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <Icon name={icons.calendario} size={18} color={theme.accentInk} />
      {casa && fora ? (
        <View style={styles.escudos}>
          <Escudo clube={casa} size={18} />
          <Escudo clube={fora} size={18} />
        </View>
      ) : null}
      <View style={styles.texto}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {nome}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {`${formatarDiaEHora(new Date(plano.kickoffAt), agora)}${quem}`}
        </ThemedText>
      </View>
      {outros > 0 ? (
        <ThemedText type="smallBold" themeColor="textSecondary">{`+${outros}`}</ThemedText>
      ) : null}
      <Icon name={icons.seguinte} size={16} color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  escudos: {
    flexDirection: 'row',
    gap: 2,
  },
  texto: {
    flex: 1,
  },
});
