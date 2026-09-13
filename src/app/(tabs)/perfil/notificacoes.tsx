import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  definicoesNotificacao,
  TIPOS_NOTIFICACAO,
  type DefinicaoNotificacao,
} from '@/mocks/notificacoes';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Screen } from '@/ui/screen';
import { ThemedText } from '@/ui/themed-text';

function ExemploNotificacao({
  exemplo,
  ligada,
}: {
  exemplo: DefinicaoNotificacao['exemplo'];
  ligada: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`Exemplo${ligada ? '' : ', desligada'}: ${exemplo.titulo}. ${exemplo.corpo}`}
      style={[
        styles.notificacao,
        { backgroundColor: theme.background, borderColor: theme.border },
        !ligada && styles.desligada,
      ]}>
      <View style={[styles.iconeApp, { backgroundColor: theme.accent }]}>
        <ThemedText type="smallBold" style={[styles.iconeAppTexto, { color: theme.accentText }]}>
          AD
        </ThemedText>
      </View>
      <View style={styles.flex}>
        <View style={styles.topo}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.nomeApp}>
            AWAYDAY
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.quando}>
            {exemplo.quando}
          </ThemedText>
        </View>
        <ThemedText type="smallBold">{exemplo.titulo}</ThemedText>
        <ThemedText type="small">{exemplo.corpo}</ThemedText>
      </View>
    </View>
  );
}

export default function NotificacoesScreen() {
  const theme = useTheme();
  const { notificacoes, alternarNotificacao } = useAppState();

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Nesta demo não enviamos nada: escolhe o que queres receber e vê como fica.
      </ThemedText>

      {TIPOS_NOTIFICACAO.map((tipo) => {
        const definicao = definicoesNotificacao[tipo];
        const ligada = notificacoes[tipo];
        return (
          <Card key={tipo} style={styles.card}>
            <View style={styles.linha}>
              <View style={styles.flex}>
                <ThemedText type="smallBold">{definicao.titulo}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {definicao.descricao}
                </ThemedText>
              </View>
              <Switch
                value={ligada}
                onValueChange={() => alternarNotificacao(tipo)}
                trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
                accessibilityLabel={definicao.titulo}
              />
            </View>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rotuloExemplo}>
              Exemplo
            </ThemedText>
            <ExemploNotificacao exemplo={definicao.exemplo} ligada={ligada} />
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  rotuloExemplo: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificacao: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  desligada: {
    opacity: 0.45,
  },
  iconeApp: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeAppTexto: {
    fontSize: 12,
    lineHeight: 16,
  },
  topo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nomeApp: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  quando: {
    fontSize: 12,
    lineHeight: 16,
  },
});
