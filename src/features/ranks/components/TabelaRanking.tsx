import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { NumeroAnimado } from '@/ui/numero-animado';
import { Premivel } from '@/ui/premivel';
import { ThemedText } from '@/ui/themed-text';

export type LinhaTabela = {
  chave: string;
  posicao: number;
  nome: string;
  detalhe: string;
  /** The big number on the right (points, stadiums…). */
  valor: string;
  /** When given, the number behind `valor` and how to write it: the value then rolls when it changes. */
  numero?: { valor: number; formatar: (valor: number) => string };
  sou: boolean;
  /** Whose line it is: with `onAbrir`, tapping the line opens their profile. */
  perfilId?: string;
};

/** A ranking table. Your own line is highlighted, and stays in even when you are outside the top. */
export function TabelaRanking({
  linhas,
  vazio,
  onAbrir,
}: {
  linhas: readonly LinhaTabela[];
  vazio: string;
  /** Opens someone's profile; lines with a `perfilId` (other than yours) become tappable. */
  onAbrir?: (perfilId: string) => void;
}) {
  const theme = useTheme();
  const abrivel = (linha: LinhaTabela) => Boolean(onAbrir && linha.perfilId && !linha.sou);

  if (linhas.length === 0) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">{vazio}</ThemedText>
      </Card>
    );
  }

  return (
    <Card style={styles.tabela}>
      {linhas.map((linha, indice) => {
        const salto = indice > 0 && linha.posicao > (linhas[indice - 1]?.posicao ?? 0) + 1;
        return (
          <View key={linha.chave}>
            {salto ? (
              <ThemedText themeColor="textMuted" style={styles.salto}>
                ⋯
              </ThemedText>
            ) : null}
            <Premivel
              escala={0.98}
              disabled={!abrivel(linha)}
              onPress={() => linha.perfilId && onAbrir?.(linha.perfilId)}
              accessible
              accessibilityRole={abrivel(linha) ? 'button' : undefined}
              accessibilityLabel={`${linha.posicao}.º, ${linha.sou ? 'tu' : linha.nome}, ${linha.valor}, ${linha.detalhe}${abrivel(linha) ? '. Toca para ver o perfil.' : ''}`}
              style={styles.linha}>
              <ThemedText
                type="score"
                style={styles.posicao}
                themeColor={linha.posicao <= 3 ? 'accentInk' : 'textSecondary'}>
                {linha.posicao}
              </ThemedText>
              <View style={styles.flex}>
                {/* Your row stands out by its green name, not a grey box (testers did not like the box). */}
                <ThemedText type="smallBold" numberOfLines={1} themeColor={linha.sou ? 'accentInk' : undefined}>
                  {linha.sou ? `${linha.nome} (tu)` : linha.nome}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {linha.detalhe}
                </ThemedText>
              </View>
              {linha.numero ? (
                <NumeroAnimado valor={linha.numero.valor} formatar={linha.numero.formatar} type="smallBold" />
              ) : (
                <ThemedText type="smallBold">{linha.valor}</ThemedText>
              )}
              {abrivel(linha) ? <Icon name={icons.seguinte} size={14} color={theme.textMuted} /> : null}
            </Premivel>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  tabela: {
    gap: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  posicao: {
    minWidth: 28,
    fontSize: 20,
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  salto: {
    textAlign: 'center',
  },
});
