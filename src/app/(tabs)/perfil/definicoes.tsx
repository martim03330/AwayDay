import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';

import { ModoDemoCard } from '@/components/modo-demo-card';
import { Spacing } from '@/constants/theme';
import { rankingsKey } from '@/features/presence/hooks/usePresence';
import { useLocationPermission } from '@/features/presence/location';
import { useMyProfile, useUpdateRankingVisibility } from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
import { TIPOS_NOTIFICACAO } from '@/mocks/notificacoes';
import { useAppState, type EstadoPermissao } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function textoPermissaoDemo(estado: EstadoPermissao) {
  if (estado === 'aceite') return 'Aceite na introdução (simulado)';
  if (estado === 'recusada') return 'Continuas sem (simulado)';
  return 'Ainda não decidiste';
}

/** As três hipóteses de aspeto, por esta ordem: o telemóvel manda, a não ser que se diga o contrário. */
const TEMAS = [
  { valor: 'sistema' as const, rotulo: 'Como o telemóvel' },
  { valor: 'claro' as const, rotulo: 'Claro' },
  { valor: 'escuro' as const, rotulo: 'Escuro' },
];

export default function DefinicoesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  // The profile header opens this screen with `demo=1` after five quick taps.
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const {
    sonsLigados,
    alternarSons,
    notificacoes,
    permissoes,
    reverIntroducao,
    modoDemo,
    alternarModoDemo,
    tema,
    escolherTema,
    fonte,
  } = useAppState();
  const [permissaoLocalizacao] = useLocationPermission();
  const userId = useUserId();
  const perfil = useMyProfile(fonte === 'conta' ? userId : null);
  const visibilidade = useUpdateRankingVisibility(userId);
  const aparecerNosRankings =
    visibilidade.isPending && visibilidade.variables !== undefined
      ? visibilidade.variables
      : (perfil.data?.showInRankings ?? false);
  const notificacoesLigadas = TIPOS_NOTIFICACAO.filter((tipo) => notificacoes[tipo]).length;
  const chevron = <Icon name={icons.seguinte} size={18} color={theme.textMuted} />;
  const localizacaoBloqueada =
    permissaoLocalizacao !== null &&
    !permissaoLocalizacao.granted &&
    !permissaoLocalizacao.canAskAgain;

  function textoLocalizacao() {
    if (modoDemo) return textoPermissaoDemo(permissoes.localizacao);
    if (permissaoLocalizacao?.granted) return 'Autorizada. Só a usamos para confirmar o check-in.';
    if (localizacaoBloqueada) return 'Recusada. Toca para abrir as definições do telemóvel.';
    return 'Pedimos quando fizeres check-in num tasco.';
  }

  function mudarVisibilidade(mostrar: boolean) {
    visibilidade.mutate(mostrar, {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: rankingsKey(userId) }),
      onError: () => Alert.alert('Não deu para guardar', 'Verifica a ligação e tenta outra vez.'),
    });
  }

  return (
    <Screen>
      <Card style={styles.grupo}>
        <LinhaGrupo
          separador
          leading={<Icon name={icons.som} size={20} color={theme.accentInk} />}
          title="Sons"
          subtitle="Um som curto no check-in e quando ganhas um carimbo."
          trailing={
            <Switch
              value={sonsLigados}
              onValueChange={alternarSons}
              trackColor={{ true: theme.accent, false: theme.border }}
              thumbColor={theme.accentText}
              ios_backgroundColor={theme.border}
              accessibilityLabel="Sons"
            />
          }
        />
        <LinhaGrupo
          separador
          onPress={() => router.push('/perfil/notificacoes')}
          accessibilityLabel={`Notificações: ${notificacoesLigadas} de ${TIPOS_NOTIFICACAO.length} ligadas. Toca para escolher.`}
          leading={<Icon name={icons.notificacoes} size={20} color={theme.accentInk} />}
          title="Notificações"
          subtitle={`${notificacoesLigadas} de ${TIPOS_NOTIFICACAO.length} ligadas`}
          trailing={chevron}
        />
        <LinhaGrupo
          separador
          onPress={
            !modoDemo && localizacaoBloqueada ? () => void Linking.openSettings() : undefined
          }
          leading={<Icon name={icons.localizacao} size={20} color={theme.accentInk} />}
          title="Localização"
          subtitle={textoLocalizacao()}
          trailing={!modoDemo && localizacaoBloqueada ? chevron : undefined}
        />
        <LinhaGrupo
          onPress={reverIntroducao}
          accessibilityLabel="Rever a introdução"
          leading={<Icon name={icons.recomecar} size={20} color={theme.accentInk} />}
          title="Rever a introdução"
          subtitle="Os três ecrãs do início, outra vez."
          trailing={chevron}
        />
      </Card>

      <SectionHeader title="Ajudar a melhorar" />
      <Card style={styles.grupo}>
        <LinhaGrupo
          onPress={() => router.push('/perfil/ajudar')}
          accessibilityLabel="Reportar um erro ou sugerir uma melhoria"
          leading={<Icon name={icons.aviso} size={20} color={theme.accentInk} />}
          title="Reportar um erro ou dar uma ideia"
          subtitle="Chega-nos com o modelo do telemóvel e a versão da app. Nada mais."
          trailing={chevron}
        />
      </Card>

      <SectionHeader title="Aspeto" />
      <Card style={styles.grupo}>
        <ThemedText themeColor="textSecondary">
          O escuro segue o telemóvel, a não ser que escolhas um dos dois.
        </ThemedText>
        <View style={styles.temas}>
          {TEMAS.map((opcao) => (
            <Chip
              key={opcao.valor}
              label={opcao.rotulo}
              selected={tema === opcao.valor}
              emCartao
              onPress={() => escolherTema(opcao.valor)}
            />
          ))}
        </View>
      </Card>

      {fonte === 'conta' ? (
        <>
          <SectionHeader title="Rankings" />
          <Card style={styles.grupo}>
            <LinhaGrupo
              leading={<Icon name={icons.ranking} size={20} color={theme.accentInk} />}
              title="Aparecer nos rankings"
              subtitle="Com o teu nome e clube, nos tascos verificados e no barulhómetro. Nunca mostramos onde estás."
              trailing={
                <Switch
                  value={aparecerNosRankings}
                  onValueChange={mudarVisibilidade}
                  disabled={!perfil.data}
                  trackColor={{ true: theme.accent, false: theme.border }}
                  thumbColor={theme.accentText}
                  ios_backgroundColor={theme.border}
                  accessibilityLabel="Aparecer nos rankings"
                />
              }
            />
          </Card>
        </>
      ) : null}

      {demo === '1' || modoDemo ? (
        <>
          <SectionHeader title="Modo demo" />
          <Card style={styles.grupo}>
            <LinhaGrupo
              leading={<Icon name={icons.demo} size={20} color={theme.accentInk} />}
              title="Modo demo"
              subtitle={
                modoDemo
                  ? 'Dados de exemplo e hora simulada. Nada vai para a tua conta.'
                  : 'Mostra a app com dados de exemplo, sem mexer nos teus.'
              }
              trailing={
                <Switch
                  value={modoDemo}
                  onValueChange={alternarModoDemo}
                  trackColor={{ true: theme.accent, false: theme.border }}
                  thumbColor={theme.accentText}
                  ios_backgroundColor={theme.border}
                  accessibilityLabel="Modo demo"
                />
              }
            />
          </Card>
          {modoDemo ? <ModoDemoCard /> : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  temas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  grupo: {
    gap: 0,
    paddingVertical: 4,
  },
});
