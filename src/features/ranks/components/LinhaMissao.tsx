import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import type { Mission } from '@/features/ranks/types';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** The catalogue names an icon by text; anything the app does not know becomes the mission icon. */
export function iconeDaMissao(nome: string): IconName {
  return Object.prototype.hasOwnProperty.call(icons, nome) ? (nome as IconName) : icons.missao;
}

function useCores(missao: Mission) {
  const theme = useTheme();
  if (missao.completedAt) return { fundo: theme.accent, tinta: theme.accentText };
  if (missao.progress > 0) return { fundo: theme.warningBackground, tinta: theme.warning };
  return { fundo: theme.backgroundSelected, tinta: theme.textMuted };
}

/** A mission as one compact row, for lists inside a card (this week's challenges on the Ranking). */
export function LinhaMissao({
  missao,
  separador = false,
  onTirarFoto,
}: {
  missao: Mission;
  separador?: boolean;
  /** For missions proven by a photo: shows the camera button inside the row while the mission is open. */
  onTirarFoto?: () => void;
}) {
  const theme = useTheme();
  const cores = useCores(missao);
  const feita = missao.completedAt !== null;
  const pedeFoto = missao.needsProofPhoto && !feita && onTirarFoto !== undefined;
  return (
    <View
      accessible={!pedeFoto}
      accessibilityLabel={`${missao.title}. ${feita ? 'Feito' : `${missao.progress} de ${missao.target}`}. Mais ${missao.xp} pontos.`}
      style={[
        stylesLinha.linha,
        separador && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}>
      <View style={[stylesLinha.azulejo, { backgroundColor: cores.fundo }]}>
        <Icon
          name={feita ? icons.checkInFeito : iconeDaMissao(missao.icon)}
          size={20}
          color={cores.tinta}
        />
      </View>
      <View style={stylesLinha.corpo}>
        <ThemedText
          type="smallBold"
          style={feita ? { color: theme.textSecondary } : undefined}
          numberOfLines={2}>
          {missao.title}
        </ThemedText>
        {!feita && missao.target > 1 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {`${missao.progress} de ${missao.target}`}
          </ThemedText>
        ) : null}
        {pedeFoto ? (
          <Pressable
            onPress={onTirarFoto}
            accessibilityRole="button"
            accessibilityLabel={`Tirar a foto de prova: ${missao.title}`}
            hitSlop={12}
            style={({ pressed }) => [
              stylesLinha.foto,
              { backgroundColor: theme.successBackground },
              pressed && stylesLinha.premido,
            ]}>
            <Icon name={icons.camara} size={15} color={theme.accentInk} strokeWidth={2.4} />
            <ThemedText type="smallBold" themeColor="accentInk">
              Tirar a foto
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
      <ThemedText type="smallBold" themeColor={feita ? 'textMuted' : 'accentInk'}>
        {`+${missao.xp}`}
      </ThemedText>
    </View>
  );
}

const stylesLinha = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    paddingVertical: Spacing.twoAndHalf,
  },
  azulejo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: {
    flex: 1,
    gap: Spacing.half,
  },
  foto: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.twoAndHalf,
    borderRadius: 999,
  },
  premido: {
    opacity: 0.7,
  },
});
