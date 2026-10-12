import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { CaraDoGrupo } from '@/features/groups/components/CaraDoGrupo';
import { nomeDoJogo, quandoEOnde } from '@/features/groups/components/CartaoDoPlano';
import { useMyGroupInbox, useRefreshGroups } from '@/features/groups/hooks/useGroups';
import { avisarConviteRepetido } from '@/features/groups/convite-repetido';
import { inviteGroupToFixture, PlanRefused } from '@/features/groups/plans';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { useUserId } from '@/lib/session';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof PlanRefused)) return 'Não deu para convidar. Tenta outra vez.';
  switch (erro.reason) {
    case 'fixture_over':
      return 'Este jogo já começou.';
    case 'rate_limited':
      return 'Já mandaste convites que cheguem por hoje.';
    default:
      return 'Não deu para convidar. Tenta outra vez.';
  }
}

/**
 * Combinar um jogo com a malta: escolhe-se o grupo, e o convite cai na conversa com o jogo, a hora e os botões para
 * responder. Cada grupo tem um só convite por jogo: um segundo é recusado, com um aviso e o convite que já existe.
 */
export default function CombinarScreen() {
  const router = useRouter();
  const theme = useTheme();
  const userId = useUserId();
  const { jogoId } = useLocalSearchParams<{ jogoId?: string }>();
  const jogo = jogoId ? obterJogo(jogoId) : undefined;
  const inbox = useMyGroupInbox(userId !== null);
  const refrescar = useRefreshGroups();
  const [aConvidar, setAConvidar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const grupos = inbox.data ?? [];

  async function convidar(grupoId: string) {
    if (!jogo) return;
    setErro(null);
    setAConvidar(grupoId);
    try {
      await inviteGroupToFixture(grupoId, jogo.id);
      await refrescar();
      router.back();
      router.push({ pathname: '/grupos/[grupoId]', params: { grupoId } });
    } catch (problema) {
      setAConvidar(null);
      const grupo = grupos.find((candidato) => candidato.id === grupoId);
      if (problema instanceof PlanRefused && problema.reason === 'plan_exists' && grupo) {
        avisarConviteRepetido(router, grupo, problema.planId, () => router.back());
        return;
      }
      setErro(mensagemDeRecusa(problema));
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.conteudo}>
      <ThemedText type="title" accessibilityRole="header">
        Combinar com a malta
      </ThemedText>
      {jogo ? (
        <ThemedText themeColor="textSecondary">
          {`${nomeDoJogo(jogo.id)} · ${quandoEOnde({ fixtureId: jogo.id, kickoffAt: jogo.inicio })}`}
        </ThemedText>
      ) : null}

      {!userId ? (
        <>
          <ThemedText themeColor="textSecondary">
            Para convidar a malta precisas de conta: os grupos juntam pessoas reais.
          </ThemedText>
          <Button label="Entrar" onPress={() => router.push('/conta/entrar')} />
        </>
      ) : grupos.length === 0 && !inbox.isLoading ? (
        <>
          <ThemedText themeColor="textSecondary">
            Ainda não tens grupo. Cria um para a malta do costume e volta aqui.
          </ThemedText>
          <Button
            label="Criar um grupo"
            icon={icons.perfil}
            onPress={() => {
              router.back();
              router.navigate('/malta/novo');
            }}
          />
        </>
      ) : (
        <>
          <ThemedText themeColor="textSecondary">
            Escolhe o grupo. O convite cai na conversa e a malta responde se vai.
          </ThemedText>
          <View style={styles.lista}>
            {grupos.map((grupo) => (
              <Pressable
                key={grupo.id}
                disabled={aConvidar !== null}
                onPress={() => void convidar(grupo.id)}
                accessibilityRole="button"
                accessibilityLabel={`Convidar ${grupo.name}`}
                style={({ pressed }) => [
                  styles.grupo,
                  CardShadow,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.premido,
                ]}>
                <CaraDoGrupo nome={grupo.name} url={grupo.photoUrl} size={44} />
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {grupo.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {aConvidar === grupo.id
                      ? 'A convidar…'
                      : plural(grupo.members, 'pessoa', 'pessoas')}
                  </ThemedText>
                </View>
                <Icon name={icons.seguinte} size={18} color={theme.textMuted} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  lista: {
    gap: Spacing.two,
  },
  grupo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    padding: Spacing.twoAndHalf,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  premido: {
    opacity: 0.85,
  },
  flex: {
    flex: 1,
  },
});
