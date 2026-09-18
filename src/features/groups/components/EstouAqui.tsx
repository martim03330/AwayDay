import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { GroupRefused, sharePlaceWithGroup } from '@/features/groups/api';
import { useMyGroupInbox, useRefreshGroups } from '@/features/groups/hooks/useGroups';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Icon, icons } from '@/ui/icon';
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
      <ThemedText type="smallBold">Estás aqui? Diz à malta</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Vai para a conversa do grupo que escolheres: só o nome do tasco, nunca onde estás.
      </ThemedText>
      <View style={styles.chips}>
        {grupos.map((grupo) => {
          const feito = avisados.includes(grupo.id);
          return (
            <Chip
              key={grupo.id}
              label={aAvisar === grupo.id ? 'A avisar…' : grupo.name}
              selected={feito}
              emCartao
              leading={
                feito ? (
                  <Icon name={icons.checkInFeito} size={14} color={theme.accentText} />
                ) : undefined
              }
              accessibilityLabel={feito ? `${grupo.name}: já avisado` : `Avisar ${grupo.name}`}
              onPress={() => {
                if (!feito && aAvisar === null) void avisar(grupo.id);
              }}
            />
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
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
