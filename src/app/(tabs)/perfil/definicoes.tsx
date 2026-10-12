import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { ModoDemoCard } from '@/components/modo-demo-card';
import { Spacing } from '@/constants/theme';
import { versionLabel } from '@/features/feedback/versao';
import { useLocationPermission } from '@/features/presence/location';
import { useMyProfile, useUpdateShareCheckins } from '@/features/profile/hooks/useMyProfile';
import { SegundoFatorAdmin } from '@/features/profile/components/SegundoFatorAdmin';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/session';
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
  // The profile header opens this screen with `demo=1` after five quick taps.
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const {
    sonsLigados,
    alternarSons,
    permissoes,
    reverIntroducao,
    reverApresentacao,
    modoDemo,
    alternarModoDemo,
    tema,
    escolherTema,
    fonte,
  } = useAppState();
  const [permissaoLocalizacao] = useLocationPermission();
  const userId = useUserId();
  const perfil = useMyProfile(fonte === 'conta' ? userId : null);
  const partilha = useUpdateShareCheckins(userId);
  const partilharCheckIns =
    partilha.isPending && partilha.variables !== undefined
      ? partilha.variables
      : (perfil.data?.shareCheckinsWithGroups ?? false);
  const versao = versionLabel();
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
          accessibilityLabel="Notificações: boleias, malta e dicas. Toca para escolher."
          leading={<Icon name={icons.notificacoes} size={20} color={theme.accentInk} />}
          title="Notificações"
          subtitle="Boleias, malta e dicas do treinador"
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
          subtitle="As boas-vindas e os passos do início, outra vez."
          trailing={chevron}
          separador
        />
        <LinhaGrupo
          // Marking it unseen is enough: the tabs open it (see their layout).
          onPress={reverApresentacao}
          accessibilityLabel="Ver a apresentação da app"
          leading={<Icon name={icons.introducao} size={20} color={theme.accentInk} />}
          title="Ver a apresentação"
          subtitle="O que há em cada separador, em cinco passos."
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
      <Card style={styles.aspeto}>
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
          <SectionHeader title="Privacidade" />
          <Card style={styles.grupo}>
            <LinhaGrupo
              separador
              leading={<Icon name={icons.tasco} size={20} color={theme.accentInk} />}
              title="Dizer aos meus grupos em que tasco estou"
              subtitle="Quando fazes check-in, a conversa dos teus grupos recebe «estás no Tasco do Zé». Só o nome do tasco, nunca onde estás."
              trailing={
                <Switch
                  value={partilharCheckIns}
                  onValueChange={(ligar) => partilha.mutate(ligar)}
                  disabled={!perfil.data}
                  trackColor={{ true: theme.accent, false: theme.border }}
                  thumbColor={theme.accentText}
                  ios_backgroundColor={theme.border}
                  accessibilityLabel="Dizer aos meus grupos em que tasco estou"
                  testID="interruptor-partilhar-checkins"
                />
              }
            />
            <LinhaGrupo
              onPress={() => router.push('/perfil/bloqueados')}
              accessibilityLabel="Pessoas bloqueadas. Toca para abrir."
              leading={<Icon name={icons.silencio} size={20} color={theme.accentInk} />}
              title="Pessoas bloqueadas"
              subtitle="Não vês o que escrevem e não te podem convidar"
              trailing={chevron}
            />
          </Card>
        </>
      ) : null}

      <SectionHeader title="Sobre o AwayDay" />
      <Card style={styles.grupo}>
        <LinhaGrupo
          separador
          onPress={() => router.push({ pathname: '/legal/[documento]', params: { documento: 'privacidade' } })}
          leading={<Icon name={icons.password} size={20} color={theme.accentInk} />}
          title="Política de privacidade"
          trailing={chevron}
        />
        <LinhaGrupo
          separador
          onPress={() => router.push({ pathname: '/legal/[documento]', params: { documento: 'termos' } })}
          leading={<Icon name={icons.lista} size={20} color={theme.accentInk} />}
          title="Termos de utilização"
          trailing={chevron}
        />
        <LinhaGrupo
          onPress={() => router.push({ pathname: '/legal/[documento]', params: { documento: 'sobre' } })}
          leading={<Icon name={icons.email} size={20} color={theme.accentInk} />}
          title="Sobre e contactos"
          subtitle="Quem faz a app, fontes dos dados e das imagens"
          trailing={chevron}
        />
      </Card>

      {perfil.data?.isAdmin ? (
        <>
          <SectionHeader title="Administração" />
          <SegundoFatorAdmin>
          <Card style={styles.grupo}>
            <LinhaGrupo
              separador
              onPress={() => router.push('/perfil/pontos-de-encontro')}
              accessibilityLabel="Pontos de encontro por confirmar. Toca para abrir."
              leading={<Icon name={icons.pontoEncontro} size={20} color={theme.accentInk} />}
              title="Pontos de encontro por confirmar"
              subtitle="Encontrados nas notícias dos clubes"
              trailing={chevron}
            />
            <LinhaGrupo
              separador
              onPress={() => router.push('/perfil/fotos-por-aprovar')}
              accessibilityLabel="Fotos de tascos por aprovar. Toca para abrir."
              leading={<Icon name={icons.tasco} size={20} color={theme.accentInk} />}
              title="Fotos de tascos por aprovar"
              subtitle="Enviadas pelos adeptos"
              trailing={chevron}
            />
            <LinhaGrupo
              separador
              onPress={() => router.push('/perfil/denuncias')}
              accessibilityLabel="Denúncias por rever. Toca para abrir."
              leading={<Icon name={icons.aviso} size={20} color={theme.accentInk} />}
              title="Denúncias por rever"
              subtitle="Mensagens, pessoas e grupos denunciados"
              trailing={chevron}
            />
            <LinhaGrupo
              onPress={() => router.push('/perfil/feedback')}
              accessibilityLabel="Erros e ideias recebidos. Toca para abrir."
              leading={<Icon name={icons.lista} size={20} color={theme.accentInk} />}
              title="Erros e ideias recebidos"
              subtitle="O que a malta reportou em Ajudar a melhorar"
              trailing={chevron}
            />
          </Card>
          </SegundoFatorAdmin>
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
                  testID="interruptor-modo-demo"
                />
              }
            />
          </Card>
          {modoDemo ? <ModoDemoCard /> : null}
        </>
      ) : null}

      {versao ? (
        <ThemedText type="small" themeColor="textMuted" style={styles.versao}>
          {versao}
        </ThemedText>
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
  aspeto: {
    gap: Spacing.twoAndHalf,
  },
  grupo: {
    gap: 0,
    paddingVertical: 4,
  },
  versao: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});
