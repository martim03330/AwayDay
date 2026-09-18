import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import {
  answerPlan,
  PlanRefused,
  type FixturePlan,
  type PlanAnswer,
} from '@/features/groups/plans';
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

/** "3 vão · 2 a pensar". */
export function respostas(plano: Pick<FixturePlan, 'going' | 'maybe'>) {
  const partes = [
    plano.going > 0 ? `${plano.going} ${plano.going === 1 ? 'vai' : 'vão'}` : null,
    plano.maybe > 0 ? `${plano.maybe} a pensar` : null,
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

type CartaoDoPlanoProps = {
  plano: FixturePlan;
  /** Quem mandou o convite para esta conversa (pode não ser quem criou o plano). `'eu'` quando foste tu. */
  quemConvidou?: string;
  /** Por cima de um fundo escuro, o cartão ganha contorno. */
  escuro?: boolean;
  onAbrir: () => void;
  onRespondido?: () => void;
};

/**
 * O convite para um jogo, como aparece na conversa do grupo e nos planos em aberto: o jogo, a hora, o estádio, quem
 * vai, e os botões para responder.
 */
export function CartaoDoPlano({
  plano,
  quemConvidou,
  escuro = false,
  onAbrir,
  onRespondido,
}: CartaoDoPlanoProps) {
  const theme = useTheme();
  const jogo = obterJogo(plano.fixtureId);
  const casa = jogo ? obterClube(jogo.casaId) : undefined;
  const fora = jogo ? obterClube(jogo.foraId) : undefined;
  const [aResponder, setAResponder] = useState<PlanAnswer | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const aberto = plano.status === 'aberto';

  async function responder(resposta: PlanAnswer) {
    setErro(null);
    setAResponder(resposta);
    try {
      // Tocar outra vez na mesma resposta tira-a.
      await answerPlan(plano.id, plano.myAnswer === resposta ? null : resposta);
      onRespondido?.();
    } catch (problema) {
      setErro(
        problema instanceof PlanRefused && problema.reason === 'plan_closed'
          ? 'O plano já fechou.'
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
      accessibilityLabel={`Convite para ${nomeDoJogo(plano.fixtureId)}, ${quandoEOnde(plano)}. ${respostas(plano)}. Toca para abrir o plano.`}
      style={({ pressed }) => [
        styles.cartao,
        CardShadow,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: escuro ? theme.highlight : theme.border,
        },
        pressed && styles.premido,
      ]}>
      <View style={[styles.faixa, { backgroundColor: theme.accent }]}>
        <Icon name={icons.calendario} size={14} color={theme.highlight} />
        <ThemedText type="eyebrow" style={{ color: theme.accentText }} numberOfLines={1}>
          {quemConvidou === 'eu'
            ? 'Convidaste a malta para o jogo'
            : quemConvidou
              ? `${quemConvidou} convida para o jogo`
              : 'Convite para o jogo'}
        </ThemedText>
      </View>

      <View style={styles.corpo}>
        <View style={styles.equipas}>
          {casa ? <Escudo clube={casa} size={30} /> : null}
          <ThemedText type="subtitle" style={styles.flex} numberOfLines={2}>
            {nomeDoJogo(plano.fixtureId)}
          </ThemedText>
          {fora ? <Escudo clube={fora} size={30} /> : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {quandoEOnde(plano)}
        </ThemedText>

        <View style={styles.linha}>
          <Icon name={icons.perfil} size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {respostas(plano)}
          </ThemedText>
        </View>
        <View style={styles.linha}>
          <Icon
            name={plano.status === 'fechado' ? icons.selecionado : icons.carro}
            size={14}
            color={plano.status === 'fechado' ? theme.accentInk : theme.textSecondary}
          />
          <ThemedText
            type="small"
            themeColor={plano.status === 'fechado' ? 'accentInk' : 'textSecondary'}
            style={styles.flex}>
            {estadoDoPlano(plano)}
          </ThemedText>
        </View>

        {aberto ? (
          <View style={styles.botoes}>
            <BotaoResposta
              label="Vou"
              escolhido={plano.myAnswer === 'vou'}
              aTratar={aResponder === 'vou'}
              onPress={() => void responder('vou')}
            />
            <BotaoResposta
              label="Estou a pensar"
              escolhido={plano.myAnswer === 'talvez'}
              aTratar={aResponder === 'talvez'}
              onPress={() => void responder('talvez')}
            />
          </View>
        ) : null}
        {erro ? (
          <ThemedText type="small" style={{ color: theme.dangerText }}>
            {erro}
          </ThemedText>
        ) : null}
      </View>
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
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  premido: {
    opacity: 0.85,
  },
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  corpo: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  equipas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
    marginTop: Spacing.one,
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
