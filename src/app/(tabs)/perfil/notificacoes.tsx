import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMyProfile, useUpdateMessagePreferences } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { enablePushOnThisDevice, type PushPermission } from '@/lib/push';
import { useUserId } from '@/lib/session';
import {
  definicoesNotificacao,
  TIPOS_NOTIFICACAO,
  type DefinicaoNotificacao,
} from '@/mocks/notificacoes';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
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

function avisoDePermissao(permissao: PushPermission) {
  if (permissao === 'granted') return null;
  if (permissao === 'denied') {
    return 'As notificações estão desligadas nas definições do telemóvel: as dicas ficam só nas Novidades.';
  }
  return 'Neste telemóvel não recebes notificações push: as dicas ficam nas Novidades.';
}

/** Mensagens escritas pela AwayDay a partir da conta. Só aparece com sessão. */
function MensagensDaConta() {
  const theme = useTheme();
  const userId = useUserId();
  const perfil = useMyProfile(userId);
  const guardar = useUpdateMessagePreferences(userId);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!userId || !perfil.data) return null;
  const { nudgesEnabled, recapEnabled } = perfil.data;

  async function alternarSugestoes(ligar: boolean) {
    guardar.mutate({ nudgesEnabled: ligar });
    if (!ligar) {
      setAviso(null);
      return;
    }
    const permissao = await enablePushOnThisDevice().catch((): PushPermission => 'unavailable');
    setAviso(avisoDePermissao(permissao));
  }

  return (
    <>
      <SectionHeader title="Mensagens da AwayDay" />
      <Card style={styles.card}>
        <View style={styles.linha}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">Dicas para dias de jogo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              No máximo uma por dia, a partir do calendário e do que já fizeste na app.
            </ThemedText>
          </View>
          <Switch
            value={nudgesEnabled}
            disabled={guardar.isPending}
            onValueChange={(ligar) => void alternarSugestoes(ligar)}
            trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
            accessibilityLabel="Dicas para dias de jogo"
          />
        </View>
        <View style={styles.linha}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">Retrospetiva da época</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Um resumo em junho: jogos, estádios novos e o tasco onde mais voltaste.
            </ThemedText>
          </View>
          <Switch
            value={recapEnabled}
            disabled={guardar.isPending}
            onValueChange={(ligar) => guardar.mutate({ recapEnabled: ligar })}
            trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
            accessibilityLabel="Retrospetiva da época"
          />
        </View>
        {aviso ? (
          <ThemedText type="small" themeColor="textSecondary">
            {aviso}
          </ThemedText>
        ) : null}
      </Card>
    </>
  );
}

export default function NotificacoesScreen() {
  const theme = useTheme();
  const { notificacoes, alternarNotificacao } = useAppState();

  return (
    <Screen>
      <MensagensDaConta />

      <SectionHeader title="Outros avisos" />
      <ThemedText type="small" themeColor="textSecondary">
        Estes ainda não são enviados: escolhe o que queres receber e vê como fica.
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
