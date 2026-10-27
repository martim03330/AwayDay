import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';

import { ModoDemoCard } from '@/components/modo-demo-card';
import { Spacing } from '@/constants/theme';
import { versionLabel } from '@/features/feedback/versao';
import { useLocationPermission } from '@/features/presence/location';
import { rankingsKey } from '@/features/presence/hooks/usePresence';
import {
  useMyProfile,
  useUpdateRankingVisibility,
  useUpdateShareCheckins,
} from '@/features/profile/hooks/useMyProfile';
import { useTheme } from '@/hooks/use-theme';
import { confirmarDono, metodoDeBloqueio, type MetodoDeBloqueio } from '@/lib/bloqueio-local';
import { useUserId } from '@/lib/session';
import { useAppState, type EstadoPermissao } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

/** The demo's (simulated) answer to the location question, as the short value at the end of the row. */
function textoPermissaoDemo(estado: EstadoPermissao) {
  if (estado === 'aceite') return 'Aceite';
  if (estado === 'recusada') return 'Recusada';
  return 'Por decidir';
}

/** The three appearance options; until one is picked, the app follows the phone. */
const TEMAS = [
  { valor: 'claro' as const, rotulo: 'Claro' },
  { valor: 'escuro' as const, rotulo: 'Escuro' },
  { valor: 'sistema' as const, rotulo: 'Como o telemóvel' },
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
    bloqueioAoAbrir,
    mudarBloqueioAoAbrir,
    esconderValores,
    alternarEsconderValores,
  } = useAppState();
  // What this phone can lock with (Face ID, Touch ID, passcode…), to name the option; none hides it.
  const [metodo, setMetodo] = useState<MetodoDeBloqueio | null>(null);
  const [aLigarBloqueio, setALigarBloqueio] = useState(false);
  useEffect(() => {
    let vivo = true;
    void metodoDeBloqueio().then((encontrado) => {
      if (vivo) setMetodo(encontrado);
    });
    return () => {
      vivo = false;
    };
  }, []);
  // The lock only exists with an account, outside demo mode (see BloqueioDaApp).
  const mostrarBloqueio = fonte === 'conta' && metodo?.disponivel === true;

  /** Turning it on asks once first, so nobody locks themselves out with a method that does not work. */
  async function mudarBloqueio(ligar: boolean) {
    if (!ligar) {
      mudarBloqueioAoAbrir(false);
      return;
    }
    setALigarBloqueio(true);
    const confirmado = await confirmarDono('Confirmar para ligar o bloqueio');
    setALigarBloqueio(false);
    if (confirmado) mudarBloqueioAoAbrir(true);
  }
  const [permissaoLocalizacao] = useLocationPermission();
  const userId = useUserId();
  const perfil = useMyProfile(fonte === 'conta' ? userId : null);
  const partilha = useUpdateShareCheckins(userId);
  // Appearing in the rankings: on by default, turned off here (it used to sit on the Ranking tab, always in sight).
  const queryClient = useQueryClient();
  const visibilidadeNoRanking = useUpdateRankingVisibility(userId);
  const aparecoNoRanking =
    visibilidadeNoRanking.isPending && visibilidadeNoRanking.variables !== undefined
      ? visibilidadeNoRanking.variables
      : (perfil.data?.showInRankings ?? true);
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
    if (permissaoLocalizacao?.granted) return 'Autorizada';
    if (localizacaoBloqueada) return 'Recusada';
    return 'Por pedir';
  }

  return (
    <Screen>
      <Card style={styles.grupo}>
        <LinhaGrupo
          separador
          leading={<Icon name={icons.som} size={20} color={theme.accentInk} />}
          title="Sons"
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
          trailing={chevron}
        />
        <LinhaGrupo
          separador
          onPress={
            !modoDemo && localizacaoBloqueada ? () => void Linking.openSettings() : undefined
          }
          accessibilityLabel={`Localização, ${textoLocalizacao().toLowerCase()}.${
            !modoDemo && localizacaoBloqueada ? ' Toca para abrir as definições do telemóvel.' : ''
          }`}
          leading={<Icon name={icons.localizacao} size={20} color={theme.accentInk} />}
          title="Localização"
          valor={textoLocalizacao()}
          trailing={!modoDemo && localizacaoBloqueada ? chevron : undefined}
        />
        <LinhaGrupo
          onPress={reverIntroducao}
          accessibilityLabel="Rever a introdução"
          leading={<Icon name={icons.recomecar} size={20} color={theme.accentInk} />}
          title="Rever a introdução"
          trailing={chevron}
          separador
        />
        <LinhaGrupo
          // Marking it unseen is enough: the tabs show it on top (see their layout).
          onPress={reverApresentacao}
          accessibilityLabel="Ver a apresentação da app"
          leading={<Icon name={icons.introducao} size={20} color={theme.accentInk} />}
          title="Ver a apresentação"
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
          trailing={chevron}
        />
      </Card>

      <SectionHeader title="Aspeto" />
      <Card style={styles.aspeto}>
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

      <SectionHeader title="Privacidade" />
      <Card style={styles.grupo}>
        {mostrarBloqueio && metodo?.disponivel ? (
          <LinhaGrupo
            separador
            leading={<Icon name={icons.password} size={20} color={theme.accentInk} />}
            title={`Bloquear com ${metodo.nome}`}
            trailing={
              <Switch
                value={bloqueioAoAbrir}
                onValueChange={(ligar) => void mudarBloqueio(ligar)}
                disabled={aLigarBloqueio}
                trackColor={{ true: theme.accent, false: theme.border }}
                thumbColor={theme.accentText}
                ios_backgroundColor={theme.border}
                accessibilityLabel={`Bloquear com ${metodo.nome}`}
                testID="interruptor-bloqueio"
              />
            }
          />
        ) : null}
        <LinhaGrupo
          separador={fonte === 'conta'}
          leading={
            <Icon
              name={esconderValores ? icons.naoEspreitar : icons.espreitar}
              size={20}
              color={theme.accentInk}
            />
          }
          title="Esconder valores"
          trailing={
            <Switch
              value={esconderValores}
              onValueChange={alternarEsconderValores}
              trackColor={{ true: theme.accent, false: theme.border }}
              thumbColor={theme.accentText}
              ios_backgroundColor={theme.border}
              accessibilityLabel="Esconder valores"
              accessibilityHint="Mostra «•••• €» em vez dos montantes"
              testID="interruptor-esconder-valores"
            />
          }
        />
        {fonte === 'conta' ? (
          <>
            <LinhaGrupo
              separador
              leading={<Icon name={icons.ranking} size={20} color={theme.accentInk} />}
              title="Aparecer no ranking"
              trailing={
                <Switch
                  value={aparecoNoRanking}
                  onValueChange={(ligar) =>
                    visibilidadeNoRanking.mutate(ligar, {
                      onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: ['ranking'] });
                        void queryClient.invalidateQueries({ queryKey: rankingsKey(userId) });
                      },
                    })
                  }
                  disabled={!perfil.data}
                  trackColor={{ true: theme.accent, false: theme.border }}
                  thumbColor={theme.accentText}
                  ios_backgroundColor={theme.border}
                  accessibilityLabel="Aparecer no ranking"
                  accessibilityHint="Nome, nível e pontos nas tabelas. Nunca onde estás."
                  testID="interruptor-aparecer-ranking"
                />
              }
            />
            <LinhaGrupo
              separador
              leading={<Icon name={icons.tasco} size={20} color={theme.accentInk} />}
              title="Dizer aos meus grupos em que tasco estou"
              trailing={
                <Switch
                  value={partilharCheckIns}
                  onValueChange={(ligar) => partilha.mutate(ligar)}
                  disabled={!perfil.data}
                  trackColor={{ true: theme.accent, false: theme.border }}
                  thumbColor={theme.accentText}
                  ios_backgroundColor={theme.border}
                  accessibilityLabel="Dizer aos meus grupos em que tasco estou"
                  accessibilityHint="Só o nome do tasco, nunca onde estás"
                  testID="interruptor-partilhar-checkins"
                />
              }
            />
            <LinhaGrupo
              onPress={() => router.push('/perfil/bloqueados')}
              accessibilityLabel="Pessoas bloqueadas. Toca para abrir."
              leading={<Icon name={icons.silencio} size={20} color={theme.accentInk} />}
              title="Pessoas bloqueadas"
              trailing={chevron}
            />
          </>
        ) : null}
      </Card>

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
          trailing={chevron}
        />
      </Card>

      {demo === '1' || modoDemo ? (
        <>
          <SectionHeader title="Modo demo" />
          <Card style={styles.grupo}>
            <LinhaGrupo
              leading={<Icon name={icons.demo} size={20} color={theme.accentInk} />}
              title="Modo demo"
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
        <ThemedText
          type="small"
          themeColor="textMuted"
          style={styles.versao}
          // Admin tools are hidden from everyone: a long press on the version opens them, and only for admins.
          onLongPress={perfil.data?.isAdmin ? () => router.push('/perfil/administracao') : undefined}>
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
