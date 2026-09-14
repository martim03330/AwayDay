import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ID_UTILIZADOR } from '@/lib/tascos';
import { obterClube } from '@/mocks/clubes';
import type { UtilizadorRanking } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { ThemedText } from '@/ui/themed-text';

type EntradaRanking = UtilizadorRanking & { posicao: number };

type RankingCardProps = {
  ranking: readonly EntradaRanking[];
};

/** Podium heights, bar colours and number sizes for 1st, 2nd and 3rd place. */
const PODIO = {
  1: { altura: 100, avatar: 58, numero: 44 },
  2: { altura: 74, avatar: 48, numero: 36 },
  3: { altura: 56, avatar: 48, numero: 32 },
} as const;

/** "Rita das Bifanas" -> "RB": first letters of the first two capitalised words. */
function iniciais(nome: string) {
  const palavras = nome.split(/\s+/).filter((palavra) => /^\p{Lu}/u.test(palavra));
  return palavras
    .slice(0, 2)
    .map((palavra) => palavra.charAt(0))
    .join('')
    .toUpperCase();
}

/** Light club colours (e.g. white) need dark ink for the initials. */
function eClara(cor: string) {
  const hex = /^#?([0-9a-f]{6})$/i.exec(cor)?.[1];
  if (!hex) return false;
  const [r, g, b] = [0, 2, 4].map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

function Avatar({ entrada, tamanho, destaque }: { entrada: EntradaRanking; tamanho: number; destaque?: boolean }) {
  const eTu = entrada.id === ID_UTILIZADOR;
  const cor = eTu ? Colors.accent : (obterClube(entrada.clubeId)?.cores.primaria ?? Colors.textSecondary);
  return (
    <View
      style={[
        styles.avatar,
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor },
        destaque && styles.avatarDestaque,
      ]}>
      <ThemedText
        type="subtitle"
        allowFontScaling={false}
        style={{
          fontSize: tamanho * 0.42,
          lineHeight: tamanho * 0.5,
          color: eClara(cor) ? Colors.text : Colors.accentText,
        }}>
        {eTu ? 'TU' : iniciais(entrada.nome)}
      </ThemedText>
    </View>
  );
}

function rotulo(entrada: EntradaRanking) {
  const eTu = entrada.id === ID_UTILIZADOR;
  return `${entrada.posicao}.º lugar, ${eTu ? 'tu' : entrada.nome}, ${entrada.tascosVerificados} tascos verificados`;
}

export function RankingCard({ ranking }: RankingCardProps) {
  const theme = useTheme();
  const primeiro = ranking.find((entrada) => entrada.posicao === 1);
  const segundo = ranking.find((entrada) => entrada.posicao === 2);
  const terceiro = ranking.find((entrada) => entrada.posicao === 3);
  // Podium order on screen: 2nd, 1st, 3rd.
  const podio = [segundo, primeiro, terceiro].filter((entrada) => entrada !== undefined);
  const resto = ranking.filter((entrada) => entrada.posicao > 3);

  return (
    <Card style={styles.card}>
      {podio.length > 0 ? (
        <View style={styles.podio}>
          {podio.map((entrada) => {
            const lugar = entrada.posicao as 1 | 2 | 3;
            const medidas = PODIO[lugar];
            const eTu = entrada.id === ID_UTILIZADOR;
            const cores = {
              1: { fundo: theme.highlight, texto: theme.highlightText, pontos: theme.warning },
              2: { fundo: theme.backgroundSelected, texto: theme.textSecondary, pontos: theme.textSecondary },
              3: { fundo: theme.successBackground, texto: theme.accentInk, pontos: theme.textSecondary },
            }[lugar];
            return (
              <View key={entrada.id} accessible accessibilityLabel={rotulo(entrada)} style={styles.degrau}>
                <Avatar entrada={entrada} tamanho={medidas.avatar} destaque={lugar === 1} />
                <ThemedText style={styles.nomePodio} numberOfLines={2}>
                  {eTu ? 'Tu' : entrada.nome}
                </ThemedText>
                <ThemedText type="score" style={[styles.pontosPodio, { color: cores.pontos }]}>
                  {entrada.tascosVerificados}
                </ThemedText>
                <View style={[styles.bloco, { height: medidas.altura, backgroundColor: cores.fundo }]}>
                  {lugar === 1 ? <Riscas /> : null}
                  <ThemedText
                    type="score"
                    style={{ fontSize: medidas.numero, lineHeight: medidas.numero * 1.1, color: cores.texto }}>
                    {lugar}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {resto.length > 0 ? (
        <View style={styles.lista}>
          {resto.map((entrada) => {
            const eTu = entrada.id === ID_UTILIZADOR;
            return (
              <View
                key={entrada.id}
                accessible
                accessibilityLabel={rotulo(entrada)}
                style={[styles.linha, eTu && { backgroundColor: theme.warningBackground }]}>
                <ThemedText
                  type="score"
                  style={[styles.posicao, { color: eTu ? theme.warning : theme.textMuted }]}>
                  {entrada.posicao}
                </ThemedText>
                <Avatar entrada={entrada} tamanho={34} />
                <ThemedText style={[styles.nome, eTu && styles.nomeTu]} numberOfLines={1}>
                  {eTu ? 'Tu' : entrada.nome}
                </ThemedText>
                <ThemedText type="score" style={styles.pontos}>
                  {entrada.tascosVerificados}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.nota}>
        Ranking de demo: os outros adeptos são fictícios.
      </ThemedText>
    </Card>
  );
}

/** Two-tone yellow stripes on the winner's block. */
function Riscas() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.riscas]} pointerEvents="none">
      {Array.from({ length: 12 }, (_, indice) => (
        <View key={indice} style={[styles.risca, { left: indice * 20 - 60 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    paddingTop: 18,
    paddingBottom: Spacing.three,
  },
  podio: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  degrau: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDestaque: {
    boxShadow: `0 0 0 3px ${Colors.highlight}`,
  },
  nomePodio: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 800,
    textAlign: 'center',
  },
  pontosPodio: {
    fontSize: 18,
    lineHeight: 20,
  },
  bloco: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderTopLeftRadius: Radius.field,
    borderTopRightRadius: Radius.field,
  },
  riscas: {
    overflow: 'hidden',
  },
  risca: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 10,
    backgroundColor: '#FFD95F',
    transform: [{ rotate: '45deg' }],
  },
  lista: {
    gap: Spacing.one,
    paddingTop: 6,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  posicao: {
    width: 22,
    fontSize: 20,
    lineHeight: 22,
  },
  nome: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 700,
  },
  nomeTu: {
    fontWeight: 800,
  },
  pontos: {
    fontSize: 22,
    lineHeight: 24,
  },
  nota: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: Spacing.one,
  },
});
