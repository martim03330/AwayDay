import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Citacao, Emoji, Reacao } from '@/lib/conversa';
import { formatarHora } from '@/lib/datas';
import {
  inserirMencao,
  mencaoAEscrever,
  partesComMencoes,
  sugestoesDeMencao,
  TODOS,
  type Mencionavel,
} from '@/lib/mencoes';
import { vibrarLeve } from '@/lib/vibrar';
import { Avatar } from '@/ui/avatar';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

// As peças de uma conversa, iguais em todo o lado: a do grupo e a do carro.

/** A data a meio da conversa («Hoje», «Ontem»). Por cima de um fundo escuro, a pastilha fica clara. */
export function PastilhaDeConversa({ texto, escuro = false }: { texto: string; escuro?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.pastilha,
        { backgroundColor: escuro ? 'rgba(255,255,255,0.85)' : theme.backgroundElement },
      ]}>
      <ThemedText type="small" style={{ color: escuro ? '#13241B' : theme.textSecondary }}>
        {texto}
      </ThemedText>
    </View>
  );
}

/**
 * A notice from the app in the middle of the conversation (a plan sent to another group, or taken back): centred,
 * with an info icon, in full — it is not a person's message.
 */
export function AvisoDeConversa({
  texto,
  escuro = false,
  onLongPress,
}: {
  texto: string;
  escuro?: boolean;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  const cor = escuro ? '#13241B' : theme.textSecondary;
  return (
    <Pressable
      onLongPress={onLongPress}
      accessibilityRole="text"
      accessibilityLabel={`Aviso: ${texto}`}
      style={[
        styles.aviso,
        { backgroundColor: escuro ? 'rgba(255,255,255,0.9)' : theme.backgroundElement, borderColor: theme.border },
      ]}>
      <Icon name={icons.aviso} size={16} color={cor} />
      <ThemedText type="small" style={[styles.avisoTexto, { color: cor }]}>
        {texto}
      </ThemedText>
    </Pressable>
  );
}

type BolhaProps = {
  nome: string;
  texto: string;
  /** ISO: a hora aparece no canto da bolha. */
  criadaEm: string;
  minha: boolean;
  /** A primeira de uma série da mesma pessoa leva a cara e o nome; as seguintes vão coladas. */
  mostrarQuem: boolean;
  fotoUrl?: string | null;
  /** A mensagem a que esta responde. */
  citacao?: Citacao | null;
  editada?: boolean;
  /** Still on its way to the server: shows at once, a little faded, with «a enviar…» instead of the time. */
  pendente?: boolean;
  /** The names in this chat: «@Nome» (and «@todos») in the text are drawn in bold. */
  nomesMencionaveis?: readonly string[];
  /** It mentions you (by name or with @todos): the bubble gets a mark on the side. */
  mencionaMe?: boolean;
  reacoes?: readonly Reacao[];
  /** Tocar numa reação: põe ou tira a tua com esse emoji. */
  onReagir?: (emoji: Emoji) => void;
  /** Deslizar a bolha para a direita, como no WhatsApp. */
  onResponder?: () => void;
  /** Tocar na cara ou no nome de quem escreveu. */
  onAbrirPessoa?: () => void;
  onLongPress?: () => void;
};

/** How far the bubble has to go for a swipe to become a reply, and how far it can go at most. */
const GATILHO_RESPOSTA_PX = 56;
const MAXIMO_RESPOSTA_PX = 80;

/** Uma mensagem: verde e à direita se é tua, branca e à esquerda com a cara de quem a escreveu. */
export function BolhaDeConversa({
  nome,
  texto,
  criadaEm,
  minha,
  mostrarQuem,
  fotoUrl,
  citacao,
  editada = false,
  pendente = false,
  nomesMencionaveis = [],
  mencionaMe = false,
  reacoes = [],
  onReagir,
  onResponder,
  onAbrirPessoa,
  onLongPress,
}: BolhaProps) {
  const theme = useTheme();
  const reduzirMovimento = useReducedMotion();
  const deslocamento = useSharedValue(0);
  const passouOGatilho = useSharedValue(false);

  const deslizar = Gesture.Pan()
    .runOnJS(true)
    .enabled(onResponder !== undefined)
    // Only to the right, and only a clearly sideways move: scrolling the chat stays easy.
    .activeOffsetX(16)
    .failOffsetY([-12, 12])
    .onUpdate((evento) => {
      const x = Math.min(Math.max(evento.translationX, 0), MAXIMO_RESPOSTA_PX);
      deslocamento.set(reduzirMovimento ? 0 : x);
      const passou = x >= GATILHO_RESPOSTA_PX;
      if (passou && !passouOGatilho.get()) vibrarLeve();
      passouOGatilho.set(passou);
    })
    .onEnd(() => {
      if (passouOGatilho.get()) onResponder?.();
      passouOGatilho.set(false);
      deslocamento.set(reduzirMovimento ? 0 : withTiming(0, { duration: 180 }));
    });

  const movimento = useAnimatedStyle(() => ({ transform: [{ translateX: deslocamento.get() }] }));
  const setaDeResposta = useAnimatedStyle(() => ({
    opacity: interpolate(deslocamento.get(), [0, GATILHO_RESPOSTA_PX], [0, 1], 'clamp'),
  }));

  const corDoTexto = minha ? theme.accentText : theme.text;

  return (
    <GestureDetector gesture={deslizar}>
      <View>
        <Animated.View style={[styles.setaResposta, setaDeResposta]} pointerEvents="none">
          <Icon name={icons.responder} size={20} color={theme.textSecondary} />
        </Animated.View>
        <Animated.View style={[styles.linha, minha ? styles.direita : styles.esquerda, movimento]}>
          {!minha ? (
            <Pressable
              style={styles.lugarAvatar}
              onPress={mostrarQuem ? onAbrirPessoa : undefined}
              disabled={!mostrarQuem || !onAbrirPessoa}
              accessibilityRole="button"
              accessibilityLabel={`Ver o perfil de ${nome}`}
              accessibilityElementsHidden={!mostrarQuem}>
              {mostrarQuem ? <Avatar nome={nome} url={fotoUrl} size={30} /> : null}
            </Pressable>
          ) : null}
          <View style={[styles.coluna, minha ? styles.colunaDireita : styles.colunaEsquerda]}>
            <Pressable
              onLongPress={
                onLongPress
                  ? () => {
                      vibrarLeve();
                      onLongPress();
                    }
                  : undefined
              }
              delayLongPress={300}
              accessibilityHint={
                onLongPress ? 'Toca sem largar para reagir, responder e mais opções.' : undefined
              }
              style={[
                styles.bolha,
                minha
                  ? { backgroundColor: theme.accent, borderBottomRightRadius: 6 }
                  : { backgroundColor: theme.backgroundElement, borderBottomLeftRadius: 6 },
                !mostrarQuem && styles.seguida,
                pendente && styles.pendente,
                mencionaMe && !minha && { borderLeftWidth: 3, borderLeftColor: theme.highlight },
              ]}>
              {!minha && mostrarQuem ? (
                <Pressable onPress={onAbrirPessoa} disabled={!onAbrirPessoa} hitSlop={6}>
                  <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                    {nome}
                  </ThemedText>
                </Pressable>
              ) : null}
              {citacao ? <CitacaoNaBolha citacao={citacao} minha={minha} /> : null}
              <ThemedText style={{ color: corDoTexto }}>
                {partesComMencoes(texto, nomesMencionaveis).map((parte, indice) =>
                  parte.mencao ? (
                    <ThemedText
                      key={indice}
                      style={[styles.mencao, { color: minha ? theme.accentText : theme.accentInk }]}>
                      {parte.texto}
                    </ThemedText>
                  ) : (
                    parte.texto
                  )
                )}
              </ThemedText>
              <ThemedText
                type="small"
                style={[styles.hora, { color: minha ? theme.accentText : theme.textMuted }]}>
                {pendente
                  ? 'a enviar…'
                  : editada
                    ? `editada · ${formatarHora(new Date(criadaEm))}`
                    : formatarHora(new Date(criadaEm))}
              </ThemedText>
            </Pressable>
            {reacoes.length > 0 ? (
              <ReacoesDaMensagem reacoes={reacoes} onReagir={onReagir} minha={minha} />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** The quoted message at the top of a reply, with a bar on the side like WhatsApp. */
function CitacaoNaBolha({ citacao, minha }: { citacao: Citacao; minha: boolean }) {
  const theme = useTheme();
  const cor = minha ? theme.accentText : theme.accentInk;
  return (
    <View
      style={[
        styles.citacao,
        {
          borderLeftColor: cor,
          backgroundColor: minha ? 'rgba(255,255,255,0.16)' : theme.backgroundSelected,
        },
      ]}>
      <ThemedText type="smallBold" numberOfLines={1} style={{ color: cor }}>
        {citacao.displayName ?? 'Um adepto'}
      </ThemedText>
      <ThemedText
        type="small"
        numberOfLines={2}
        style={{ color: minha ? theme.accentText : theme.textSecondary, opacity: citacao.body ? 1 : 0.7 }}>
        {citacao.body ?? 'Mensagem indisponível'}
      </ThemedText>
    </View>
  );
}

/** The reactions under a bubble: each emoji with how many, yours highlighted. Tapping one puts or takes yours. */
function ReacoesDaMensagem({
  reacoes,
  onReagir,
  minha,
}: {
  reacoes: readonly Reacao[];
  onReagir?: (emoji: Emoji) => void;
  minha: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.reacoes, minha ? styles.reacoesDireita : null]}>
      {reacoes.map((reacao) => (
        <Pressable
          key={reacao.emoji}
          onPress={onReagir ? () => onReagir(reacao.emoji) : undefined}
          disabled={!onReagir}
          accessibilityRole="button"
          accessibilityLabel={`${reacao.emoji} ${reacao.count}${reacao.mine ? ', a tua' : ''}`}
          style={[
            styles.reacao,
            {
              backgroundColor: reacao.mine ? theme.successBackground : theme.backgroundElement,
              borderColor: reacao.mine ? theme.accent : theme.border,
            },
          ]}>
          <ThemedText type="small">{reacao.emoji}</ThemedText>
          {reacao.count > 1 ? (
            <ThemedText type="smallBold" themeColor="textSecondary">
              {reacao.count}
            </ThemedText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

type CaixaDeEscritaProps = {
  valor: string;
  onChange: (texto: string) => void;
  onEnviar: () => void;
  aEnviar: boolean;
  placeholder: string;
  accessibilityLabel: string;
  /** A responder a uma mensagem, ou a editar uma tua: aparece por cima da caixa, com um × para desistir. */
  contexto?: { titulo: string; texto: string; onCancelar: () => void } | null;
  /** Quem se pode mencionar: ao escrever «@» aparece a lista (com @todos primeiro). */
  mencionaveis?: readonly Mencionavel[];
};

/** A caixa de escrever e o botão de enviar, no fundo da conversa. */
export function CaixaDeEscrita({
  valor,
  onChange,
  onEnviar,
  aEnviar,
  placeholder,
  accessibilityLabel,
  contexto,
  mencionaveis,
}: CaixaDeEscritaProps) {
  const theme = useTheme();
  const vazio = valor.trim().length === 0;
  const caixa = useRef<TextInput>(null);
  const tituloDoContexto = contexto?.titulo ?? null;

  // Choosing «Responder» or «Editar» opens the keyboard, ready to write.
  useEffect(() => {
    if (tituloDoContexto) caixa.current?.focus();
  }, [tituloDoContexto]);

  return (
    <View style={styles.escreverTudo}>
      {mencionaveis ? (
        <SugestoesDeMencao valor={valor} pessoas={mencionaveis} onEscolher={onChange} />
      ) : null}
      {contexto ? (
        <View style={[styles.contexto, { borderLeftColor: theme.accent, backgroundColor: theme.background }]}>
          <View style={styles.contextoTexto}>
            <ThemedText type="smallBold" themeColor="accentInk" numberOfLines={1}>
              {contexto.titulo}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {contexto.texto}
            </ThemedText>
          </View>
          <Pressable
            onPress={contexto.onCancelar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancelar">
            <Icon name={icons.fechar} size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}
    <View style={styles.escrever}>
      <TextInput
        ref={caixa}
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        multiline
        maxLength={500}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.caixa,
          { backgroundColor: theme.background, borderColor: theme.border, color: theme.text },
        ]}
      />
      <Pressable
        onPress={onEnviar}
        disabled={aEnviar || vazio}
        accessibilityRole="button"
        accessibilityLabel="Enviar"
        style={({ pressed }) => [
          styles.enviar,
          {
            backgroundColor: pressed ? theme.accentPressed : theme.accent,
            opacity: aEnviar || vazio ? 0.45 : 1,
          },
        ]}>
        <Icon name={icons.enviar} size={19} color={theme.accentText} />
      </Pressable>
    </View>
    </View>
  );
}

/** While a «@...» is being typed: who it can be, @todos first. Tapping one writes the full name. */
function SugestoesDeMencao({
  valor,
  pessoas,
  onEscolher,
}: {
  valor: string;
  pessoas: readonly Mencionavel[];
  onEscolher: (texto: string) => void;
}) {
  const theme = useTheme();
  const consulta = mencaoAEscrever(valor);
  if (consulta === null) return null;
  const sugestoes = sugestoesDeMencao(consulta, pessoas);
  if (!sugestoes.todos && sugestoes.pessoas.length === 0) return null;

  const linha = (chave: string, nome: string, detalhe: string | null, cara: ReactNode) => (
    <Pressable
      key={chave}
      onPress={() => onEscolher(inserirMencao(valor, nome))}
      accessibilityRole="button"
      accessibilityLabel={`Mencionar ${nome}`}
      style={({ pressed }) => [styles.sugestao, pressed && { backgroundColor: theme.backgroundSelected }]}>
      {cara}
      <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
        {`@${nome}`}
      </ThemedText>
      {detalhe ? (
        <ThemedText type="small" themeColor="textSecondary">
          {detalhe}
        </ThemedText>
      ) : null}
    </Pressable>
  );

  return (
    <View
      style={[styles.sugestoes, { backgroundColor: theme.background, borderColor: theme.border }]}
      accessibilityRole="menu">
      {sugestoes.todos
        ? linha(
            TODOS,
            TODOS,
            'toda a gente',
            <View style={[styles.caraTodos, { backgroundColor: theme.accent }]}>
              <Icon name={icons.malta} size={16} color={theme.accentText} />
            </View>
          )
        : null}
      {sugestoes.pessoas.map((pessoa) =>
        linha(pessoa.profileId, pessoa.nome, null, <Avatar nome={pessoa.nome} url={pessoa.fotoUrl} size={28} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mencao: {
    fontWeight: 700,
  },
  sugestoes: {
    borderWidth: 1,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
    paddingVertical: Spacing.one,
  },
  sugestao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  caraTodos: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  aviso: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
    maxWidth: '88%',
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.two,
    borderRadius: Radius.field,
    borderWidth: 1,
    marginVertical: Spacing.two,
  },
  avisoTexto: {
    flexShrink: 1,
    textAlign: 'center',
  },
  pastilha: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    marginVertical: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  esquerda: {
    justifyContent: 'flex-start',
    paddingRight: Spacing.six,
  },
  direita: {
    justifyContent: 'flex-end',
    paddingLeft: Spacing.six,
  },
  lugarAvatar: {
    width: 30,
  },
  bolha: {
    flexShrink: 1,
    paddingHorizontal: Spacing.twoAndHalf,
    paddingVertical: Spacing.two,
    borderRadius: 18,
    borderCurve: 'continuous',
    gap: 2,
    marginTop: Spacing.one,
  },
  seguida: {
    marginTop: 0,
  },
  pendente: {
    opacity: 0.7,
  },
  hora: {
    alignSelf: 'flex-end',
    fontSize: 11,
    opacity: 0.75,
  },
  setaResposta: {
    position: 'absolute',
    left: Spacing.one,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  coluna: {
    flexShrink: 1,
  },
  colunaEsquerda: {
    alignItems: 'flex-start',
  },
  colunaDireita: {
    alignItems: 'flex-end',
  },
  citacao: {
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginBottom: 2,
  },
  reacoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: -4,
    paddingHorizontal: Spacing.two,
  },
  reacoesDireita: {
    justifyContent: 'flex-end',
  },
  reacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  escreverTudo: {
    gap: Spacing.two,
  },
  contexto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  contextoTexto: {
    flex: 1,
  },
  escrever: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  caixa: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    fontFamily: fontFamily('body', 500),
  },
  enviar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
