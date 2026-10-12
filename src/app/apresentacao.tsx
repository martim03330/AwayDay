import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Icon, icons, type IconName } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type Passo = { icon: IconName; titulo: string; texto: string };

/** One step per tab, in the order of the tab bar. Short on purpose: Martim corrects the words. */
const PASSOS: readonly Passo[] = [
  {
    icon: icons.jogos,
    titulo: 'Os jogos do teu clube',
    texto: 'Vê quando jogam, marca «Vou» e descobre o estádio: como chegar, onde estacionar e o tempo.',
  },
  {
    icon: icons.carro,
    titulo: 'Boleias para o jogo',
    texto: 'Oferece lugares no teu carro ou pede um. A gasolina e as portagens dividem-se por todos.',
  },
  {
    icon: icons.malta,
    titulo: 'A tua malta',
    texto: 'Cria um grupo, combina os jogos e conversa. A app faz as contas das despesas da viagem.',
  },
  {
    icon: icons.locais,
    titulo: 'Tascos à volta do estádio',
    texto: 'Os sítios que os adeptos recomendam. Faz check-in e ajuda a malta a saber onde ir.',
  },
  {
    icon: icons.ranking,
    titulo: 'Sobe no ranking',
    texto: 'Ganha pontos com estádios, tascos e missões. Bora à bola!',
  },
];

/**
 * A short tour of the app, once, right after the introduction (and again from Settings): one step per tab, swiped
 * sideways, with «Saltar» always there.
 */
export default function ApresentacaoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { marcarApresentacaoVista } = useAppState();
  const lista = useRef<ScrollView>(null);
  const [indice, setIndice] = useState(0);
  const ultimo = indice === PASSOS.length - 1;

  function fechar() {
    marcarApresentacaoVista();
    if (router.canGoBack()) router.back();
    else router.replace('/jogos');
  }

  function seguinte() {
    if (ultimo) {
      fechar();
      return;
    }
    lista.current?.scrollTo({ x: (indice + 1) * width, animated: true });
  }

  function aoDeslizar(evento: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndice(Math.round(evento.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={[styles.ecra, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
      <View style={styles.topo}>
        <Pressable onPress={fechar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Saltar a apresentação">
          <ThemedText style={styles.saltar}>Saltar</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        ref={lista}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={aoDeslizar}
        style={styles.flex}>
        {PASSOS.map((passo) => (
          <View key={passo.titulo} style={[styles.passo, { width }]}>
            <View style={styles.azulejo}>
              <Icon name={passo.icon} size={56} strokeWidth={1.8} color={Colors.highlightText} />
            </View>
            <ThemedText type="title" style={styles.titulo} accessibilityRole="header">
              {passo.titulo}
            </ThemedText>
            <ThemedText style={styles.texto}>{passo.texto}</ThemedText>
          </View>
        ))}
      </ScrollView>

      <View style={styles.rodape}>
        <View style={styles.pontos} accessibilityLabel={`Passo ${indice + 1} de ${PASSOS.length}`}>
          {PASSOS.map((passo, i) => (
            <View
              key={passo.titulo}
              style={[styles.ponto, i === indice ? styles.pontoAtivo : null]}
            />
          ))}
        </View>
        <Button label={ultimo ? 'Começar' : 'Seguinte'} variant="highlight" onPress={seguinte} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecra: {
    flex: 1,
    backgroundColor: Colors.accent,
  },
  flex: {
    flex: 1,
  },
  topo: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  saltar: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: 700,
  },
  passo: {
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  azulejo: {
    width: 104,
    height: 104,
    borderRadius: 30,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.highlight,
    transform: [{ rotate: '-6deg' }],
    marginBottom: Spacing.two,
  },
  titulo: {
    fontSize: 44,
    lineHeight: 46,
    color: Colors.accentText,
  },
  texto: {
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  rodape: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  pontos: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ponto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  pontoAtivo: {
    width: 22,
    backgroundColor: Colors.highlight,
  },
});
