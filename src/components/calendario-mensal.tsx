import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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

type CalendarioDeJogosProps = {
  /** The games to place, already filtered (competition, clubs) and sorted by kick-off. */
  jogos: readonly Jogo[];
  agora: number;
  renderJogo: (jogo: Jogo) => ReactNode;
  /** The games the user said they are going to (or went to): green dots; every other game is red. */
  vou: (jogoId: string) => boolean;
};

type CalendarioMensalProps = Omit<CalendarioDeJogosProps, 'renderJogo'> & {
  escolhido: string | null;
  onEscolher: (chave: string) => void;
};

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * The games page's calendar: a strip with only the days that have games (a dot each, green when going), the chosen
 * day's games under it, and the whole month a tap away. The month grid on its own took the whole first screen.
 */
export function CalendarioDeJogos({ jogos, agora, renderJogo, vou }: CalendarioDeJogosProps) {
  const theme = useTheme();
  const porDia = agruparPorChaveDoDia(jogos);
  const dias = [...porDia.keys()];
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [verMes, setVerMes] = useState(false);
  // The next day with games until the fan picks one (or when the picked one left the list, after a filter).
  const dia = escolhido && porDia.has(escolhido) ? escolhido : (dias[0] ?? null);
  const jogosDoDia = dia ? (porDia.get(dia) ?? []) : [];

  return (
    <View style={styles.bloco}>
      <View style={styles.faixaComBotao}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          style={styles.faixa}
          contentContainerStyle={styles.faixaConteudo}>
          {dias.map((chave) => {
            const [ano, mes, numero] = chave.split('-').map(Number);
            const semana = new Date(Date.UTC(ano, mes - 1, numero)).getUTCDay();
            const doDia = porDia.get(chave) ?? [];
            const ativo = chave === dia;
            const vais = doDia.some((jogo) => vou(jogo.id));
            return (
              <Pressable
                key={chave}
                onPress={() => {
                  if (!ativo) vibrarSelecao();
                  setEscolhido(chave);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={`${DIAS_CURTOS[semana]} ${numero} de ${MESES_CURTOS[mes - 1]}, ${plural(doDia.length, 'jogo', 'jogos')}${vais ? ', vais' : ''}`}
                style={({ pressed }) => [
                  styles.chipDia,
                  { backgroundColor: ativo ? theme.accent : theme.backgroundElement },
                  pressed && styles.premido,
                ]}>
                <ThemedText style={[styles.chipSemana, { color: ativo ? theme.accentText : theme.textSecondary }]}>
                  {DIAS_CURTOS[semana]}
                </ThemedText>
                <ThemedText style={[styles.chipNumero, { color: ativo ? theme.accentText : theme.text }]}>
                  {numero}
                </ThemedText>
                <ThemedText style={[styles.chipMes, { color: ativo ? theme.accentText : theme.textMuted }]}>
                  {MESES_CURTOS[mes - 1]}
                </ThemedText>
                <View
                  style={[
                    styles.ponto,
                    { backgroundColor: vais ? theme.success : theme.danger },
                    ativo && { borderWidth: 1, borderColor: theme.accentText },
                  ]}
                />
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          onPress={() => setVerMes((aberto) => !aberto)}
          accessibilityRole="button"
          accessibilityState={{ expanded: verMes }}
          accessibilityLabel={verMes ? 'Fechar o calendário do mês' : 'Ver o calendário do mês'}
          style={({ pressed }) => [
            styles.botaoCalendario,
            { backgroundColor: verMes ? theme.accent : theme.backgroundElement },
            pressed && styles.premido,
          ]}>
          <Icon name={verMes ? icons.fechar : icons.calendario} size={20} color={verMes ? theme.accentText : theme.text} />
        </Pressable>
      </View>

      {verMes ? (
        <CalendarioMensal
          jogos={jogos}
          agora={agora}
          vou={vou}
          escolhido={dia}
          onEscolher={(chave) => {
            setEscolhido(chave);
            setVerMes(false);
          }}
        />
      ) : null}

      {dia && jogosDoDia.length > 0 ? (
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
      ) : null}
    </View>
  );
}

/** The first day of `mes` with games, if any. */
function primeiroDiaComJogos(mes: MesDoCalendario, dias: ReadonlyMap<string, unknown>) {
  return semanasDoMes(mes)
    .flat()
    .find((dia) => dia.doMes && dias.has(dia.chave))?.chave;
}

/**
 * The month grid (Monday to Sunday), opened from the strip: a dot per game, green when the user is going, red
 * otherwise. Picking a day hands it back to the strip.
 */
function CalendarioMensal({ jogos, agora, vou, escolhido, onEscolher }: CalendarioMensalProps) {
  const theme = useTheme();
  const porDia = agruparPorChaveDoDia(jogos);
  const hoje = chaveDoDia(new Date(agora));
  const mesDeHoje = mesEmLisboa(new Date(agora));
  const ultimo = jogos.at(-1);
  const mesMaximo = ultimo ? mesEmLisboa(new Date(ultimo.inicio)) : mesDeHoje;

  const [mes, setMes] = useState<MesDoCalendario>(() =>
    escolhido
      ? mesDaChave(escolhido)
      : primeiroDiaComJogos(mesDeHoje, porDia) || !jogos[0]
        ? mesDeHoje
        : mesEmLisboa(new Date(jogos[0].inicio))
  );

  const podeRecuar = compararMeses(mes, mesDeHoje) > 0;
  const podeAvancar = compararMeses(mes, mesMaximo) < 0;

  function mudarMes(quantos: number) {
    const novo = somarMeses(mes, quantos);
    vibrarSelecao();
    setMes(novo);
  }

  return (
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
                    onEscolher(dia.chave);
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
  faixaComBotao: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  faixa: {
    flex: 1,
    marginLeft: -20,
  },
  faixaConteudo: {
    gap: Spacing.two,
    paddingLeft: 20,
    paddingRight: Spacing.one,
  },
  chipDia: {
    width: 58,
    alignItems: 'center',
    gap: 1,
    paddingTop: 8,
    paddingBottom: 9,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  chipSemana: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: 700,
  },
  chipNumero: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  chipMes: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: 600,
    marginBottom: 4,
  },
  botaoCalendario: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderCurve: 'continuous',
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
