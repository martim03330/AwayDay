import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { BoleiasDoJogo } from '@/components/boleias-do-jogo';
import { DormidaCard } from '@/components/dormida-card';
import { GrupoDoJogo } from '@/components/grupo-do-jogo';
import { MapaEscolherTasco } from '@/components/mapa-escolher-tasco';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { avisosDoJogo, horasDoPlano } from '@/lib/avisos-jogo';
import { formatarDia, formatarDiaEHora, formatarHora } from '@/lib/datas';
import { abrirDirecoes } from '@/lib/direcoes';
import { formatarDistancia } from '@/lib/formatos';
import { estadoDoJogo } from '@/lib/jogos';
import { filtrarPorTempoAPe, ordenarTascos } from '@/lib/locais';
import { formatarContagem } from '@/lib/relogio';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { nomesCompeticao, obterJogo } from '@/mocks/jogos';
import { locaisDoEstadio, nomesTipoLocal, obterLocal } from '@/mocks/locais';
import { useAppState } from '@/state/app-state';
import { usePlanosJogos } from '@/state/planos-jogos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
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
export default function OMeuJogoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const agora = useNow(30 * 1000);
  const { jogoId } = useLocalSearchParams<{ jogoId: string }>();
  const { pessoasAqui } = useAppState();
  const { vou, alternarVou, tascoDoPlano, escolherTasco, avisosLigados, alternarAvisos } =
    usePlanosJogos();
  const [aEscolher, setAEscolher] = useState(false);

  const jogo = obterJogo(jogoId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;

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
          message={`Marca que vais ao ${casa.nomeCurto} x ${fora.nomeCurto} e preparamos o teu dia: tasco, horas e avisos.`}
          action={{ label: 'Vou a este jogo', onPress: () => void alternarVou(jogo.id) }}
        />
      </Screen>
    );
  }

  const inicio = new Date(jogo.inicio);
  const estado = estadoDoJogo(jogo, agora);
  const falta = inicio.getTime() - agora;
  const tascoId = tascoDoPlano(jogo.id);
  const tasco = tascoId ? obterLocal(tascoId) : undefined;
  const horas = horasDoPlano(jogo, tasco ?? null);
  // Every tasco near the stadium, in the order the app suggests them.
  const sugestoes = ordenarTascos(filtrarPorTempoAPe(locaisDoEstadio(estadio.id)).perto);
  const avisos = avisosLigados(jogo.id)
    ? avisosDoJogo(jogo, { casa: casa.nomeCurto, fora: fora.nomeCurto }, tasco ?? null, agora)
    : [];
  const pessoas = tasco ? pessoasAqui(tasco) : null;
  const mostrarEscolha = aEscolher || !tasco;

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

      <SectionHeader title="O teu tasco" />
      {tasco && !aEscolher ? (
        <Card style={styles.grupo}>
          <ThemedText style={styles.nomeTasco}>{tasco.nome}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {`${nomesTipoLocal[tasco.tipo]} · ${formatarDistancia(tasco.distanciaMetros)} · ${tasco.minutosAPe} min a pé do estádio`}
          </ThemedText>
          {pessoas !== null ? (
            <ThemedText themeColor="textSecondary">{`${pessoas} adeptos lá agora`}</ThemedText>
          ) : null}
          <Button
            label="Ver o tasco"
            icon={icons.tasco}
            onPress={() =>
              router.push({ pathname: '/locais/[localId]', params: { localId: tasco.id } })
            }
          />
          <Button
            label="Como chegar a pé"
            variant="secondary"
            icon={icons.aPe}
            onPress={() => abrirDirecoes(tasco.coordenadas, 'a-pe')}
          />
          <LinkTexto label="Escolher outro tasco" onPress={() => setAEscolher(true)} />
        </Card>
      ) : null}

      {mostrarEscolha ? (
        <>
          <MapaEscolherTasco
            estadio={estadio}
            locais={sugestoes}
            escolhidoId={tascoId}
            onEscolher={(localId) => {
              escolherTasco(jogo.id, localId);
              setAEscolher(false);
            }}
          />
          {tasco ? <LinkTexto label="Cancelar" onPress={() => setAEscolher(false)} /> : null}
        </>
      ) : null}

      <SectionHeader title="As tuas horas" />
      <Card style={styles.grupo}>
        {jogo.horaConfirmada ? (
          <>
            {horas.chegarAoTasco ? (
              <LinhaHora
                rotulo={`Chegar a ${tasco?.nome ?? 'o tasco'}`}
                hora={formatarHora(horas.chegarAoTasco)}
              />
            ) : null}
            <LinhaHora
              rotulo={tasco ? 'Sair do tasco para o estádio' : 'Ir para o estádio'}
              hora={formatarHora(horas.sairParaOEstadio)}
              destaque
            />
            <LinhaHora rotulo="Apito inicial" hora={formatarHora(inicio)} />
            <ThemedText type="small" themeColor="textMuted">
              {tasco
                ? `Conta com ${tasco.minutosAPe} min a pé, 15 min para entrar e 10 min de folga.`
                : 'Escolhe um tasco e acertamos as horas ao caminho a pé.'}
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
      <GrupoDoJogo jogo={jogo} tascoNome={tasco?.nome ?? null} />

      {/* Dormir fora faz parte de planear a ida, por isso está aqui e não só na ficha do estádio. */}
      {estadio && estadio.regiao !== 'continente' ? (
        <>
          <SectionHeader title="Onde dormir" />
          <DormidaCard jogo={jogo} estadio={estadio} />
        </>
      ) : null}

      <SectionHeader title="Boleias" />
      <BoleiasDoJogo jogo={jogo} />

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
          O aviso para planear chega 3 dias antes, nunca na véspera. Os do dia acertam-se ao tasco
          escolhido.
        </ThemedText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
