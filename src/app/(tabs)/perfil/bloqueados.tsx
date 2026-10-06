import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { unblockUser } from '@/features/moderation/api';
import {
  useBlockedPeople,
  useRefreshAfterModeration,
} from '@/features/moderation/hooks/useModeration';
import { formatarData } from '@/lib/datas';
import { useUserId } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { Screen } from '@/ui/screen';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

/**
 * The people I blocked, and the way back. A block is quiet: the other person is never told, stays in the same groups
 * and cars, and just stops reaching me.
 */
export default function PessoasBloqueadasScreen() {
  const router = useRouter();
  const userId = useUserId();
  const bloqueados = useBlockedPeople(userId !== null);
  const refrescar = useRefreshAfterModeration();
  const [aTratar, setATratar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!userId) {
    return (
      <Screen>
        <EmptyState
          icon={icons.perfil}
          title="Precisas de conta"
          message="Quem bloqueias fica guardado na tua conta."
          action={{ label: 'Entrar', onPress: () => router.push('/conta/entrar') }}
        />
      </Screen>
    );
  }

  if (bloqueados.isLoading) {
    return (
      <Screen>
        <SkeletonCard lines={3} />
      </Screen>
    );
  }

  async function desbloquear(profileId: string) {
    setErro(null);
    setATratar(profileId);
    try {
      await unblockUser(profileId);
      await refrescar();
    } catch {
      setErro('Não deu para desbloquear. Tenta outra vez.');
    } finally {
      setATratar(null);
    }
  }

  const lista = bloqueados.data ?? [];

  return (
    <Screen>
      {lista.length === 0 ? (
        <EmptyState
          icon={icons.selecionado}
          title="Ninguém bloqueado"
          message="Ainda bem. Se alguém passar das marcas, toca sem largar numa mensagem dessa pessoa, ou no «⋯» ao lado do nome."
        />
      ) : (
        <Card style={styles.lista}>
          {lista.map((pessoa, indice) => (
            <LinhaGrupo
              key={pessoa.profileId}
              separador={indice < lista.length - 1}
              leading={<Avatar nome={pessoa.displayName} />}
              title={pessoa.displayName}
              subtitle={`Desde ${formatarData(new Date(pessoa.blockedAt))}`}
              trailing={
                <LinkTexto
                  label="Desbloquear"
                  disabled={aTratar !== null}
                  onPress={() => void desbloquear(pessoa.profileId)}
                />
              }
            />
          ))}
        </Card>
      )}

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}

      <ThemedText type="small" themeColor="textMuted">
        Quem bloqueias não fica a saber. Continua nos mesmos grupos e boleias, mas não vês o que
        escreve e não te pode pedir amizade nem convidar-te. Ao desbloquear, as mensagens voltam a
        aparecer; a amizade, essa, tem de ser pedida outra vez.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
});
