import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { saveNotificationPreference } from '@/features/profile/api';
import { useMyProfile, useUpdateMessagePreferences } from '@/features/profile/hooks/useMyProfile';
import {
  useNotificationPreferences,
  useRefreshNotificationPreferences,
} from '@/features/profile/hooks/useNotificationPreferences';
import type { NotificationKind } from '@/features/profile/types';
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
import { Icon } from '@/ui/icon';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

type LinhaInterruptorProps = {
  titulo: string;
  descricao: string;
  value: boolean;
  onValueChange: (ligar: boolean) => void;
  disabled?: boolean;
  /** Hairline under the row, when another row follows. */
  divisoria?: boolean;
};

/** Title, one line of explanation and a switch, as in the "Interruptor e linha" component. */
function LinhaInterruptor({
  titulo,
  descricao,
  value,
  onValueChange,
  disabled,
  divisoria,
}: LinhaInterruptorProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.linha,
        divisoria && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected },
      ]}>
      <View style={styles.flex}>
        <ThemedText style={styles.tituloLinha}>{titulo}</ThemedText>
        <ThemedText style={styles.descricao} themeColor="textSecondary">
          {descricao}
        </ThemedText>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent, false: theme.border }}
        ios_backgroundColor={theme.border}
        accessibilityLabel={titulo}
      />
    </View>
  );
}

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
        <ThemedText type="section" style={[styles.iconeAppTexto, { color: theme.accentText }]}>
          AD
        </ThemedText>
      </View>
      <View style={styles.corpoNotificacao}>
        <View style={styles.topo}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            AwayDay
          </ThemedText>
          <ThemedText themeColor="textMuted" style={styles.quando}>
            {exemplo.quando}
          </ThemedText>
        </View>
        <View style={styles.tituloNotificacao}>
          <Icon name={exemplo.icone} size={15} color={theme.accentInk} strokeWidth={2.4} />
          <ThemedText style={styles.tituloExemplo}>{exemplo.titulo}</ThemedText>
        </View>
        <ThemedText style={styles.descricao}>{exemplo.corpo}</ThemedText>
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
      <Card style={styles.cartaoLinhas}>
        <LinhaInterruptor
          titulo="Dicas para dias de jogo"
          descricao="No máximo uma por dia, a partir do calendário e do que já fizeste na app."
          value={nudgesEnabled}
          disabled={guardar.isPending}
          onValueChange={(ligar) => void alternarSugestoes(ligar)}
          divisoria
        />
        <LinhaInterruptor
          titulo="Retrospetiva da época"
          descricao="Um resumo em junho: jogos, estádios novos e o tasco onde mais voltaste."
          value={recapEnabled}
          disabled={guardar.isPending}
          onValueChange={(ligar) => guardar.mutate({ recapEnabled: ligar })}
          divisoria={aviso !== null}
        />
        {aviso ? (
          <ThemedText style={[styles.descricao, styles.aviso]} themeColor="textSecondary">
            {aviso}
          </ThemedText>
        ) : null}
      </Card>
    </>
  );
}

/** O que a malta faz e te toca a ti: mensagens, convites, amigos e o dinheiro das contas. Estes são enviados. */
const AVISOS_DA_MALTA: { kind: NotificationKind; titulo: string; descricao: string }[] = [
  {
    kind: 'ride_message',
    titulo: 'Conversa do carro',
    descricao: 'Quando alguém escreve na conversa de uma boleia em que vais.',
  },
  {
    kind: 'group_message',
    titulo: 'Conversa do grupo',
    descricao: 'Quando alguém escreve num grupo teu, ou diz em que tasco está.',
  },
  {
    kind: 'invites',
    titulo: 'Convites',
    descricao: 'Quando um amigo te guarda lugar no carro ou te chama para um grupo.',
  },
  {
    kind: 'friends',
    titulo: 'Amigos',
    descricao: 'Pedidos de amizade de quem já foi contigo a um jogo, e respostas aos teus.',
  },
  {
    kind: 'trip_money',
    titulo: 'Contas da viagem',
    descricao: 'Despesas onde entras e pagamentos para confirmares.',
  },
];

/** Os avisos que o servidor envia mesmo. Ligados por omissão: desliga-se o que não se quer. */
function AvisosDaMalta() {
  const userId = useUserId();
  const preferencias = useNotificationPreferences(userId);
  const refrescar = useRefreshNotificationPreferences(userId);
  const [aGuardar, setAGuardar] = useState<NotificationKind | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!userId) return null;

  async function alternar(kind: NotificationKind, ligar: boolean) {
    if (!userId) return;
    setAGuardar(kind);
    try {
      await saveNotificationPreference(userId, kind, ligar);
      void refrescar();
      if (ligar) {
        const permissao = await enablePushOnThisDevice().catch((): PushPermission => 'unavailable');
        setAviso(avisoDePermissao(permissao));
      }
    } finally {
      setAGuardar(null);
    }
  }

  return (
    <>
      <SectionHeader title="Avisos da malta" />
      <ThemedText style={styles.descricao} themeColor="textSecondary">
        Estes chegam ao telemóvel. Vêm ligados; desliga o que não quiseres.
      </ThemedText>
      <Card style={styles.cartaoLinhas}>
        {AVISOS_DA_MALTA.map((aviso, indice) => (
          <LinhaInterruptor
            key={aviso.kind}
            titulo={aviso.titulo}
            descricao={aviso.descricao}
            value={preferencias.data?.[aviso.kind] ?? true}
            disabled={aGuardar !== null}
            onValueChange={(ligar) => void alternar(aviso.kind, ligar)}
            divisoria={indice < AVISOS_DA_MALTA.length - 1}
          />
        ))}
      </Card>
      {aviso ? (
        <ThemedText style={[styles.descricao, styles.aviso]} themeColor="textSecondary">
          {aviso}
        </ThemedText>
      ) : null}
    </>
  );
}

export default function NotificacoesScreen() {
  const { notificacoes, alternarNotificacao } = useAppState();

  return (
    <Screen>
      <MensagensDaConta />
      <AvisosDaMalta />

      <SectionHeader title="Outros avisos" />
      <ThemedText style={styles.descricao} themeColor="textSecondary">
        Estes ainda não são enviados: escolhe o que queres receber e vê como fica.
      </ThemedText>

      {TIPOS_NOTIFICACAO.map((tipo) => {
        const definicao = definicoesNotificacao[tipo];
        const ligada = notificacoes[tipo];
        return (
          <Card key={tipo} style={styles.cartaoExemplo}>
            <LinhaInterruptor
              titulo={definicao.titulo}
              descricao={definicao.descricao}
              value={ligada}
              onValueChange={() => alternarNotificacao(tipo)}
            />
            <ThemedText type="eyebrow" themeColor="textMuted">
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
  cartaoLinhas: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  cartaoExemplo: {
    gap: 10,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  flex: {
    flex: 1,
    gap: 1,
  },
  tituloLinha: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 800,
  },
  descricao: {
    fontSize: 13,
    lineHeight: 18,
  },
  aviso: {
    paddingVertical: 13,
  },
  notificacao: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  desligada: {
    opacity: 0.45,
  },
  iconeApp: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeAppTexto: {
    fontSize: 17,
    lineHeight: 20,
  },
  corpoNotificacao: {
    flex: 1,
    gap: Spacing.half,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quando: {
    fontSize: 12,
    lineHeight: 16,
  },
  tituloNotificacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tituloExemplo: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 800,
  },
});
