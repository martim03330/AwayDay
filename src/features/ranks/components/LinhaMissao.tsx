import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { guiaDaMissao, type AcaoDaMissao } from '@/features/ranks/guias';
import type { Mission } from '@/features/ranks/types';
import { useTheme } from '@/hooks/use-theme';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** The catalogue names an icon by text; anything the app does not know becomes the mission icon. */
export function iconeDaMissao(nome: string): IconName {
  return Object.prototype.hasOwnProperty.call(icons, nome) ? (nome as IconName) : icons.missao;
}

const ICONE_DA_ACAO: Readonly<Record<AcaoDaMissao, IconName>> = {
  'abrir-camara': icons.camara,
  'ver-jogos': icons.jogos,
  'ver-tascos': icons.tasco,
};

function useCores(missao: Mission) {
  const theme = useTheme();
  if (missao.completedAt) return { fundo: theme.accent, tinta: theme.accentText };
  if (missao.progress > 0) return { fundo: theme.warningBackground, tinta: theme.warning };
  return { fundo: theme.backgroundSelected, tinta: theme.textMuted };
}

/**
 * A mission as one compact row, for lists inside a card. With `onAcao`, tapping the row opens how to complete it in
 * two or three steps and one button that goes straight there (the camera, the games, the tascos near you).
 */
export function LinhaMissao({
  missao,
  separador = false,
  onAcao,
}: {
  missao: Mission;
  separador?: boolean;
  onAcao?: (acao: AcaoDaMissao) => void;
}) {
  const theme = useTheme();
  const cores = useCores(missao);
  const [aberta, setAberta] = useState(false);
  const feita = missao.completedAt !== null;
  const guia = guiaDaMissao(missao.metric);
  const resumo = `${missao.title}. ${feita ? 'Feito' : `${missao.progress} de ${missao.target}`}. Mais ${missao.xp} pontos.`;

  const cabecalho = (
    <View style={stylesLinha.linha}>
      <View style={[stylesLinha.azulejo, { backgroundColor: cores.fundo }]}>
        <Icon name={feita ? icons.checkInFeito : iconeDaMissao(missao.icon)} size={20} color={cores.tinta} />
      </View>
      <ThemedText
        type="smallBold"
        style={[stylesLinha.corpo, feita ? { color: theme.textSecondary } : undefined]}
        numberOfLines={2}>
        {missao.title}
      </ThemedText>
      {!feita && missao.target > 1 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`${missao.progress}/${missao.target}`}
        </ThemedText>
      ) : null}
      <ThemedText type="smallBold" themeColor={feita ? 'textMuted' : 'accentInk'}>
        {`+${missao.xp}`}
      </ThemedText>
      {onAcao ? (
        <Icon name={aberta ? icons.fechar : icons.seguinte} size={16} color={theme.textMuted} />
      ) : null}
    </View>
  );

  const contorno = separador && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border };

  if (!onAcao) {
    return (
      <View accessible accessibilityLabel={resumo} style={contorno}>
        {cabecalho}
      </View>
    );
  }

  return (
    <View style={contorno}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
          setAberta((atual) => !atual);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        accessibilityLabel={`${resumo} ${aberta ? 'Toca para fechar.' : 'Toca para ver como fazer.'}`}
        style={({ pressed }) => pressed && stylesLinha.premido}>
        {cabecalho}
      </Pressable>

      {aberta ? (
        <View style={[stylesLinha.guia, { backgroundColor: theme.background }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {missao.description}
          </ThemedText>
          {guia && !feita ? (
            <View style={stylesLinha.passos}>
              {guia.passos.map((passo, indice) => (
                <View key={passo} style={stylesLinha.passo}>
                  <View style={[stylesLinha.numero, { backgroundColor: theme.successBackground }]}>
                    <ThemedText style={[stylesLinha.numeroTexto, { color: theme.accentInk }]}>{indice + 1}</ThemedText>
                  </View>
                  <ThemedText type="small" style={stylesLinha.passoTexto}>
                    {passo}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          {guia && !feita ? (
            <Pressable
              onPress={() => onAcao(guia.acao.tipo)}
              accessibilityRole="button"
              style={({ pressed }) => [
                stylesLinha.acao,
                { backgroundColor: pressed ? theme.accentPressed : theme.accent },
              ]}>
              <Icon name={ICONE_DA_ACAO[guia.acao.tipo]} size={18} color={theme.accentText} />
              <ThemedText style={[stylesLinha.acaoTexto, { color: theme.accentText }]}>{guia.acao.rotulo}</ThemedText>
            </Pressable>
          ) : null}
          {feita ? (
            <ThemedText type="small" themeColor="accentInk">
              Feita. Os pontos já estão no teu ranking.
            </ThemedText>
          ) : null}
        </View>
      ) : null}
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
    minWidth: 0,
    gap: Spacing.half,
  },
  premido: {
    opacity: 0.7,
  },
  guia: {
    gap: Spacing.twoAndHalf,
    padding: Spacing.three,
    marginBottom: Spacing.twoAndHalf,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
  },
  passos: {
    gap: Spacing.two,
  },
  passo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  numero: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  numeroTexto: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  passoTexto: {
    flex: 1,
    lineHeight: 20,
  },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 46,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
  },
  acaoTexto: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
});
