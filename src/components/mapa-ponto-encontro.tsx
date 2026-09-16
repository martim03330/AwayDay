import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import MapView, { MapMarker, Polyline } from 'react-native-maps';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { getCurrentPosition } from '@/features/presence/location';
import { fetchWalkingRoute } from '@/features/routes/api';
import { RouteRefused, type WalkingRoute } from '@/features/routes/types';
import { useTheme } from '@/hooks/use-theme';
import { formatarDistancia } from '@/lib/formatos';
import type { Coordenadas, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

/** Instructions shown before "Ver todas as indicações". */
const PASSOS_VISIVEIS = 5;
const DELTA_INICIAL = 0.03;

type MapaPontoEncontroProps = {
  nome: string;
  coordenadas: Coordenadas;
  estadio: Venue;
};

function minutos(segundos: number) {
  return Math.max(1, Math.round(segundos / 60));
}

/**
 * The official meeting point on a map, with a walking route from where the fan is, drawn and described inside the
 * app. The position is only sent to work out the route (see the walking-route Edge Function).
 */
export function MapaPontoEncontro({ nome, coordenadas, estadio }: MapaPontoEncontroProps) {
  const theme = useTheme();
  const mapa = useRef<MapView>(null);
  // Preso, como o mapa do jogo: dentro de uma página que desliza, um mapa que se arrasta rouba o dedo a quem desce.
  const [mapaLivre, setMapaLivre] = useState(false);
  const [rota, setRota] = useState<WalkingRoute | null>(null);
  const [aCalcular, setACalcular] = useState(false);
  const [verTodos, setVerTodos] = useState(false);

  async function calcular() {
    if (aCalcular) return;
    setACalcular(true);
    try {
      const posicao = await getCurrentPosition();
      if (posicao.status === 'denied') {
        Alert.alert(
          'Precisamos da localização',
          'Para te levar ao ponto de encontro, a app precisa de saber onde estás. A localização não fica guardada.',
          posicao.canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Agora não', style: 'cancel' },
                { text: 'Abrir definições', onPress: () => void Linking.openSettings() },
              ]
        );
        return;
      }
      if (posicao.status === 'unavailable') {
        Alert.alert(
          'Não conseguimos saber onde estás',
          'Liga a localização do telemóvel e tenta outra vez.'
        );
        return;
      }
      const nova = await fetchWalkingRoute(posicao.position, coordenadas);
      setRota(nova);
      setVerTodos(false);
      mapa.current?.fitToCoordinates(nova.path, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
    } catch (erro: unknown) {
      if (erro instanceof RouteRefused && erro.reason === 'too-far') {
        Alert.alert(
          'Ainda estás longe',
          'Estás a mais de 30 km do ponto de encontro. Quando estiveres na cidade, volta a tocar em «Levar-me até lá».'
        );
      } else if (erro instanceof RouteRefused && erro.reason === 'rate-limited') {
        Alert.alert('Muitos pedidos seguidos', 'Espera um bocadinho e tenta outra vez.');
      } else {
        Alert.alert('Não deu para calcular o caminho', 'Verifica a ligação e tenta outra vez.');
      }
    } finally {
      setACalcular(false);
    }
  }

  const passos = rota ? (verTodos ? rota.steps : rota.steps.slice(0, PASSOS_VISIVEIS)) : [];

  return (
    <Card style={styles.card}>
      <View style={styles.mapaArea}>
        <MapView
          ref={mapa}
          style={StyleSheet.absoluteFill}
          scrollEnabled={mapaLivre}
          zoomEnabled={mapaLivre}
          initialRegion={{
            ...coordenadas,
            latitudeDelta: DELTA_INICIAL,
            longitudeDelta: DELTA_INICIAL,
          }}
          showsUserLocation={rota !== null}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          accessibilityLabel={`Mapa com o ponto de encontro: ${nome}`}>
          <MapMarker
            coordinate={coordenadas}
            title={nome}
            description="Ponto de encontro oficial"
            zIndex={10}>
            <View style={[styles.pino, { backgroundColor: theme.highlight }]}>
              <Icon name={icons.pontoEncontro} size={20} color={theme.highlightText} />
            </View>
          </MapMarker>
          <MapMarker coordinate={estadio.coordenadas} title={estadio.nome} description="Estádio">
            <View style={[styles.pino, { backgroundColor: theme.accent }]}>
              <Icon name={icons.estadio} size={18} color={theme.accentText} />
            </View>
          </MapMarker>
          {rota ? (
            <Polyline coordinates={rota.path} strokeColor={theme.accent} strokeWidth={5} />
          ) : null}
        </MapView>

        <Pressable
          onPress={() => setMapaLivre((livre) => !livre)}
          accessibilityRole="button"
          accessibilityState={{ selected: mapaLivre }}
          accessibilityLabel={
            mapaLivre
              ? 'Prender o mapa, para a página voltar a deslizar por cima dele'
              : 'Soltar o mapa, para o poderes arrastar e aproximar'
          }
          style={({ pressed }) => [
            styles.trancaMapa,
            { backgroundColor: mapaLivre ? theme.accent : theme.backgroundElement },
            pressed && styles.trancaPressionada,
          ]}>
          <Icon
            name={mapaLivre ? icons.selecionado : icons.rota}
            size={16}
            color={mapaLivre ? theme.accentText : theme.text}
          />
          <ThemedText
            type="small"
            style={[styles.trancaTexto, { color: mapaLivre ? theme.accentText : theme.text }]}>
            {mapaLivre ? 'Prender' : 'Mexer no mapa'}
          </ThemedText>
        </Pressable>
      </View>

      {rota ? (
        <View
          style={styles.resumo}
          accessible
          accessibilityLabel={`${formatarDistancia(rota.distanceM)}, cerca de ${minutos(rota.durationS)} minutos a pé`}>
          <Icon name={icons.aPe} size={20} color={theme.accentInk} />
          <ThemedText style={styles.resumoTexto}>
            {`${formatarDistancia(rota.distanceM)} · cerca de ${minutos(rota.durationS)} min a pé`}
          </ThemedText>
        </View>
      ) : null}

      <Button
        label={
          aCalcular
            ? 'A calcular o caminho…'
            : rota
              ? 'Recalcular a partir daqui'
              : 'Levar-me até lá'
        }
        icon={icons.rota}
        variant={rota ? 'secondary' : 'primary'}
        disabled={aCalcular}
        onPress={() => void calcular()}
      />

      {passos.length > 0 ? (
        <View style={styles.passos}>
          {passos.map((passo, indice) => (
            <View
              key={`${indice}-${passo.instruction}`}
              style={[styles.passo, { borderTopColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold" style={styles.numero}>
                {indice + 1}
              </ThemedText>
              <ThemedText type="small" style={styles.instrucao}>
                {passo.instruction}
              </ThemedText>
              {passo.distanceM > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {formatarDistancia(passo.distanceM)}
                </ThemedText>
              ) : null}
            </View>
          ))}
          {rota && rota.steps.length > PASSOS_VISIVEIS ? (
            <LinkTexto
              label={verTodos ? 'Mostrar menos' : `Ver as ${rota.steps.length} indicações`}
              onPress={() => setVerTodos((atual) => !atual)}
            />
          ) : null}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textMuted">
        {rota
          ? `A tua localização só serviu para calcular o caminho e não fica guardada. ${rota.attribution}.`
          : 'Toca em «Levar-me até lá» para veres o caminho a pé desde onde estás, sem sair da app.'}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  mapaArea: {
    height: 300,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  trancaMapa: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    ...CardShadow,
  },
  trancaPressionada: {
    opacity: 0.85,
  },
  trancaTexto: {
    fontWeight: '600',
  },
  pino: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  resumoTexto: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: 800,
  },
  passos: {
    gap: 0,
  },
  passo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  numero: {
    width: 22,
    textAlign: 'center',
  },
  instrucao: {
    flex: 1,
  },
});
