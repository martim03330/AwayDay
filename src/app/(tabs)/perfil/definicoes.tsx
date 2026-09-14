import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Switch } from 'react-native';

import { ModoDemoCard } from '@/components/modo-demo-card';
import { useTheme } from '@/hooks/use-theme';
import { TIPOS_NOTIFICACAO } from '@/mocks/notificacoes';
import { useAppState, type EstadoPermissao } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';

function textoPermissao(estado: EstadoPermissao) {
  if (estado === 'aceite') return 'Aceite na introdução (simulado)';
  if (estado === 'recusada') return 'Continuas sem (simulado)';
  return 'Ainda não decidiste';
}

export default function DefinicoesScreen() {
  const router = useRouter();
  const theme = useTheme();
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
  } = useAppState();
  const notificacoesLigadas = TIPOS_NOTIFICACAO.filter((tipo) => notificacoes[tipo]).length;
  const chevron = <Icon name={icons.seguinte} size={18} color={theme.textMuted} />;

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
          leading={<Icon name={icons.localizacao} size={20} color={theme.accentInk} />}
          title="Localização"
          subtitle={textoPermissao(permissoes.localizacao)}
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
  grupo: {
    gap: 0,
    paddingVertical: 4,
  },
});
