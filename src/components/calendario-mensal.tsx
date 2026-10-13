import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  agruparPorChaveDoDia,
  compararMeses,
  mesDaChave,
  mesEmLisboa,
  type MesDoCalendario,
  semanasDoMes,
  somarMeses,
  tituloDoMes,
} from '@/lib/calendario-mes';
import { chaveDoDia, formatarDiaComSemana } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { vibrarSelecao } from '@/lib/vibrar';
import type { Jogo } from '@/mocks/tipos';
import { Icon, type IconName, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

const DIAS_DA_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const NOMES_DOS_DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
/** Dots under a day; more games show as «+N». */
const MAX_PONTOS = 3;

type CalendarioMensalProps = {
  /** The games to place, already filtered (competition, clubs) and sorted by kick-off. */
  jogos: readonly Jogo[];
  agora: number;
  renderJogo: (jogo: Jogo) => ReactNode;
  /** The games the user said they are going to (or went to): green dots; every other game is red. */
  vou: (jogoId: string) => boolean;
};

/** The first day of `mes` with games, if any. */
function primeiroDiaComJogos(mes: MesDoCalendario, dias: ReadonlyMap<string, unknown>) {
  return semanasDoMes(mes)
    .flat()
    .find((dia) => dia.doMes && dias.has(dia.chave))?.chave;
}

/**
 * The whole calendar as a month grid (Monday to Sunday): a dot per game, green when the user is going, red otherwise.
 * Tapping a day shows its games under the grid.
 */
export function CalendarioMensal({ jogos, agora, renderJogo, vou }: CalendarioMensalProps) {
  const theme = useTheme();
  const porDia = agruparPorChaveDoDia(jogos);
  const hoje = chaveDoDia(new Date(agora));
  const mesDeHoje = mesEmLisboa(new Date(agora));
  const ultimo = jogos.at(-1);
  const mesMaximo = ultimo ? mesEmLisboa(new Date(ultimo.inicio)) : mesDeHoje;

  const [mes, setMes] = useState<MesDoCalendario>(() =>
    primeiroDiaComJogos(mesDeHoje, porDia) || !jogos[0] ? mesDeHoje : mesEmLisboa(new Date(jogos[0].inicio))
  );
  const [escolhido, setEscolhido] = useState<string | null>(() =>
    porDia.has(hoje) ? hoje : (primeiroDiaComJogos(mes, porDia) ?? null)
  );

  const podeRecuar = compararMeses(mes, mesDeHoje) > 0;
  const podeAvancar = compararMeses(mes, mesMaximo) < 0;

  function mudarMes(quantos: number) {
    const novo = somarMeses(mes, quantos);
    vibrarSelecao();
    setMes(novo);
    setEscolhido(primeiroDiaComJogos(novo, porDia) ?? null);
  }

  // The chosen day may have left the list (a filter changed): show nothing rather than a stale day.
  const jogosDoDia = escolhido && compararMeses(mesDaChave(escolhido), mes) === 0 ? (porDia.get(escolhido) ?? []) : [];

  return (
    <View style={styles.bloco}>
      <View style={[styles.cartao, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.topo}>
          <BotaoMes icone={icons.voltar} rotulo="Mês anterior" ativo={podeRecuar} onPress={() => mudarMes(-1)} />
          <ThemedText type="section" style={styles.titulo} accessibilityRole="header" accessibilityLiveRegion="polite">
            {tituloDoMes(mes)}
          </ThemedText>
          <BotaoMes icone={icons.seguinte} rotulo="Mês seguinte" ativo={podeAvancar} onPress={() => mudarMes(1)} />
        </View>

        <View style={styles.semana} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {DIAS_DA_SEMANA.map((letra, indice) => (
            <ThemedText key={indice} type="smallBold" themeColor="textMuted" style={styles.letra}>
              {letra}
            </ThemedText>
          ))}
        </View>

        {semanasDoMes(mes).map((semana) => (
          <View key={semana[0].chave} style={styles.semana}>
            {semana.map((dia, indice) => {
              const doDia = dia.doMes ? (porDia.get(dia.chave) ?? []) : [];
              const temJogos = doDia.length > 0;
              const ativo = dia.chave === escolhido && temJogos;
              const eHoje = dia.chave === hoje;
              const passado = dia.chave < hoje;
              return (
                <Pressable
                  key={dia.chave}
                  disabled={!temJogos}
                  onPress={() => {
                    if (!ativo) vibrarSelecao();
                    setEscolhido(dia.chave);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo, disabled: !temJogos }}
                  accessibilityLabel={
                    dia.doMes
                      ? `${NOMES_DOS_DIAS[indice]}, ${dia.dia}${eHoje ? ', hoje' : ''}, ${
                          temJogos
                            ? `${plural(doDia.length, 'jogo', 'jogos')}${doDia.some((jogo) => vou(jogo.id)) ? ', vais' : ''}`
                            : 'sem jogos'
                        }`
                      : undefined
                  }
                  accessibilityElementsHidden={!dia.doMes}
                  style={({ pressed }) => [styles.dia, pressed && temJogos && styles.premido]}>
                  <View
                    style={[
                      styles.numero,
                      eHoje && !ativo && { borderColor: theme.accent, borderWidth: 2 },
                      ativo && { backgroundColor: theme.accent },
                    ]}>
                    <ThemedText
                      type={temJogos ? 'smallBold' : 'small'}
                      style={[
                        styles.numeroTexto,
                        {
                          color: ativo
                            ? theme.accentText
                            : !dia.doMes
                              ? 'transparent'
                              : temJogos && !passado
                                ? theme.text
                                : theme.textMuted,
                        },
                      ]}>
                      {dia.dia}
                    </ThemedText>
                  </View>
                  <View style={styles.pontos}>
                    {doDia.slice(0, MAX_PONTOS).map((jogo) => (
                      <View
                        key={jogo.id}
                        style={[styles.ponto, { backgroundColor: vou(jogo.id) ? theme.success : theme.danger }]}
                      />
                    ))}
                    {doDia.length > MAX_PONTOS ? (
                      <ThemedText style={[styles.mais, { color: theme.textMuted }]}>
                        +{doDia.length - MAX_PONTOS}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.legenda} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.legendaItem}>
            <View style={[styles.ponto, { backgroundColor: theme.success }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Vais
            </ThemedText>
          </View>
          <View style={styles.legendaItem}>
            <View style={[styles.ponto, { backgroundColor: theme.danger }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Ainda não marcaste
            </ThemedText>
          </View>
        </View>
      </View>

      {jogosDoDia.length > 0 && escolhido ? (
        <View style={styles.doDia}>
          <View style={styles.cabecalhoDia} accessibilityRole="header">
            <ThemedText type="section" style={styles.tituloDia} numberOfLines={1}>
              {formatarDiaComSemana(new Date(jogosDoDia[0].inicio), agora)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.totalDia}>
              {plural(jogosDoDia.length, 'jogo', 'jogos')}
            </ThemedText>
          </View>
          {jogosDoDia.map(renderJogo)}
        </View>
      ) : (
        <ThemedText themeColor="textSecondary" style={styles.semJogos}>
          Sem jogos em{' '}
          {tituloDoMes(mes)
            .replace(/ de \d+$/, '')
            .toLowerCase()}
          .
        </ThemedText>
      )}
    </View>
  );
}

function BotaoMes({
  icone,
  rotulo,
  ativo,
  onPress,
}: {
  icone: IconName;
  rotulo: string;
  ativo: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!ativo}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !ativo }}
      style={({ pressed }) => [
        styles.botaoMes,
        { backgroundColor: theme.backgroundSelected, opacity: ativo ? 1 : 0.35 },
        pressed && styles.premido,
      ]}>
      <Icon name={icone} size={18} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.three,
  },
  cartao: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  titulo: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 28,
  },
  botaoMes: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  semana: {
    flexDirection: 'row',
  },
  letra: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
  dia: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  numero: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderColor: 'transparent',
  },
  numeroTexto: {
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  pontos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 8,
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mais: {
    fontSize: 9,
    lineHeight: 10,
    fontWeight: 800,
  },
  premido: {
    opacity: 0.6,
  },
  legenda: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  legendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  doDia: {
    gap: Spacing.two,
  },
  cabecalhoDia: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  tituloDia: {
    flexShrink: 1,
  },
  totalDia: {
    fontSize: 14,
    fontWeight: 600,
  },
  semJogos: {
    textAlign: 'center',
  },
});
