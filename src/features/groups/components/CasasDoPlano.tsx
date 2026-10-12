import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ligacaoDeCasaValida } from '@/lib/dormida';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { plansKey, usePlanHouses } from '@/features/groups/hooks/useGroups';
import {
  joinPlanStay,
  PlanRefused,
  setPlanStay,
  setPlanStayLocked,
  voteForPlanHouse,
  type FixturePlan,
  type PlanHouse,
} from '@/features/groups/plans';
import { leaveStayPlace, StayRefused } from '@/features/stays/api';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { vibrarErro } from '@/lib/vibrar';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { LinkTexto } from '@/ui/link-texto';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';
import { useFormatarDinheiro } from '@/ui/valor';

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
  if (erro instanceof PlanRefused) {
    switch (erro.reason) {
      case 'not_owner':
        return 'Só quem convidou escolhe e fecha a casa do plano.';
      case 'house_full':
        return 'A casa encheu entretanto.';
      case 'stay_not_locked':
        return 'A escolha da casa voltou a abrir. Espera que fechem outra vez.';
      case 'owner_not_in_plan':
        return 'Só dá para escolher a casa de alguém do plano.';
      case 'needs_history':
        return 'Para entrar numa casa partilhada precisas de ter as boleias em dia.';
      default:
        return 'Não deu para fazer isso. Tenta outra vez.';
    }
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
  // Com a escolha fechada o servidor só devolve a casa do plano.
  const fechada = lista.some((casa) => casa.locked);
  const escolhida = lista.find((casa) => casa.chosen) ?? null;
  const podeDecidir = plano.isMine;
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
      vibrarErro();
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
        trailing={lista.length > 1 && !fechada ? plural(lista.length, 'casa', 'casas') : undefined}
      />

      {lista.length === 0 && !casas.isLoading ? (
        <Card style={styles.bloco}>
          <ThemedText themeColor="textSecondary">
            Vão ter de dormir fora. Propõe uma casa e a malta escolhe.
          </ThemedText>
          <Button label="Propor uma casa" icon={icons.casa} variant="secondary" onPress={propor} />
        </Card>
      ) : null}

      {fechada && escolhida ? (
        <CasaFechada
          casa={escolhida}
          aTratar={aTratar}
          podeReabrir={plano.isMine}
          onEntrar={() => void tratar('entrar', () => joinPlanStay(plano.id))}
          onSair={() => void tratar('sair', () => leaveStayPlace(escolhida.id))}
          onReabrir={() => void tratar('reabrir', () => setPlanStayLocked(plano.id, false))}
          onVerAnuncio={
            escolhida.listingUrl && ligacaoDeCasaValida(escolhida.listingUrl)
              ? () =>
                  void WebBrowser.openBrowserAsync(escolhida.listingUrl ?? '').catch(
                    () => undefined
                  )
              : undefined
          }
        />
      ) : lista.length > 0 ? (
        <>
          <Card style={styles.lista}>
            {lista.map((casa, indice) => (
              <CasaProposta
                key={casa.id}
                casa={casa}
                separador={indice < lista.length - 1}
                podeEscolher={podeDecidir}
                aTratar={aTratar}
                onPreferir={() =>
                  void tratar(`voto-${casa.id}`, () =>
                    voteForPlanHouse(plano.id, casa.myVote ? null : casa.id)
                  )
                }
                onEscolher={() =>
                  void tratar(`escolher-${casa.id}`, () => setPlanStay(plano.id, casa.id))
                }
                onVerAnuncio={
                  casa.listingUrl && ligacaoDeCasaValida(casa.listingUrl)
                    ? () =>
                        void WebBrowser.openBrowserAsync(casa.listingUrl ?? '').catch(
                          () => undefined
                        )
                    : undefined
                }
              />
            ))}
          </Card>

          {podeDecidir && escolhida ? (
            <Button
              label={
                aTratar === 'fechar'
                  ? 'A fechar…'
                  : `Fechar a escolha: ${escolhida.isMine ? 'a tua casa' : `casa de ${escolhida.ownerName}`}`
              }
              icon={icons.selecionado}
              disabled={aTratar !== null}
              onPress={() => void tratar('fechar', () => setPlanStayLocked(plano.id, true))}
            />
          ) : null}

          <LinkTexto
            label={tenhoCasa ? 'Mudar a tua casa' : 'Propor outra casa'}
            onPress={propor}
          />
        </>
      ) : null}

      {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
    </>
  );
}

/** Uma casa proposta, numa linha do cartão: quem a propôs, quanto fica a cada um, e o voto. */
function CasaProposta({
  casa,
  separador,
  podeEscolher,
  aTratar,
  onPreferir,
  onEscolher,
  onVerAnuncio,
}: {
  casa: PlanHouse;
  separador: boolean;
  podeEscolher: boolean;
  aTratar: string | null;
  onPreferir: () => void;
  onEscolher: () => void;
  onVerAnuncio?: () => void;
}) {
  const dinheiro = useFormatarDinheiro();
  const theme = useTheme();
  const livres = Math.max(0, casa.sparePlaces - casa.taken);
  const estado = casa.chosen
    ? { label: 'A casa do plano', tone: 'positivo' as const, icon: icons.selecionado }
    : casa.myStatus === 'aceite'
      ? { label: 'Estás nesta casa', tone: 'info' as const, icon: icons.casa }
      : casa.myStatus === 'pedido'
        ? { label: 'Pediste cama', tone: 'neutro' as const, icon: icons.horario }
        : null;

  return (
    <View
      style={[
        styles.casa,
        separador && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSelected },
      ]}>
      <View style={styles.topo}>
        <View
          style={[
            styles.azulejo,
            { backgroundColor: casa.chosen ? theme.accent : theme.successBackground },
          ]}>
          <Icon name={icons.casa} size={20} color={casa.chosen ? theme.accentText : theme.accentInk} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.negrito} numberOfLines={1}>
            {casa.isMine ? 'A tua casa' : `Casa de ${casa.ownerName}`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${dinheiro.formatar(casa.shareNowCents)} cada · ${dinheiro.formatar(casa.shareFullCents)} com a casa cheia`}
          </ThemedText>
        </View>
      </View>

      <LinhaDetalhes
        partes={[
          plural(casa.nights, 'noite', 'noites'),
          livres > 0 ? plural(livres, 'cama livre', 'camas livres') : 'cheia',
          `${dinheiro.formatar(casa.totalCents)} ao todo`,
          casa.booked ? 'reservada' : null,
        ]}
      />
      {casa.note ? (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {`«${casa.note}»`}
        </ThemedText>
      ) : null}
      {estado ? (
        <View style={styles.etiqueta}>
          <Etiqueta icon={estado.icon} label={estado.label} tone={estado.tone} />
        </View>
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
        {podeEscolher && !casa.chosen ? (
          <LinkTexto
            label={aTratar === `escolher-${casa.id}` ? 'A escolher…' : 'Ficar com esta'}
            onPress={onEscolher}
          />
        ) : null}
        {onVerAnuncio ? <LinkTexto label="Anúncio" neutro onPress={onVerAnuncio} /> : null}
      </View>
    </View>
  );
}

/**
 * A escolha fechada: a casa do plano, quem já lá está, e quanto fica a cada um agora e com a casa cheia. Cada um entra
 * com um toque — dentro do grupo não se pede cama.
 */
function CasaFechada({
  casa,
  aTratar,
  podeReabrir,
  onEntrar,
  onSair,
  onReabrir,
  onVerAnuncio,
}: {
  casa: PlanHouse;
  aTratar: string | null;
  podeReabrir: boolean;
  onEntrar: () => void;
  onSair: () => void;
  onReabrir: () => void;
  onVerAnuncio?: () => void;
}) {
  const dinheiro = useFormatarDinheiro();
  const theme = useTheme();
  const livres = Math.max(0, casa.sparePlaces - casa.taken);
  const estouLa = casa.isMine || casa.myStatus === 'aceite';

  return (
    <Card style={styles.bloco}>
      <View style={styles.topo}>
        <View style={[styles.azulejo, { backgroundColor: theme.accent }]}>
          <Icon name={icons.casa} size={20} color={theme.accentText} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            Casa escolhida
          </ThemedText>
          <ThemedText style={styles.negrito} numberOfLines={1}>
            {casa.isMine ? 'A tua casa' : `Casa de ${casa.ownerName}`}
          </ThemedText>
        </View>
        <View style={styles.preco}>
          <ThemedText style={[styles.precoValor, { color: theme.accentInk }]}>
            {dinheiro.formatar(casa.shareNowCents)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            cada
          </ThemedText>
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {livres > 0
          ? `Com a casa cheia, ${dinheiro.formatar(casa.shareFullCents)} cada.`
          : 'A casa está cheia: é o preço final.'}
      </ThemedText>
      <LinhaDetalhes
        partes={[
          plural(casa.nights, 'noite', 'noites'),
          livres > 0 ? plural(livres, 'cama livre', 'camas livres') : 'cheia',
          `${dinheiro.formatar(casa.totalCents)} ao todo`,
        ]}
      />
      <ThemedText type="small">{`Lá dentro: ${casa.peopleNames.join(', ')}`}</ThemedText>

      {estouLa ? (
        <View style={styles.estado}>
          <Icon name={icons.selecionado} size={18} color={theme.accentInk} />
          <ThemedText type="smallBold" style={[styles.flex, { color: theme.accentInk }]}>
            Estás nesta casa
          </ThemedText>
          {!casa.isMine ? (
            <Pressable onPress={onSair} disabled={aTratar !== null} hitSlop={8} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: theme.dangerText }}>
                {aTratar === 'sair' ? 'A sair…' : 'Sair'}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : livres > 0 ? (
        <Button
          label={aTratar === 'entrar' ? 'A entrar…' : 'Entrar na casa'}
          icon={icons.casa}
          disabled={aTratar !== null}
          onPress={onEntrar}
        />
      ) : null}

      {onVerAnuncio || podeReabrir ? (
        <View style={[styles.acoes, styles.centro]}>
          {onVerAnuncio ? <LinkTexto label="Ver o anúncio" neutro onPress={onVerAnuncio} /> : null}
          {podeReabrir ? (
            <LinkTexto
              neutro
              label={aTratar === 'reabrir' ? 'A reabrir…' : 'Reabrir a escolha'}
              onPress={onReabrir}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  bloco: {
    gap: Spacing.twoAndHalf,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  casa: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
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
  etiqueta: {
    flexDirection: 'row',
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  centro: {
    justifyContent: 'center',
  },
  estado: {
    flexDirection: 'row',
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
  preco: {
    alignItems: 'flex-end',
  },
  precoValor: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 800,
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
