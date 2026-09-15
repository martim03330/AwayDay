import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { creditoFoto, MiniaturaTasco } from '@/components/foto-tasco';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { nomesTipoLocal } from '@/mocks/locais';
import type { Local, Nota } from '@/mocks/tipos';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** Room left on each side, so the neighbouring cards peek in and show there is more to swipe. */
const ESPREITAR_PX = 28;
const ESPACO_PX = 8;

type CarrosselLocaisProps = {
  locais: readonly Local[];
  emFocoId: string;
  /** Called when a swipe settles on another place. */
  onFocar: (localId: string) => void;
  /** The buttons at the bottom of each card (e.g. "Ver local", "Escolher"). */
  acoes: (local: Local) => ReactNode;
};

function textoNota(nota: Nota | null) {
  return nota === null ? 'Sem notas' : `${nota}/5`;
}

/** What a fan needs to decide from the map: what it is, how far, the fans' scores and why it is there. */
function CartaoLocal({
  local,
  posicao,
  total,
  largura,
  acoes,
}: {
  local: Local;
  posicao: number;
  total: number;
  largura: number;
  acoes: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.cartao, { width: largura, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cabecalho}>
        <MiniaturaTasco local={local} />
        <View style={styles.textos}>
          <View style={styles.topo}>
            <ThemedText style={styles.nome} numberOfLines={1}>
              {local.nome}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted">{`${posicao}/${total}`}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {`${nomesTipoLocal[local.tipo]} · ${local.minutosAPe} min a pé do estádio`}
          </ThemedText>
          {local.foto ? (
            <ThemedText style={styles.credito} themeColor="textMuted" numberOfLines={1}>
              {creditoFoto(local.foto)}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.etiquetas}>
        <Etiqueta icon={icons.tasco} label={textoNota(local.cervejometro)} tone="neutro" />
        <Etiqueta icon={icons.especialidade} label={textoNota(local.petiscometro)} tone="neutro" />
        {local.referencia ? (
          <Etiqueta icon={icons.selecionado} label="Referido por adeptos" tone="positivo" />
        ) : null}
        {local.homeFanHeavy ? (
          <Etiqueta icon={icons.casa} label="Adeptos da casa" tone="aviso" />
        ) : null}
      </View>
      <View style={styles.acoes}>{acoes}</View>
    </View>
  );
}

/**
 * Places near a stadium as a row of small cards over the bottom of a map. Swiping settles on the next card and tells
 * the map which place is in focus; tapping a marker (a new `emFocoId`) scrolls the row to that card. The cards stay
 * short so the map above keeps its bearings.
 */
export function CarrosselLocais({ locais, emFocoId, onFocar, acoes }: CarrosselLocaisProps) {
  const lista = useRef<FlatList<Local>>(null);
  const [larguraArea, setLarguraArea] = useState(0);
  // The index the row is showing, so a swipe does not scroll the row back to where it already is.
  const indiceVisivel = useRef(-1);

  const largura = Math.max(larguraArea - 2 * ESPREITAR_PX, 0);
  const passo = largura + ESPACO_PX;
  const indice = locais.findIndex((local) => local.id === emFocoId);

  useEffect(() => {
    if (indice < 0 || passo <= 0 || indice === indiceVisivel.current) return;
    const primeiraVez = indiceVisivel.current === -1;
    indiceVisivel.current = indice;
    lista.current?.scrollToOffset({ offset: indice * passo, animated: !primeiraVez });
  }, [indice, passo]);

  function medir(evento: LayoutChangeEvent) {
    setLarguraArea(evento.nativeEvent.layout.width);
  }

  function assentou(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    if (passo <= 0) return;
    const novo = Math.round(evento.nativeEvent.contentOffset.x / passo);
    const alvo = locais[Math.min(Math.max(novo, 0), locais.length - 1)];
    if (!alvo) return;
    indiceVisivel.current = locais.indexOf(alvo);
    if (alvo.id !== emFocoId) onFocar(alvo.id);
  }

  return (
    <View style={styles.area} onLayout={medir}>
      {largura > 0 ? (
        <FlatList
          ref={lista}
          data={locais}
          keyExtractor={(local) => local.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={passo}
          decelerationRate="fast"
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: ESPREITAR_PX, gap: ESPACO_PX }}
          getItemLayout={(_, posicao) => ({
            length: passo,
            offset: ESPREITAR_PX + passo * posicao,
            index: posicao,
          })}
          initialScrollIndex={indice > 0 ? indice : undefined}
          onMomentumScrollEnd={assentou}
          renderItem={({ item, index }) => (
            <CartaoLocal
              local={item}
              posicao={index + 1}
              total={locais.length}
              largura={largura}
              acoes={acoes(item)}
            />
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.two,
  },
  cartao: {
    gap: 6,
    padding: 12,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    ...CardShadow,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  credito: {
    fontSize: 10,
    lineHeight: 13,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nome: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 800,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  acoes: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: 2,
  },
});
