import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { CarrosselLocais } from '@/components/carrossel-locais';
import { COR_TASCO, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Local, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const DELTA = 0.018;
const COR_ADEPTOS_DA_CASA = '#E8590C';

type MapaEscolherTascoProps = {
  estadio: Venue;
  /** In the order the app suggests them (researched and confirmed first). */
  locais: readonly Local[];
  escolhidoId: string | null;
  onEscolher: (localId: string) => void;
};

/**
 * Picking the tasco for "O meu jogo" on a map: tap a point or swipe the cards along the bottom. Each card shows the
 * fans' scores and why fans go there before choosing, with a way to open the tasco first.
 */
export function MapaEscolherTasco({
  estadio,
  locais,
  escolhidoId,
  onEscolher,
}: MapaEscolherTascoProps) {
  const router = useRouter();
  const theme = useTheme();
  const mapa = useRef<MapView>(null);
  const [emFocoId, setEmFocoId] = useState<string | null>(escolhidoId ?? locais[0]?.id ?? null);

  function focar(localId: string) {
    const alvo = locais.find((local) => local.id === localId);
    if (!alvo) return;
    setEmFocoId(localId);
    // The cards cover the bottom of the map, so the place is framed a little above the centre.
    mapa.current?.animateToRegion(
      {
        latitude: alvo.coordenadas.latitude - DELTA * 0.22,
        longitude: alvo.coordenadas.longitude,
        latitudeDelta: DELTA,
        longitudeDelta: DELTA,
      },
      300
    );
  }

  if (locais.length === 0) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          Ainda não mapeámos tascos perto deste estádio.
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.mapaArea}>
        <MapView
          ref={mapa}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: estadio.coordenadas.latitude - DELTA * 0.22,
            longitude: estadio.coordenadas.longitude,
            latitudeDelta: DELTA,
            longitudeDelta: DELTA,
          }}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterests={false}
          accessibilityLabel={`Mapa dos tascos perto do ${estadio.nome}`}>
          <MapMarker
            identifier={estadio.id}
            coordinate={estadio.coordenadas}
            title={estadio.nome}
            zIndex={5}>
            <View style={[styles.estadio, { backgroundColor: theme.accent }]}>
              <Icon name={icons.estadio} size={18} color={theme.accentText} />
            </View>
          </MapMarker>
          {locais.map((local) => {
            const focado = local.id === emFocoId;
            const escolhido = local.id === escolhidoId;
            const tamanho = focado ? 30 : 22;
            return (
              <MapMarker
                // The key includes the state so the custom marker is redrawn when it changes.
                key={`${local.id}-${focado}-${escolhido}`}
                identifier={local.id}
                coordinate={local.coordenadas}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={focado ? 10 : 1}
                // Without a callout, iOS hands the tap to onPress straight away.
                tappable
                onPress={(evento) => {
                  evento.stopPropagation();
                  focar(local.id);
                }}
                onSelect={() => focar(local.id)}
                accessibilityLabel={`${local.nome}, ${local.minutosAPe} minutos a pé do estádio`}>
                <View style={styles.pontoArea}>
                  <View
                    style={[
                      styles.ponto,
                      {
                        width: tamanho + 6,
                        height: tamanho + 6,
                        borderRadius: (tamanho + 6) / 2,
                        backgroundColor: escolhido
                          ? theme.highlight
                          : local.homeFanHeavy
                            ? COR_ADEPTOS_DA_CASA
                            : COR_TASCO,
                      },
                    ]}>
                    <Icon
                      name={escolhido ? icons.checkInFeito : icons.tasco}
                      size={tamanho * 0.62}
                      color={escolhido ? theme.highlightText : '#FFFFFF'}
                      strokeWidth={2.4}
                    />
                  </View>
                </View>
              </MapMarker>
            );
          })}
        </MapView>

        {emFocoId ? (
          <CarrosselLocais
            locais={locais}
            emFocoId={emFocoId}
            onFocar={focar}
            acoes={(local) => (
              <>
                <View style={styles.acao}>
                  <Button
                    label={local.id === escolhidoId ? 'Escolhido' : 'Escolher'}
                    icon={icons.selecionado}
                    disabled={local.id === escolhidoId}
                    onPress={() => onEscolher(local.id)}
                  />
                </View>
                <View style={styles.acao}>
                  <Button
                    label="Ver tasco"
                    variant="secondary"
                    icon={icons.seguinte}
                    onPress={() =>
                      router.push({ pathname: '/locais/[localId]', params: { localId: local.id } })
                    }
                  />
                </View>
              </>
            )}
          />
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textMuted">
        Toca num ponto ou desliza os cartões. A amarelo, o que escolheste; a laranja, sítios de
        adeptos da casa.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  mapaArea: {
    height: 440,
    marginHorizontal: -Spacing.two,
    borderRadius: Radius.button,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  estadio: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pontoArea: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ponto: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acao: {
    flex: 1,
  },
});
