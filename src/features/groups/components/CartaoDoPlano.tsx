import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { avisoDoPlanoFechado, faseDoPlano } from '@/features/groups/fase-do-plano';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import {
  answerPlan,
  PlanRefused,
  type FixturePlan,
  type PlanAnswer,
} from '@/features/groups/plans';
import { plansKey } from '@/features/groups/hooks/useGroups';
import { conviteDoCartao, origemDoPlano } from '@/features/groups/partilha';
import { useRealNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDia, formatarHora } from '@/lib/datas';
import { plural } from '@/lib/formatos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

/** "sábado, 19 de setembro · 18:00", ou "hora por definir" enquanto a liga não marca a hora. */
export function quandoEOnde(plano: Pick<FixturePlan, 'fixtureId' | 'kickoffAt'>) {
  const jogo = obterJogo(plano.fixtureId);
  const inicio = new Date(jogo?.inicio ?? plano.kickoffAt);
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  return [
    formatarDia(inicio),
    jogo && !jogo.horaConfirmada ? 'hora por definir' : formatarHora(inicio),
    estadio?.nome,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Benfica x Porto", com os nomes da app. */
export function nomeDoJogo(fixtureId: string, reserva = 'Jogo') {
  const jogo = obterJogo(fixtureId);
  if (!jogo) return reserva;
  return `${obterClube(jogo.casaId)?.nomeCurto ?? ''} x ${obterClube(jogo.foraId)?.nomeCurto ?? ''}`;
}

/** "3 vão · 1 não vai". */
export function respostas(plano: Pick<FixturePlan, 'going' | 'notGoing'>) {
  const partes = [
    plano.going > 0 ? `${plano.going} ${plano.going === 1 ? 'vai' : 'vão'}` : null,
    plano.notGoing > 0 ? `${plano.notGoing} não ${plano.notGoing === 1 ? 'vai' : 'vão'}` : null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : 'ainda ninguém respondeu';
}

/** O estado do plano, numa linha: fechado, carro cheio, lugares por encher. */
export function estadoDoPlano(plano: FixturePlan) {
  if (plano.status === 'fechado') {
    return plano.closedByFullCar ? 'Fechado: o carro encheu' : 'Plano fechado';
  }
  if (!plano.ride) return 'Em aberto · falta a boleia';
  const livres = Math.max(0, plano.ride.seatsOffered - plano.ride.seatsTaken);
  return `Em aberto · ${livres > 0 ? plural(livres, 'lugar livre', 'lugares livres') : 'carro cheio'}`;
}

/** O estado do plano em poucas palavras, para ir na mesma linha de quem vai. */
function estadoCurto(plano: FixturePlan) {
  if (plano.status === 'fechado') return 'fechado';
  if (!plano.ride) return 'sem boleia';
  const livres = Math.max(0, plano.ride.seatsOffered - plano.ride.seatsTaken);
  return livres > 0 ? plural(livres, 'lugar livre', 'lugares livres') : 'carro cheio';
}

/** "sábado, 19 de setembro · 18:00", sem o estádio: no cartão, o jogo já diz onde é. */
function quando(plano: Pick<FixturePlan, 'fixtureId' | 'kickoffAt'>) {
  const jogo = obterJogo(plano.fixtureId);
  const inicio = new Date(jogo?.inicio ?? plano.kickoffAt);
  return `${formatarDia(inicio)} · ${jogo && !jogo.horaConfirmada ? 'hora por definir' : formatarHora(inicio)}`;
}

type CartaoDoPlanoProps = {
  plano: FixturePlan;
  /** Quem mandou o convite para esta conversa (pode não ser quem criou o plano). `'eu'` quando foste tu. */
  quemConvidou?: string;
  /** Por cima de um fundo escuro, o cartão ganha contorno. */
  escuro?: boolean;
  /** O grupo onde o cartão aparece: se o plano for de outro grupo, o cartão diz de qual. */
  grupoAtualId?: string | null;
  /** Já vais a este jogo com outro grupo (plano fechado lá): aqui não dá para dizer que vais. */
  vaisComOutroGrupo?: string | null;
  onAbrir: () => void;
  onRespondido?: () => void;
  /** O que acontece ao tocar, para o leitor de ecrã. Por omissão, abre o plano. */
  dicaAoTocar?: string;
};

/**
 * O convite para um jogo, como aparece na conversa do grupo e nos planos: o essencial (o jogo, o dia, quem vai) e
 * a resposta. O resto está a um toque, no plano.
 */
export function CartaoDoPlano({
  plano,
  quemConvidou,
  escuro = false,
  grupoAtualId = null,
  vaisComOutroGrupo = null,
  onAbrir,
  onRespondido,
  dicaAoTocar = 'Toca para abrir o plano.',
}: CartaoDoPlanoProps) {
  const theme = useTheme();
  const jogo = obterJogo(plano.fixtureId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const [aResponder, setAResponder] = useState<PlanAnswer | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // From kick-off the plan is a record: no answer buttons (the server refuses them too).
  const agora = useRealNow(60 * 1000);
  const fase = faseDoPlano(plano, agora);
  const aberto = plano.status === 'aberto' && fase === 'antes';
  const convite = conviteDoCartao(quemConvidou, plano, grupoAtualId);
  const origem = origemDoPlano(plano, grupoAtualId);

  /**
   * Optimistic: the answer and the counts change now in every cached list of plans (the chat cards and the group's
   * plans). Returns what was there before, to put back if the server refuses.
   */
  async function mostrarResposta(nova: PlanAnswer | null) {
    const filtro = {
      queryKey: plansKey(),
      predicate: (query: { queryKey: QueryKey }) =>
        query.queryKey[2] === 'by-id' || query.queryKey[2] === 'group',
    };
    await queryClient.cancelQueries(filtro);
    const anteriores = queryClient.getQueriesData<FixturePlan[]>(filtro);
    queryClient.setQueriesData<FixturePlan[]>(filtro, (lista) =>
      lista?.map((p) =>
        p.id === plano.id
          ? {
              ...p,
              myAnswer: nova,
              going: Math.max(0, p.going + (nova === 'vou' ? 1 : 0) - (p.myAnswer === 'vou' ? 1 : 0)),
              notGoing: Math.max(0, p.notGoing + (nova === 'nao' ? 1 : 0) - (p.myAnswer === 'nao' ? 1 : 0)),
            }
          : p
      )
    );
    return anteriores;
  }

  async function responder(resposta: PlanAnswer) {
    setErro(null);
    setAResponder(resposta);
    // Tocar outra vez na mesma resposta tira-a.
    const nova = plano.myAnswer === resposta ? null : resposta;
    const anteriores = await mostrarResposta(nova);
    try {
      await answerPlan(plano.id, nova);
      onRespondido?.();
    } catch (problema) {
      for (const [chave, dados] of anteriores) queryClient.setQueryData(chave, dados);
      setErro(
        problema instanceof PlanRefused && problema.reason === 'plan_closed'
          ? 'O plano já fechou.'
          : problema instanceof PlanRefused && problema.reason === 'fixture_over'
            ? 'O jogo já começou: o plano já não muda.'
            : problema instanceof PlanRefused && problema.reason === 'already_going'
            ? 'Já vais a este jogo com outro grupo.'
            : 'Não deu para responder. Tenta outra vez.'
      );
    } finally {
      setAResponder(null);
    }
  }

  return (
    <Pressable
      onPress={onAbrir}
      accessibilityRole="button"
      accessibilityLabel={`${convite}: ${nomeDoJogo(plano.fixtureId)}, ${quandoEOnde(plano)}. ${respostas(plano)}. ${estadoDoPlano(plano)}. ${dicaAoTocar}`}
      style={({ pressed }) => [
        styles.cartao,
        CardShadow,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: escuro ? theme.highlight : theme.border,
        },
        pressed && styles.premido,
      ]}>
      <View style={styles.topo}>
        <Icon name={icons.calendario} size={13} color={theme.accentInk} />
        <ThemedText type="eyebrow" themeColor="accentInk" numberOfLines={1} style={styles.flex}>
          {convite}
        </ThemedText>
        <Icon name={icons.seguinte} size={16} color={theme.textMuted} />
      </View>

      {origem ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {origem}
        </ThemedText>
      ) : null}

      <View style={styles.equipas}>
        {casa && fora ? (
          <View style={styles.escudos}>
            <Escudo clube={casa} size={26} />
            <Escudo clube={fora} size={26} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <ThemedText style={styles.jogo} numberOfLines={1}>
            {nomeDoJogo(plano.fixtureId)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {quando(plano)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.linha}>
        <Icon
          name={plano.status === 'fechado' ? icons.selecionado : icons.perfil}
          size={14}
          color={plano.status === 'fechado' ? theme.accentInk : theme.textSecondary}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex} numberOfLines={1}>
          {`${respostas(plano)} · ${fase === 'antes' ? estadoCurto(plano) : fase === 'a-decorrer' ? 'a decorrer' : 'jogo terminado'}`}
        </ThemedText>
      </View>

      {vaisComOutroGrupo ? (
        <ThemedText type="small" style={{ color: theme.warningText }}>
          {`Já vais a este jogo com «${vaisComOutroGrupo}».`}
        </ThemedText>
      ) : fase !== 'antes' ? (
        <ThemedText type="small" themeColor="textMuted">
          {avisoDoPlanoFechado(fase)}
        </ThemedText>
      ) : aberto ? (
        <View style={styles.botoes}>
          <BotaoResposta
            label="Vou"
            escolhido={plano.myAnswer === 'vou'}
            aTratar={aResponder === 'vou'}
            onPress={() => void responder('vou')}
          />
          <BotaoResposta
            label="Não vou"
            escolhido={plano.myAnswer === 'nao'}
            aTratar={aResponder === 'nao'}
            onPress={() => void responder('nao')}
          />
        </View>
      ) : null}
      {erro ? (
        <ThemedText type="small" style={{ color: theme.dangerText }}>
          {erro}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function BotaoResposta({
  label,
  escolhido,
  aTratar,
  onPress,
}: {
  label: string;
  escolhido: boolean;
  aTratar: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={aTratar}
      accessibilityRole="button"
      accessibilityState={{ selected: escolhido }}
      style={({ pressed }) => [
        styles.botao,
        escolhido
          ? { backgroundColor: theme.accent, borderColor: theme.accent }
          : { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.premido,
      ]}>
      {escolhido ? <Icon name={icons.checkInFeito} size={14} color={theme.accentText} /> : null}
      <ThemedText type="smallBold" style={{ color: escolhido ? theme.accentText : theme.text }}>
        {aTratar ? '…' : label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.twoAndHalf,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  premido: {
    opacity: 0.85,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  equipas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  escudos: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  jogo: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 800,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  botoes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  botao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 40,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
});
