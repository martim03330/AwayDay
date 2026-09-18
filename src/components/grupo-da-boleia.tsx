import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { createGroup, fetchMyGroups } from '@/features/groups/api';
import { setRideGroup, setRideVisibility, type RideSummary } from '@/features/rides/api';
import { useRefreshRides } from '@/features/rides/hooks/useRides';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Chip } from '@/ui/chip';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';
import { Button } from '@/ui/button';

/**
 * A boleia e os grupos. Uma boleia não é um grupo — é uma viagem —, por isso nada nasce sozinho aqui: o condutor
 * pode dizer que aquela é a boleia de um grupo dele, e quem andou com gente nova pode criar um grupo com um toque,
 * se quiser. Uma coisa é a viagem, outra é a malta que fica.
 */
export function GrupoDaBoleia({
  boleia,
  nomeDoJogo,
  participante,
}: {
  boleia: RideSummary;
  nomeDoJogo: string;
  participante: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const atualizar = useRefreshRides();
  const queryClient = useQueryClient();
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const meusGrupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });
  const grupos = meusGrupos.data ?? [];

  async function abrir(publica: boolean) {
    setErro(null);
    setATratar(true);
    try {
      await setRideVisibility(boleia.id, publica);
      await atualizar();
    } catch {
      setErro(
        publica
          ? 'Não deu para abrir a boleia a toda a gente.'
          : 'Não deu para fechar a boleia ao grupo.'
      );
    } finally {
      setATratar(false);
    }
  }

  async function escolher(grupoId: string | null) {
    setErro(null);
    setATratar(true);
    try {
      await setRideGroup(boleia.id, grupoId);
      await atualizar();
    } catch {
      setErro('Não deu para mudar o grupo desta boleia.');
    } finally {
      setATratar(false);
    }
  }

  async function criarComEstaMalta() {
    setErro(null);
    setATratar(true);
    try {
      const id = await createGroup(nomeDoJogo.slice(0, 60));
      if (boleia.isMine) await setRideGroup(boleia.id, id).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      await atualizar();
      router.push({ pathname: '/grupos/[grupoId]', params: { grupoId: id } });
    } catch {
      setErro('Não deu para criar o grupo. Tenta outra vez.');
    } finally {
      setATratar(false);
    }
  }

  if (!userId || !participante) return null;

  return (
    <Card style={styles.card}>
      {boleia.groupId && boleia.groupName ? (
        <>
          <ThemedText style={styles.destaque}>{`Boleia do grupo ${boleia.groupName}`}</ThemedText>
          <Etiqueta
            icon={boleia.visibility === 'grupo' ? icons.perfil : icons.partilhar}
            label={
              boleia.visibility === 'grupo' ? 'Só para a malta do grupo' : 'Aberta a toda a gente'
            }
            tone={boleia.visibility === 'grupo' ? 'info' : 'positivo'}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {boleia.visibility === 'grupo'
              ? 'Só quem é do grupo vê esta boleia. Se o carro não encher, abre-a a toda a gente.'
              : 'Aparece a qualquer adepto. Quem é de fora não vê o nome do grupo, só os lugares já ocupados.'}
          </ThemedText>
          {boleia.isMine ? (
            <Button
              label={
                boleia.visibility === 'grupo' ? 'Abrir a toda a gente' : 'Voltar a fechar ao grupo'
              }
              icon={boleia.visibility === 'grupo' ? icons.partilhar : icons.perfil}
              variant="secondary"
              disabled={aTratar}
              onPress={() => void abrir(boleia.visibility === 'grupo')}
            />
          ) : null}
          <View style={styles.acoes}>
            <LinkTexto
              label="Abrir o grupo"
              onPress={() => {
                if (boleia.groupId) {
                  router.push({
                    pathname: '/grupos/[grupoId]',
                    params: { grupoId: boleia.groupId },
                  });
                }
              }}
            />
            {boleia.isMine ? (
              <LinkTexto perigo label="Tirar do grupo" onPress={() => void escolher(null)} />
            ) : null}
          </View>
        </>
      ) : (
        <>
          <ThemedText style={styles.destaque}>Esta boleia é de algum grupo?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Um grupo é a malta que anda junta de jogo para jogo. A boleia é só esta viagem — por
            isso nenhum grupo é criado sozinho.
          </ThemedText>
          {boleia.isMine && grupos.length > 0 ? (
            <View style={styles.chips}>
              {grupos.map((grupo) => (
                <Chip
                  key={grupo.id}
                  label={grupo.name}
                  selected={false}
                  emCartao
                  onPress={() => void escolher(grupo.id)}
                />
              ))}
            </View>
          ) : null}
          <Button
            label={aTratar ? 'A criar…' : 'Criar grupo com esta malta'}
            icon={icons.perfil}
            variant="secondary"
            disabled={aTratar}
            onPress={() => void criarComEstaMalta()}
          />
          <ThemedText type="small" themeColor="textMuted">
            Cria o grupo e dá-te o link para mandares a quem foi contigo.
          </ThemedText>
        </>
      )}
      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  destaque: {
    fontWeight: 800,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
