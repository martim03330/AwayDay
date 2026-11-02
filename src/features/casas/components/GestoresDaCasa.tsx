import { useState } from 'react';
import { Alert, Share, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { BotaoReticencias, MenuDeAcoes, type MenuAberto } from '@/features/casas/components/MenuDeAcoes';
import {
  useCreateSupportersClubInvite,
  useRemoveSupportersClubManager,
  useSupportersClub,
  useSupportersClubManagers,
} from '@/features/casas/hooks/useCasas';
import { mensagemDaGestao } from '@/features/casas/mensagens';
import type { SupportersClubManager } from '@/features/casas/types';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { MensagemErro } from '@/ui/mensagem-erro';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/**
 * Who runs the Casa, each with their own account. The owner invites managers with a one-time code (valid 7 days)
 * and removes them; the other managers only see the list.
 */
export function GestoresDaCasa({ casaId }: { casaId: string }) {
  const casa = useSupportersClub(casaId);
  const papel = casa.data?.myRole ?? null;
  const gestores = useSupportersClubManagers(casaId, papel !== null);
  const convidar = useCreateSupportersClubInvite();
  const remover = useRemoveSupportersClubManager();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuAberto | null>(null);

  if (casa.isLoading) return <SkeletonCard lines={3} />;

  if (!casa.data || papel === null) {
    return (
      <EmptyState
        icon={icons.casa}
        title="Só para quem gere a Casa"
        message="Este ecrã não está disponível na tua conta."
      />
    );
  }

  const nomeDaCasa = casa.data.name;
  const dono = papel === 'owner';
  const lista = gestores.data ?? [];

  function novoCodigo() {
    setErro(null);
    convidar.mutate(casaId, {
      onSuccess: (novo) => {
        vibrarSucesso();
        setCodigo(novo);
      },
      onError: (problema) => {
        vibrarErro();
        setErro(mensagemDaGestao(problema));
      },
    });
  }

  function confirmarRemover(gestor: SupportersClubManager) {
    Alert.alert(
      `Remover ${gestor.name}?`,
      `Deixa de gerir ${nomeDaCasa} e as suas viagens.`,
      [
        { text: 'Deixa estar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            remover.mutate(
              { clubId: casaId, profileId: gestor.profileId },
              {
                onSuccess: () => vibrarSucesso(),
                onError: (problema) => {
                  vibrarErro();
                  Alert.alert('Não deu', mensagemDaGestao(problema));
                },
              }
            ),
        },
      ]
    );
  }

  return (
    <>
      <ThemedText type="subtitle">{nomeDaCasa}</ThemedText>

      {gestores.isLoading ? (
        <SkeletonCard lines={2} />
      ) : (
        <Card style={styles.lista}>
          {lista.map((gestor, indice) => (
            <LinhaGrupo
              key={gestor.profileId}
              leading={<IconCircle name={icons.perfil} tone="neutral" />}
              title={gestor.isMe ? `${gestor.name} (tu)` : gestor.name}
              valor={gestor.role === 'owner' ? 'Dono' : 'Gestor'}
              trailing={
                dono && !gestor.isMe ? (
                  <BotaoReticencias
                    nome={gestor.name}
                    onPress={() =>
                      setMenu({
                        titulo: gestor.name,
                        acoes: [
                          { label: 'Remover gestor', perigo: true, onPress: () => confirmarRemover(gestor) },
                        ],
                      })
                    }
                  />
                ) : undefined
              }
              separador={indice < lista.length - 1}
            />
          ))}
        </Card>
      )}

      {dono ? (
        <>
          <SectionHeader title="Convidar gestor" />
          {codigo ? (
            <Card style={styles.codigo}>
              <ThemedText type="title" selectable style={styles.codigoTexto}>
                {codigo}
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Quem vai gerir contigo abre o Perfil, toca em «Registar a minha Casa» e depois em «Tenho um código
                de gestor». O código serve uma vez e dura 7 dias.
              </ThemedText>
              <Button
                label="Partilhar código"
                icon={icons.partilhar}
                onPress={() =>
                  void Share.share({
                    message: `Código para gerires ${nomeDaCasa} no AwayDay: ${codigo}`,
                  }).catch(() => undefined)
                }
              />
            </Card>
          ) : null}
          {erro ? <MensagemErro>{erro}</MensagemErro> : null}
          <Button
            label={convidar.isPending ? 'A criar…' : codigo ? 'Novo código' : 'Convidar gestor'}
            variant={codigo ? 'secondary' : 'primary'}
            icon={icons.mais}
            disabled={convidar.isPending}
            onPress={novoCodigo}
          />
        </>
      ) : (
        <ThemedText themeColor="textSecondary">Só o dono da Casa convida ou remove gestores.</ThemedText>
      )}

      <MenuDeAcoes menu={menu} onFechar={() => setMenu(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  codigo: {
    gap: Spacing.three,
  },
  codigoTexto: {
    letterSpacing: 2,
    textAlign: 'center',
  },
});
