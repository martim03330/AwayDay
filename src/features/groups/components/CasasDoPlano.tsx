import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { plansKey, usePlanHouses } from '@/features/groups/hooks/useGroups';
import {
  PlanRefused,
  setPlanStay,
  voteForPlanHouse,
  type FixturePlan,
  type PlanHouse,
} from '@/features/groups/plans';
import { requestStayPlace, StayRefused } from '@/features/stays/api';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

function mensagemDeRecusa(erro: unknown) {
  if (erro instanceof StayRefused) {
    switch (erro.reason) {
      case 'needs_history':
        return 'Para entrar numa casa precisas de conta com mais de uma semana, ou de uma boleia feita.';
      case 'house_full':
        return 'Esta casa já está cheia.';
      default:
        return 'Não deu para pedir cama. Tenta outra vez.';
    }
  }
  if (erro instanceof PlanRefused && erro.reason === 'not_owner') {
    return 'Só quem convidou escolhe a casa do plano.';
  }
  return 'Não deu para fazer isso. Tenta outra vez.';
}

type CasasDoPlanoProps = {
  plano: FixturePlan;
  /** O grupo da conversa de onde se abriu o plano: é aí que nasce uma casa proposta a partir daqui. */
  grupoId: string;
};

/**
 * As casas do plano, logo à vista: quem propôs, quanto fica a cada um, e o que a malta prefere. Quem não gostar de
 * nenhuma propõe outra. Quem convidou escolhe a casa do plano.
 */
export function CasasDoPlano({ plano, grupoId }: CasasDoPlanoProps) {
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const casas = usePlanHouses(plano.id);
  const [aTratar, setATratar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lista = casas.data ?? [];
  const tenhoCasa = lista.some((casa) => casa.isMine);
  // Só há casas nos jogos fora do país e nas ilhas (a regra é do servidor): no continente, a secção nem aparece.
  const jogo = obterJogo(plano.fixtureId);
  const estadio = jogo ? obterEstadio(jogo.estadioId) : undefined;
  const fazSentido = estadio ? estadio.regiao !== 'continente' : false;

  async function tratar(chave: string, acao: () => Promise<void>) {
    setErro(null);
    setATratar(chave);
    try {
      await acao();
      await queryClient.invalidateQueries({ queryKey: plansKey() });
      void queryClient.invalidateQueries({ queryKey: ['stays'] });
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setATratar(null);
    }
  }

  // Quem ainda não tem casa vai direto ao formulário; quem já tem vai ver a sua, para a mudar.
  const propor = () => {
    const pessoas = String(Math.max(1, plano.going));
    router.push({
      pathname: '/jogos/dormir',
      params: tenhoCasa
        ? { jogoId: plano.fixtureId, pessoas }
        : { jogoId: plano.fixtureId, grupoId, pessoas, propor: '1' },
    });
  };

  if (!fazSentido && lista.length === 0) return null;

  return (
    <>
      <SectionHeader
        title="Dormida"
        trailing={lista.length > 0 ? plural(lista.length, 'casa', 'casas') : undefined}
      />

      {lista.length === 0 && !casas.isLoading ? (
        <Card style={styles.bloco}>
          <ThemedText themeColor="textSecondary">
            Vão ter de dormir fora. Quem encontrar casa propõe-na aqui, e a malta diz qual prefere.
          </ThemedText>
          <Button label="Propor uma casa" icon={icons.casa} variant="secondary" onPress={propor} />
        </Card>
      ) : null}

      {lista.map((casa) => (
        <CartaoDaCasa
          key={casa.id}
          casa={casa}
          podeEscolher={plano.isMine && plano.status === 'aberto'}
          aTratar={aTratar}
          onPreferir={() =>
            void tratar(`voto-${casa.id}`, () =>
              voteForPlanHouse(plano.id, casa.myVote ? null : casa.id)
            )
          }
          onEscolher={() =>
            void tratar(`escolher-${casa.id}`, () => setPlanStay(plano.id, casa.id))
          }
          onPedirCama={() => void tratar(`cama-${casa.id}`, () => requestStayPlace(casa.id))}
          onVerAnuncio={
            casa.listingUrl
              ? () => void WebBrowser.openBrowserAsync(casa.listingUrl ?? '').catch(() => undefined)
              : undefined
          }
        />
      ))}

      {lista.length > 0 ? (
        <Button
          label={tenhoCasa ? 'Mudar a tua casa' : 'Não te convence? Propõe outra'}
          icon={icons.casa}
          variant="secondary"
          onPress={propor}
        />
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
    </>
  );
}

function CartaoDaCasa({
  casa,
  podeEscolher,
  aTratar,
  onPreferir,
  onEscolher,
  onPedirCama,
  onVerAnuncio,
}: {
  casa: PlanHouse;
  podeEscolher: boolean;
  aTratar: string | null;
  onPreferir: () => void;
  onEscolher: () => void;
  onPedirCama: () => void;
  onVerAnuncio?: () => void;
}) {
  const theme = useTheme();
  const livres = Math.max(0, casa.sparePlaces - casa.taken);

  return (
    <Card style={[styles.bloco, casa.chosen && { borderWidth: 2, borderColor: theme.accent }]}>
      <View style={styles.topo}>
        <View style={[styles.azulejo, { backgroundColor: theme.successBackground }]}>
          <Icon name={icons.casa} size={20} color={theme.accentInk} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.negrito} numberOfLines={1}>
            {casa.isMine ? 'A tua casa' : `Casa de ${casa.ownerName}`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[
              `${formatarCentimos(casa.totalCents)} ao todo`,
              plural(casa.nights, 'noite', 'noites'),
              livres > 0 ? plural(livres, 'cama livre', 'camas livres') : 'cheia',
            ].join(' · ')}
          </ThemedText>
        </View>
      </View>

      <View style={styles.etiquetas}>
        {casa.chosen ? (
          <Etiqueta icon={icons.selecionado} label="A casa do plano" tone="positivo" />
        ) : null}
        {casa.booked ? (
          <Etiqueta icon={icons.selecionado} label="Reservada" tone="positivo" />
        ) : null}
        {casa.myStatus === 'aceite' ? (
          <Etiqueta icon={icons.casa} label="Estás nesta casa" tone="info" />
        ) : casa.myStatus === 'pedido' ? (
          <Etiqueta icon={icons.horario} label="Pediste cama" tone="neutro" />
        ) : null}
      </View>

      <ThemedText type="small">
        {`${formatarCentimos(casa.shareNowCents)} cada, agora · ${formatarCentimos(casa.shareFullCents)} com a casa cheia`}
      </ThemedText>
      {casa.note ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`«${casa.note}»`}
        </ThemedText>
      ) : null}

      <View style={styles.acoes}>
        <Pressable
          onPress={onPreferir}
          disabled={aTratar !== null}
          accessibilityRole="button"
          accessibilityState={{ selected: casa.myVote }}
          accessibilityLabel={`Prefiro esta. ${plural(casa.votes, 'pessoa prefere', 'pessoas preferem')}.`}
          style={({ pressed }) => [
            styles.preferir,
            casa.myVote
              ? { backgroundColor: theme.accent, borderColor: theme.accent }
              : { backgroundColor: theme.background, borderColor: theme.border },
            pressed && styles.premido,
          ]}>
          <Icon
            name={icons.estrela}
            size={15}
            color={casa.myVote ? theme.accentText : theme.accentInk}
          />
          <ThemedText
            type="smallBold"
            style={{ color: casa.myVote ? theme.accentText : theme.text }}>
            {casa.myVote ? 'Preferes esta' : 'Prefiro esta'}
          </ThemedText>
          {casa.votes > 0 ? (
            <View
              style={[
                styles.contagem,
                { backgroundColor: casa.myVote ? theme.accentPressed : theme.backgroundSelected },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: casa.myVote ? theme.accentText : theme.textSecondary }}>
                {String(casa.votes)}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>

        {!casa.isMine && casa.myStatus === null && livres > 0 ? (
          <LinkTexto
            label={aTratar === `cama-${casa.id}` ? 'A pedir…' : 'Quero entrar'}
            onPress={onPedirCama}
          />
        ) : null}
      </View>

      <View style={styles.acoes}>
        {onVerAnuncio ? <LinkTexto label="Ver o anúncio" neutro onPress={onVerAnuncio} /> : null}
        {podeEscolher && !casa.chosen ? (
          <LinkTexto
            label={aTratar === `escolher-${casa.id}` ? 'A escolher…' : 'Ficar com esta'}
            onPress={onEscolher}
          />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.two,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  azulejo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  negrito: {
    fontWeight: 700,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  preferir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 38,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  premido: {
    opacity: 0.8,
  },
  contagem: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
