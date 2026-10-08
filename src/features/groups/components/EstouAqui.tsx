import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { GroupRefused, sharePlaceWithGroup } from '@/features/groups/api';
import { useMyGroupInbox, useRefreshGroups } from '@/features/groups/hooks/useGroups';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { Card } from '@/ui/card';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof GroupRefused)) return 'Não deu para avisar. Tenta outra vez.';
  switch (erro.reason) {
    case 'place_not_found':
      return 'Este tasco ainda não está na app de verdade — não dá para o partilhar.';
    case 'rate_limited':
      return 'Já avisaste a malta vezes que cheguem hoje.';
    default:
      return 'Não deu para avisar. Tenta outra vez.';
  }
}

/**
 * «Estou aqui»: dizer a um grupo, com um toque, em que tasco estás. É a própria pessoa que o diz, quando quer — a
 * app não segue ninguém nem mostra no mapa onde está a malta. Vai para a conversa do grupo só o nome do tasco.
 */
export function EstouAqui({ placeId }: { placeId: string }) {
  const theme = useTheme();
  const userId = useUserId();
  const inbox = useMyGroupInbox(userId !== null);
  const refrescar = useRefreshGroups();
  const [avisados, setAvisados] = useState<string[]>([]);
  const [aAvisar, setAAvisar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = inbox.data ?? [];
  if (!userId || grupos.length === 0) return null;

  async function avisar(grupoId: string) {
    setErro(null);
    setAAvisar(grupoId);
    try {
      await sharePlaceWithGroup(grupoId, placeId);
      setAvisados((atuais) => [...atuais, grupoId]);
      void refrescar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setAAvisar(null);
    }
  }

  return (
    <Card style={styles.cartao}>
      <View style={styles.topo}>
        <IconCircle name={icons.megafone} tone="yellow" />
        <View style={styles.corpo}>
          <ThemedText style={styles.titulo}>Estás aqui? Diz à malta</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Vai para a conversa do grupo só o nome do tasco, nunca onde estás.
          </ThemedText>
        </View>
      </View>

      <View style={[styles.lista, { borderTopColor: theme.backgroundSelected }]}>
        {grupos.map((grupo, indice) => {
          const feito = avisados.includes(grupo.id);
          const aEnviar = aAvisar === grupo.id;
          return (
            <View
              key={grupo.id}
              style={[
                styles.linha,
                indice < grupos.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}>
              <IconCircle name={icons.malta} size={16} tone={feito ? 'green' : 'neutral'} />
              <ThemedText style={styles.nome} numberOfLines={1}>
                {grupo.name}
              </ThemedText>
              {feito ? (
                <View
                  style={[styles.pilula, { backgroundColor: theme.successBackground }]}
                  accessible
                  accessibilityLabel={`${grupo.name}: já avisado`}>
                  <Icon name={icons.checkInFeito} size={14} color={theme.accentInk} />
                  <ThemedText style={[styles.pilulaTexto, { color: theme.accentInk }]}>Avisado</ThemedText>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    if (aAvisar === null) void avisar(grupo.id);
                  }}
                  disabled={aAvisar !== null}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Avisar ${grupo.name} que estás aqui`}
                  accessibilityState={{ busy: aEnviar }}
                  style={({ pressed }) => [
                    styles.pilula,
                    { backgroundColor: pressed ? theme.accentPressed : theme.accent },
                    aAvisar !== null && !aEnviar && styles.desligado,
                  ]}>
                  <Icon name={icons.enviar} size={14} color={theme.accentText} />
                  <ThemedText style={[styles.pilulaTexto, { color: theme.accentText }]}>
                    {aEnviar ? 'A avisar…' : 'Avisar'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
      {erro ? (
        <ThemedText type="small" style={{ color: theme.dangerText }}>
          {erro}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.twoAndHalf,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  corpo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titulo: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  lista: {
    borderTopWidth: 1,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    paddingVertical: Spacing.two,
  },
  nome: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 700,
  },
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  pilulaTexto: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: 800,
  },
  desligado: {
    opacity: 0.4,
  },
});
