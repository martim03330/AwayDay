import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { groupInboxKey, groupMessagesKey } from '@/features/groups/hooks/useGroups';
import { myRideChatsKey, rideMessagesKey } from '@/features/rides/hooks/useRideChat';
import { useTheme } from '@/hooks/use-theme';
import { eMensagemDeConversa } from '@/lib/push';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** How long the banner stays before going away on its own. */
const DURACAO_MS = 3500;

type Aviso = {
  id: string;
  titulo: string;
  texto: string;
  destino:
    | { pathname: '/grupos/[grupoId]'; params: { grupoId: string } }
    | { pathname: '/carro/[rideId]'; params: { rideId: string; jogoId: string } };
};

function campo(dados: unknown, nome: string) {
  const valor = typeof dados === 'object' && dados !== null ? Reflect.get(dados, nome) : null;
  return typeof valor === 'string' ? valor : null;
}

/** The banner for a chat push, or null when it is not one (or misses where to go). */
function avisoDe(notificacao: Notifications.Notification): Aviso | null {
  const { data, title, body } = notificacao.request.content;
  if (!eMensagemDeConversa(data)) return null;
  const grupoId = campo(data, 'groupId');
  const rideId = campo(data, 'rideId');
  const jogoId = campo(data, 'fixtureId');
  const destino = grupoId
    ? ({ pathname: '/grupos/[grupoId]', params: { grupoId } } as const)
    : rideId && jogoId
      ? ({ pathname: '/carro/[rideId]', params: { rideId, jogoId } } as const)
      : null;
  if (!destino) return null;
  return {
    id: notificacao.request.identifier,
    titulo: title ?? 'Mensagem nova',
    texto: body ?? '',
    destino,
  };
}

/** The chat open on screen now, from the path: «/grupos/<id>» or «/carro/<id>». */
function conversaAberta(caminho: string, aviso: Aviso) {
  return 'grupoId' in aviso.destino.params
    ? caminho === `/grupos/${aviso.destino.params.grupoId}`
    : caminho === `/carro/${aviso.destino.params.rideId}`;
}

/**
 * A message arrives while the app is open: a small banner slides down from the top for a few seconds, so people know
 * someone wrote, without the system banner covering the screen. Tapping it opens the chat. Nothing shows when that
 * chat is already open (the message is right there). The lists' unread counts refresh either way.
 */
export function BannerDeMensagem() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const caminho = usePathname();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    const subscricao = Notifications.addNotificationReceivedListener((notificacao) => {
      const novo = avisoDe(notificacao);
      if (!novo) return;
      if ('grupoId' in novo.destino.params) {
        void queryClient.invalidateQueries({ queryKey: groupInboxKey() });
        void queryClient.invalidateQueries({ queryKey: groupMessagesKey(novo.destino.params.grupoId) });
      } else {
        void queryClient.invalidateQueries({ queryKey: myRideChatsKey() });
        void queryClient.invalidateQueries({ queryKey: rideMessagesKey(novo.destino.params.rideId) });
      }
      setAviso(novo);
    });
    return () => subscricao.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!aviso) return;
    const temporizador = setTimeout(() => setAviso(null), DURACAO_MS);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  if (!aviso || conversaAberta(caminho, aviso)) return null;

  return (
    <View style={[styles.camada, { top: insets.top + Spacing.one }]} pointerEvents="box-none">
      <Animated.View key={aviso.id} entering={SlideInUp.duration(220)} exiting={SlideOutUp.duration(180)}>
        <Pressable
          onPress={() => {
            setAviso(null);
            router.push(aviso.destino);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${aviso.titulo}: ${aviso.texto}. Toca para abrir a conversa.`}
          style={[styles.banner, CardShadow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.icone, { backgroundColor: theme.accent }]}>
            <Icon name={icons.conversa} size={16} color={theme.accentText} />
          </View>
          <View style={styles.texto}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {aviso.titulo}
            </ThemedText>
            {aviso.texto ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {aviso.texto}
              </ThemedText>
            ) : null}
          </View>
          <Pressable
            onPress={() => setAviso(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Fechar o aviso">
            <Icon name={icons.fechar} size={16} color={theme.textMuted} />
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  camada: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  icone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: {
    flex: 1,
  },
});
