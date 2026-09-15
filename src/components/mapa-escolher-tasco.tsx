import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { MapMarker } from 'react-native-maps';

import { DeslizarEntreLocais } from '@/components/deslizar-locais';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDistancia } from '@/lib/formatos';
import { nomesTipoLocal } from '@/mocks/locais';
import type { Local, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const DELTA = 0.018;

type MapaEscolherTascoProps = {
  estadio: Venue;
  /** In the order the app suggests them (confirmed and quick and cheap first). */
  locais: readonly Local[];
  escolhidoId: string | null;
  onEscolher: (localId: string) => void;
};

/**
 * Picking the tasco for "O meu jogo" on a map: where each place is next to the stadium, a card for the one tapped
 * (swipe it for the next) and a button to choose it.
 */
export function MapaEscolherTasco({
  estadio,
  locais,
  escolhidoId,
  onEscolher,
}: MapaEscolherTascoProps) {
  const theme = useTheme();
  const mapa = useRef<MapView>(null);
  const [emFocoId, setEmFocoId] = useState<string | null>(escolhidoId ?? locais[0]?.id ?? null);

  const indice = locais.findIndex((local) => local.id === emFocoId);
  const emFoco = indice >= 0 ? locais[indice] : undefined;

  function focar(localId: string) {
    const alvo = locais.find((local) => local.id === localId);
    if (!alvo) return;
    setEmFocoId(localId);
    mapa.current?.animateToRegion(
      { ...alvo.coordenadas, latitudeDelta: DELTA, longitudeDelta: DELTA },
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
          initialRegion={{ ...estadio.coordenadas, latitudeDelta: DELTA, longitudeDelta: DELTA }}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterests={false}
          accessibilityLabel={`Mapa dos tascos perto do ${estadio.nome}`}>
          <MapMarker coordinate={estadio.coordenadas} title={estadio.nome} zIndex={5}>
            <View style={[styles.estadio, { backgroundColor: theme.accent }]}>
              <Icon name={icons.estadio} size={18} color={theme.accentText} />
            </View>
          </MapMarker>
          {locais.map((local) => {
            const focado = local.id === emFocoId;
            const escolhido = local.id === escolhidoId;
            const tamanho = focado ? 28 : 18;
            return (
              <MapMarker
                // The key includes the state so the custom marker is redrawn when it changes.
                key={`${local.id}-${focado}-${escolhido}`}
                coordinate={local.coordenadas}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={focado ? 10 : 1}
                onPress={() => focar(local.id)}
                accessibilityLabel={`${local.nome}, ${local.minutosAPe} minutos a pé do estádio`}>
                <View style={styles.pontoArea}>
                  <View
                    style={[
                      styles.ponto,
                      {
                        width: tamanho,
                        height: tamanho,
                        borderRadius: tamanho / 2,
                        backgroundColor: escolhido ? theme.highlight : theme.accent,
                      },
                    ]}
                  />
                </View>
              </MapMarker>
            );
          })}
        </MapView>
      </View>

      {emFoco ? (
        <DeslizarEntreLocais
          anterior={indice > 0 ? locais[indice - 1] : undefined}
          seguinte={locais[indice + 1]}
          posicao={indice + 1}
          total={locais.length}
          onMudar={focar}>
          <View style={styles.detalhe}>
            <ThemedText style={styles.nome} numberOfLines={2}>
              {emFoco.nome}
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {`${nomesTipoLocal[emFoco.tipo]} · ${emFoco.minutosAPe} min a pé (${formatarDistancia(emFoco.distanciaMetros)})`}
            </ThemedText>
            <View style={styles.etiquetas}>
              {emFoco.rapidoEBarato ? (
                <Etiqueta icon={icons.preco} label="Rápido e barato" tone="destaque" />
              ) : null}
              {emFoco.confirmacao === 'sugerido' ? (
                <Etiqueta icon={icons.porVerificar} label="Por confirmar" tone="aviso" />
              ) : null}
            </View>
            <Button
              label={emFoco.id === escolhidoId ? 'É o teu tasco' : 'Escolher este tasco'}
              icon={icons.selecionado}
              disabled={emFoco.id === escolhidoId}
              onPress={() => onEscolher(emFoco.id)}
            />
          </View>
        </DeslizarEntreLocais>
      ) : null}

      <ThemedText type="small" themeColor="textMuted">
        Toca num ponto para veres o tasco. A amarelo, o que escolheste.
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
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  detalhe: {
    gap: Spacing.two,
  },
  nome: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 800,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
