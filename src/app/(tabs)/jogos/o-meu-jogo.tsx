import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { GrupoDoJogo } from '@/components/grupo-do-jogo';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { avisosDoJogo, horasDoPlano } from '@/lib/avisos-jogo';
import { formatarDia, formatarDiaEHora, formatarHora } from '@/lib/datas';
import { precisaDeDormida } from '@/lib/dormida';
import { contasDaViagemAbertas, estadoDoJogo } from '@/lib/jogos';
import { formatarContagem } from '@/lib/relogio';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { nomesCompeticao, obterJogo } from '@/mocks/jogos';
import { useAppState } from '@/state/app-state';
import { usePlanosJogos } from '@/state/planos-jogos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons, type IconName } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { Screen } from '@/ui/screen';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

const DIA_MS = 24 * 60 * 60 * 1000;

function LinhaHora({
  rotulo,
  hora,
  destaque = false,
}: {
  rotulo: string;
  hora: string;
  destaque?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${rotulo}: ${hora}`}
      style={[styles.linhaHora, { borderTopColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.flex}>{rotulo}</ThemedText>
      <ThemedText type="score" style={[styles.hora, destaque && { color: theme.accentInk }]}>
        {hora}
      </ThemedText>
    </View>
  );
}

/** One place to prepare a game the fan is going to: tasco, times, meeting point and reminders. */

/** Uma linha de atalho para uma página deste jogo. */
function AtalhoDoJogo({
  icone,
  titulo,
  resumo,
  onPress,
  separador,
}: {
  icone: IconName;
  titulo: string;
  resumo: string;
  onPress: () => void;
  separador?: boolean;
}) {
  const theme = useTheme();
  return (
    <LinhaGrupo
      onPress={onPress}
      accessibilityLabel={`${titulo}. ${resumo}. Toca para abrir.`}
      leading={
        <View style={[styles.azulejo, { backgroundColor: theme.successBackground }]}>
          <Icon name={icone} size={20} color={theme.accentInk} />
        </View>
      }
      title={titulo}
      subtitle={resumo}
      trailing={<Icon name={icons.seguinte} size={18} color={theme.textMuted} />}
      separador={separador}
    />
  );
}

export default function OMeuJogoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const abrirDoJogo = (pathname: string) =>
    router.push({ pathname: pathname as '/jogos/mapa', params: { jogoId } });
  const agora = useNow(30 * 1000);
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  const { clubeDaTerraId } = useAppState();
  const { vou, alternarVou, avisosLigados, alternarAvisos } = usePlanosJogos();

  const jogo = obterJogo(jogoId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  // Quem é das ilhas dorme fora para vir ao continente: a terra do adepto conta tanto como o sítio do jogo.
  const terra = clubeDaTerraId ? obterClube(clubeDaTerraId) : undefined;
  const estadioDaTerra = terra?.estadioId ? obterEstadio(terra.estadioId) : undefined;

  if (!jogo || !casa || !fora || !estadio) {
    return (
      <Screen>
        <EmptyState
          icon={icons.naoEncontrado}
          title="Jogo não encontrado"
          message="Este jogo já não está no calendário."
          action={{ label: 'Voltar', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  if (!vou(jogo.id)) {
    return (
      <Screen>
        <EmptyState
          icon={icons.acesso}
          title="Ainda não marcaste que vais"
          message={`Marca que vais ao ${casa.nomeCurto} x ${fora.nomeCurto} e preparamos o teu dia: horas, boleias e avisos.`}
          action={{ label: 'Vou a este jogo', onPress: () => void alternarVou(jogo.id) }}
        />
      </Screen>
    );
  }

  const inicio = new Date(jogo.inicio);
  const estado = estadoDoJogo(jogo, agora);
  const falta = inicio.getTime() - agora;
  // As horas contam-se até ao estádio. Onde se bebe a imperial antes escolhe-se no mapa, não aqui: um dia de jogo
  // não se resume a um tasco, e obrigar a escolher um era fingir que sim.
  const horas = horasDoPlano(jogo, null);
  // Every tasco near the stadium, in the order the app suggests them.
  const avisos = avisosLigados(jogo.id)
    ? avisosDoJogo(jogo, { casa: casa.nomeCurto, fora: fora.nomeCurto }, null, agora)
    : [];

  return (
    <Screen>
      <Card style={styles.cabecalho}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          {`${nomesCompeticao[jogo.competicao]} · ${jogo.fase}`}
        </ThemedText>
        <ThemedText type="title" style={styles.titulo}>
          {`${casa.nomeCurto} x ${fora.nomeCurto}`}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {`${jogo.horaConfirmada ? formatarDiaEHora(inicio, agora) : `${formatarDia(inicio, agora)} · hora por definir`} · ${estadio.nome}`}
        </ThemedText>
        {estado === 'agendado' ? (
          <Etiqueta
            icon={icons.horario}
            label={
              falta < DIA_MS
                ? `Faltam ${formatarContagem(falta)}`
                : `Faltam ${Math.ceil(falta / DIA_MS)} dias`
            }
            tone="destaque"
          />
        ) : (
          <Etiqueta
            icon={icons.horario}
            label={estado === 'a-decorrer' ? 'Em jogo' : 'Terminado'}
            tone={estado === 'a-decorrer' ? 'positivo' : 'neutro'}
          />
        )}
      </Card>

      <SectionHeader title="Tudo deste jogo" />
      <Card style={styles.atalhos}>
        <AtalhoDoJogo
          icone={icons.carro}
          titulo="Boleias"
          resumo="Quem leva quem, e a volta depois do apito"
          onPress={() => abrirDoJogo('/jogos/boleias')}
          separador
        />
        {contasDaViagemAbertas(jogo, agora) ? (
          <AtalhoDoJogo
            icone={icons.preco}
            titulo="Contas da viagem"
            resumo="As despesas do dia e quem paga a quem"
            onPress={() => abrirDoJogo('/jogos/contas-do-jogo')}
            separador
          />
        ) : null}
        {estadio && precisaDeDormida(estadio, estadioDaTerra ?? null) ? (
          <AtalhoDoJogo
            icone={icons.casa}
            titulo="Onde dormir"
            resumo="Juntar a malta para uma casa, nos jogos longe"
            onPress={() => abrirDoJogo('/jogos/dormir')}
            separador
          />
        ) : null}
        <AtalhoDoJogo
          icone={icons.rota}
          titulo="Chegar e estacionar"
          resumo="O caminho e os parques à volta do estádio"
          onPress={() => abrirDoJogo('/jogos/chegar')}
          separador
        />
        <AtalhoDoJogo
          icone={icons.locais}
          titulo="Mapa e sítios"
          resumo="Tascos, parques e WC à volta"
          onPress={() => abrirDoJogo('/jogos/mapa')}
          separador
        />
        <AtalhoDoJogo
          icone={icons.estadio}
          titulo="O estádio"
          resumo="Ficha, ponto de encontro, WC e meteorologia"
          onPress={() => abrirDoJogo('/jogos/estadio')}
        />
      </Card>

      <SectionHeader title="As tuas horas" />
      <Card style={styles.grupo}>
        {jogo.horaConfirmada ? (
          <>
            <LinhaHora
              rotulo="Ir para o estádio"
              hora={formatarHora(horas.sairParaOEstadio)}
              destaque
            />
            <LinhaHora rotulo="Apito inicial" hora={formatarHora(inicio)} />
            <ThemedText type="small" themeColor="textMuted">
              Conta com 15 min para entrar e 10 min de folga. Se fores a um tasco antes, vês o
              caminho a pé na página desse sítio.
            </ThemedText>
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            As horas aparecem quando a hora do jogo for confirmada. Avisamos-te quando mudar.
          </ThemedText>
        )}
      </Card>

      {jogo.pontoEncontro ? (
        <>
          <SectionHeader title="Ponto de encontro oficial" />
          <Card style={styles.grupo}>
            <ThemedText style={styles.nomeTasco}>{jogo.pontoEncontro.nome}</ThemedText>
            <ThemedText themeColor="textSecondary">{jogo.pontoEncontro.horario}</ThemedText>
            <LinkTexto
              label="Ver no jogo, com mapa e caminho"
              onPress={() =>
                router.push({ pathname: '/jogos/[jogoId]', params: { jogoId: jogo.id } })
              }
            />
          </Card>
        </>
      ) : null}

      {/* Desenha o seu próprio cabeçalho: sem boleia, casa nem tasco não aparece nada. */}
      <GrupoDoJogo jogo={jogo} tascoNome={null} />

      <SectionHeader title="Avisos deste jogo" />
      <Card style={styles.grupo}>
        <View style={styles.linhaSwitch}>
          <ThemedText style={styles.flex}>Avisar-me neste telemóvel</ThemedText>
          <Switch
            value={avisosLigados(jogo.id)}
            onValueChange={() => alternarAvisos(jogo.id)}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.accentText}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Avisos deste jogo"
          />
        </View>
        {avisos.map((aviso) => (
          <View key={aviso.id} style={[styles.aviso, { borderTopColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{formatarDiaEHora(aviso.quando, agora)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {aviso.titulo}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="small" themeColor="textMuted">
          O aviso para planear chega 3 dias antes, nunca na véspera. Os do dia acertam-se ao caminho
          escolhido.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  atalhos: {
    // As linhas trazem o seu espaço vertical; o lado fica com o do cartão, senão o ícone cola-se à borda.
    gap: 0,
    paddingVertical: Spacing.one,
  },
  azulejo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalho: {
    gap: Spacing.two,
  },
  titulo: {
    fontSize: 30,
    lineHeight: 34,
  },
  grupo: {
    gap: Spacing.two,
  },
  nomeTasco: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 800,
  },
  linhaHora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  hora: {
    fontSize: 24,
    lineHeight: 28,
  },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  aviso: {
    gap: 2,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  flex: {
    flex: 1,
  },
});
