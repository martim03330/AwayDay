import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { fetchMyGroups } from '@/features/groups/api';
import {
  answerStayPlace,
  canShareHouse,
  fetchStayHouses,
  fetchStayPlacePeople,
  leaveStayPlace,
  markStayHouse,
  removeStayHouse,
  requestStayPlace,
  setStayGroup,
  setStayHouse,
  setStayVisibility,
  StayRefused,
  type StayCommitment,
  type StayHouse,
  type TrustSigns,
} from '@/features/stays/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import {
  datasDaEstadia,
  ESCALOES_POR_PESSOA,
  linkAirbnb,
  pesquisasPorOrcamento,
  porPessoaNaCasa,
  type Escalao,
} from '@/lib/dormida';
import { plural } from '@/lib/formatos';
import { formatarCentimos, formatarCentimosCurto, lerPrecoEmCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import { usePlanosJogos } from '@/state/planos-jogos';
import type { Jogo, Venue } from '@/mocks/tipos';
import { VoosCard } from '@/components/voos-card';
import { rotuloDeOutroGrupo } from '@/features/groups/partilha';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';
import { MensagemErro } from '@/ui/mensagem-erro';

const NOITES = [1, 2, 3];
const LUGARES = [1, 2, 3, 4, 5, 6, 7, 8];
const PESSOAS_PESQUISA = [1, 2, 3, 4, 5, 6, 7, 8];

/** "até 50 €", "50–100 €", "mais de 200 €". */
function rotuloDoEscalao(escalao: Escalao) {
  if (escalao.minCentimos === 0 && escalao.maxCentimos !== null) {
    return `até ${formatarCentimosCurto(escalao.maxCentimos)}`;
  }
  if (escalao.maxCentimos === null) return `mais de ${formatarCentimosCurto(escalao.minCentimos)}`;
  return `${formatarCentimosCurto(escalao.minCentimos).replace(/\s*€$/, '')}–${formatarCentimosCurto(escalao.maxCentimos)}`;
}

/** O que a casa toda pode custar: "até 400 € ao todo", "200–400 € ao todo", "mais de 400 € ao todo". */
function rotuloDoTotal(minCentimos: number, maxCentimos: number | null) {
  if (maxCentimos === null) return `mais de ${formatarCentimosCurto(minCentimos)} ao todo`;
  if (minCentimos === 0) return `até ${formatarCentimosCurto(maxCentimos)} ao todo`;
  return `${formatarCentimosCurto(minCentimos).replace(/\s*€$/, '')}–${formatarCentimosCurto(maxCentimos)} ao todo`;
}

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof StayRefused)) return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  switch (erro.reason) {
    case 'needs_history':
      return 'Para propor ou entrar numa casa é preciso ter conta há mais de uma semana, ou já ter feito uma boleia com a malta.';
    case 'bad_stay':
      return 'Falta alguma coisa: o preço da casa (entre 10 € e 10 000 €), as noites e os lugares.';
    case 'outside_window':
      return 'Este jogo já passou: não vale a pena tratar de dormida.';
    case 'rate_limited':
      return 'Já mexeste nisto muitas vezes hoje. Volta amanhã.';
    case 'stay_not_needed':
      return 'Neste jogo ninguém precisa de dormir fora.';
    case 'own_house':
      return 'A casa é tua.';
    case 'house_full':
      return 'Esta casa já ficou cheia ou já foi reservada.';
    case 'not_owner':
      return 'Só quem propôs a casa é que responde aos pedidos.';
    default:
      return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  }
}

/** "Na app desde setembro de 2026 · 3 boleias · 0 faltas": o que se sabe mesmo de alguém. */
function sinais(pessoa: TrustSigns) {
  const desde = pessoa.memberSince
    ? new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(
        new Date(pessoa.memberSince)
      )
    : null;
  return [
    desde ? `na app desde ${desde}` : null,
    `${plural(pessoa.ridesCompleted, 'boleia', 'boleias')}`,
    pessoa.ridesFaults > 0 ? `${plural(pessoa.ridesFaults, 'falta', 'faltas')}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Quem já está na casa e quem pediu para entrar. Os aceites vêem-se todos: é com eles que se vai dormir. */
function PessoasDaCasa({
  casa,
  aTratar,
  onResponder,
}: {
  casa: StayHouse;
  aTratar: boolean;
  onResponder: (profileId: string, aceitar: boolean) => void;
}) {
  const pessoas = useQuery({
    queryKey: ['stays', 'places', casa.id],
    queryFn: () => fetchStayPlacePeople(casa.id),
    meta: { persist: false },
  });

  const lista = pessoas.data ?? [];
  const dentro = lista.filter((pessoa) => pessoa.status === 'aceite');
  const pedidos = lista.filter((pessoa) => pessoa.status === 'pedido');

  return (
    <>
      {dentro.map((pessoa) => (
        <ThemedText key={pessoa.profileId} type="small" themeColor="textSecondary">
          {`${pessoa.isMine ? 'Tu' : pessoa.displayName} está dentro · ${sinais(pessoa)}`}
        </ThemedText>
      ))}
      {casa.isMine
        ? pedidos.map((pedido) => (
            <View key={pedido.profileId} style={styles.pedido}>
              <View style={styles.flex}>
                <ThemedText numberOfLines={1}>{`${pedido.displayName} quer entrar`}</ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {sinais(pedido)}
                </ThemedText>
              </View>
              <LinkTexto
                label="Aceitar"
                onPress={() => !aTratar && onResponder(pedido.profileId, true)}
              />
              <LinkTexto
                neutro
                label="Recusar"
                onPress={() => !aTratar && onResponder(pedido.profileId, false)}
              />
            </View>
          ))
        : null}
    </>
  );
}

/** Uma casa proposta: o que custa, quanto fica a cada um agora, quem já está dentro e como se entra. */
function CasaProposta({
  casa,
  deOutroGrupo,
  podeEntrar,
  aTratar,
  onPedir,
  onSair,
  onResponder,
  onReservar,
  onAbrir,
  onMudar,
  onApagar,
}: {
  casa: StayHouse;
  /** The house is a group's the viewer is not in: they see it because a plan was sent to their group. */
  deOutroGrupo: boolean;
  podeEntrar: boolean;
  aTratar: boolean;
  onPedir: () => void;
  onSair: () => void;
  onResponder: (profileId: string, aceitar: boolean) => void;
  onReservar: (reservada: boolean) => void;
  onAbrir: (publica: boolean) => void;
  onMudar: () => void;
  onApagar: () => void;
}) {
  const theme = useTheme();
  const livres = casa.sparePlaces - casa.taken;
  const reservada = casa.status === 'reservada';

  return (
    <View style={[styles.casa, { borderColor: reservada ? theme.success : theme.border }]}>
      <View style={styles.linha}>
        <ThemedText style={styles.nome} numberOfLines={1}>
          {casa.isMine ? 'A tua casa' : `Casa de ${casa.displayName}`}
        </ThemedText>
        <ThemedText
          style={styles.preco}>{`${formatarCentimos(casa.shareNowCents)} cada`}</ThemedText>
      </View>
      {!casa.isMine ? (
        <ThemedText type="small" themeColor="textMuted">
          {sinais(casa)}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        {`${formatarCentimos(casa.totalCents)} a casa toda · ${plural(casa.nights, 'noite', 'noites')} · ${plural(1 + casa.taken, 'pessoa dentro', 'pessoas dentro')}`}
      </ThemedText>
      {!reservada && livres > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`Com a casa cheia fica ${formatarCentimos(casa.shareFullCents)} a cada um.`}
        </ThemedText>
      ) : null}

      <View style={styles.etiquetas}>
        {reservada ? (
          <Etiqueta icon={icons.selecionado} label="Casa reservada" tone="positivo" />
        ) : (
          <Etiqueta
            icon={icons.perfil}
            label={livres > 0 ? plural(livres, 'lugar livre', 'lugares livres') : 'Cheia'}
            tone={livres > 0 ? 'positivo' : 'neutro'}
          />
        )}
        {casa.commitment === 'certo' ? (
          <Etiqueta icon={icons.selecionado} label="Reserva de qualquer maneira" tone="info" />
        ) : (
          <Etiqueta icon={icons.aviso} label="Só reserva se encher" tone="aviso" />
        )}
        {casa.visibility === 'grupo' ? (
          <Etiqueta
            icon={icons.perfil}
            label={
              !casa.groupName
                ? 'Só para um grupo'
                : deOutroGrupo
                  ? rotuloDeOutroGrupo('casa', casa.groupName)
                  : `Só do grupo ${casa.groupName}`
            }
            tone="info"
          />
        ) : null}
      </View>

      {casa.note ? <ThemedText>{casa.note}</ThemedText> : null}

      {casa.listingUrl ? (
        <>
          <LinkTexto
            label="Ver esta casa no Airbnb"
            onPress={() =>
              casa.listingUrl && void Linking.openURL(casa.listingUrl).catch(() => undefined)
            }
          />
          <ThemedText type="small" themeColor="textMuted">
            {`Visto por ${casa.isMine ? 'ti' : casa.displayName}${casa.listingSeenOn ? ` a ${formatarData(new Date(casa.listingSeenOn))}` : ''}. Confirma no Airbnb: pode já não estar disponível.`}
          </ThemedText>
        </>
      ) : null}

      <PessoasDaCasa casa={casa} aTratar={aTratar} onResponder={onResponder} />

      {casa.isMine ? (
        <View style={styles.acoes}>
          <LinkTexto
            label={reservada ? 'Voltar a juntar gente' : 'Já reservei a casa'}
            onPress={() => onReservar(!reservada)}
          />
          {casa.groupId ? (
            <LinkTexto
              label={casa.visibility === 'grupo' ? 'Abrir a toda a gente' : 'Fechar ao grupo'}
              onPress={() => onAbrir(casa.visibility === 'grupo')}
            />
          ) : null}
          <LinkTexto label="Mudar" onPress={onMudar} />
          <LinkTexto perigo label="Apagar" onPress={onApagar} />
        </View>
      ) : casa.myStatus === 'aceite' ? (
        <>
          <Etiqueta icon={icons.selecionado} label="Tens lugar nesta casa" tone="positivo" />
          <LinkTexto perigo label="Sair da casa" onPress={onSair} />
        </>
      ) : casa.myStatus === 'pedido' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Pedido enviado. Quem propôs a casa é que decide.
          </ThemedText>
          <LinkTexto perigo label="Retirar o pedido" onPress={onSair} />
        </>
      ) : livres > 0 && !reservada && podeEntrar ? (
        <Button
          label="Pedir lugar nesta casa"
          icon={icons.casa}
          variant="secondary"
          disabled={aTratar}
          onPress={onPedir}
        />
      ) : (
        <ThemedText type="small" themeColor="textMuted">
          {reservada
            ? 'Esta casa já está fechada.'
            : livres <= 0
              ? 'Esta casa já não tem lugares.'
              : 'Ainda não podes entrar numa casa: é preciso ter conta há mais de uma semana ou já ter feito uma boleia.'}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * Onde dormir, em jogos no estrangeiro e nas ilhas.
 *
 * Funciona como as boleias: alguém encontra uma casa, propõe-na com o custo total, e quem quiser pede lugar. O preço
 * por pessoa desce a cada um que entra e é sempre o servidor a fazer a conta. Dormir com desconhecidos e adiantar
 * dinheiro pede mais cuidado do que partilhar um carro: por isso só propõe ou entra quem já tem algum pé na app, o
 * que se sabe de cada um fica à vista, e a app diz claramente que não trata de dinheiro nenhum.
 */
export function DormidaCard({
  jogo,
  estadio,
  grupoInicial = null,
  abrirLogo = false,
  pessoasDoGrupo = null,
}: {
  jogo: Jogo;
  estadio: Venue;
  /** Vindo de um plano: a casa nasce já desse grupo. */
  grupoInicial?: string | null;
  /** Vindo de «Propor uma casa» num plano: o formulário abre logo. */
  abrirLogo?: boolean;
  /**
   * Vindo de um plano: quantos disseram «vou». Aí já se sabe quanta gente vai, e a pesquisa é para esse número;
   * fora de um grupo, pergunta-se quanto cada um quer pagar e o tamanho da casa sai daí.
   */
  pessoasDoGrupo?: number | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const userId = useUserId();
  const queryClient = useQueryClient();
  const { garantirVou } = usePlanosJogos();

  const casas = useQuery({
    queryKey: ['stays', jogo.id],
    queryFn: userId ? () => fetchStayHouses(jogo.id) : skipToken,
    meta: { persist: false },
  });
  const meusGrupos = useQuery({
    queryKey: ['groups', userId],
    queryFn: userId ? fetchMyGroups : skipToken,
    meta: { persist: false },
  });
  const permissao = useQuery({
    queryKey: ['stays', 'can-share', userId],
    queryFn: userId ? () => canShareHouse(userId) : skipToken,
    meta: { persist: false },
  });

  const lista = casas.data ?? [];
  const minhaCasa = lista.find((casa) => casa.isMine) ?? null;
  const podePartilhar = permissao.data === true;
  const lugaresLivres = lista
    .filter((casa) => casa.status === 'a_juntar')
    .reduce((soma, casa) => soma + Math.max(0, casa.sparePlaces - casa.taken), 0);

  const [aberto, setAberto] = useState(abrirLogo);
  const [valor, setValor] = useState('');
  const [noites, setNoites] = useState(2);
  const [lugares, setLugares] = useState(3);
  const [conviccao, setConviccao] = useState<StayCommitment>('se_houver');
  const [link, setLink] = useState('');
  const [nota, setNota] = useState('');
  const [grupoId, setGrupoId] = useState<string | null>(grupoInicial);
  const [soParaOGrupo, setSoParaOGrupo] = useState(true);
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [noitesPesquisa, setNoitesPesquisa] = useState<number | null>(null);
  const [pessoasPesquisa, setPessoasPesquisa] = useState<number | null>(null);
  // O escalão de 50 € a 100 € por pessoa é o ponto de partida: é onde cai a maior parte das casas partilhadas.
  const [escalao, setEscalao] = useState(1);
  const noitesUsadas = noitesPesquisa ?? minhaCasa?.nights ?? 2;
  const pessoasUsadas = pessoasPesquisa ?? Math.min(8, Math.max(1, pessoasDoGrupo ?? 4));

  const estadia = datasDaEstadia(jogo.inicio, noitesUsadas);
  const pesquisas = pesquisasPorOrcamento({
    cidade: estadio.cidade,
    pais: estadio.pais,
    estadia,
    noites: noitesUsadas,
    escalao: ESCALOES_POR_PESSOA[escalao] ?? ESCALOES_POR_PESSOA[1],
  });
  const linkDePesquisa = linkAirbnb({
    cidade: estadio.cidade,
    pais: estadio.pais,
    estadia,
    pessoas: pessoasUsadas,
  });
  const centimos = lerPrecoEmCentimos(valor);
  const precoPorPessoa = centimos !== null ? porPessoaNaCasa(centimos, 1 + lugares) : null;

  async function tratar(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      void queryClient.invalidateQueries({ queryKey: ['stays'] });
      return true;
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      return false;
    } finally {
      setATratar(false);
    }
  }

  function abrirForm() {
    setValor(minhaCasa ? String(Math.round(minhaCasa.totalCents / 100)) : '');
    setNoites(minhaCasa?.nights ?? 2);
    setLugares(minhaCasa?.sparePlaces ?? 3);
    setConviccao(minhaCasa?.commitment ?? 'se_houver');
    setLink(minhaCasa?.listingUrl ?? '');
    setNota(minhaCasa?.note ?? '');
    setGrupoId(minhaCasa?.groupId ?? grupoInicial);
    setSoParaOGrupo(minhaCasa ? minhaCasa.visibility === 'grupo' : true);
    setErro(null);
    setAberto(true);
  }

  async function guardar() {
    if (centimos === null) {
      setErro('Escreve quanto custa a casa ao todo, por exemplo 320.');
      return;
    }
    const guardado = await tratar(async () => {
      const id = await setStayHouse(jogo.id, {
        nights: noites,
        totalCents: centimos,
        sparePlaces: lugares,
        commitment: conviccao,
        listingUrl: link,
        note: nota,
      });
      // O grupo e a privacidade são etiquetas da casa: se falharem, a casa fica proposta na mesma.
      await setStayGroup(id, grupoId).catch(() => undefined);
      // Propor uma casa é ir ao jogo: o bilhete abre-se sozinho.
      await garantirVou(jogo.id).catch(() => undefined);
      await setStayVisibility(id, !(grupoId && soParaOGrupo)).catch(() => undefined);
    });
    if (guardado) setAberto(false);
  }

  return (
    <>
      {/* Procurar casa vem primeiro: é por aí que quase toda a gente começa. */}
      <Card style={styles.card}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          Procurar casa
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {`Em ${estadio.cidade}: entrada a ${formatarData(new Date(estadia.checkin))}, saída a ${formatarData(new Date(estadia.checkout))}.`}
        </ThemedText>

        <ThemedText style={styles.rotulo}>Quantas noites</ThemedText>
        <View style={styles.chips}>
          {NOITES.map((numero) => (
            <Chip
              key={`noite-${numero}`}
              label={plural(numero, 'noite', 'noites')}
              selected={numero === noitesUsadas}
              emCartao
              onPress={() => setNoitesPesquisa(numero)}
            />
          ))}
        </View>

        {pessoasDoGrupo !== null ? (
          <>
            <ThemedText style={styles.rotulo}>Para quantas pessoas</ThemedText>
            <View style={styles.chips}>
              {PESSOAS_PESQUISA.map((numero) => (
                <Chip
                  key={`pessoa-${numero}`}
                  label={plural(numero, 'pessoa', 'pessoas')}
                  selected={numero === pessoasUsadas}
                  emCartao
                  onPress={() => setPessoasPesquisa(numero)}
                />
              ))}
            </View>
            <Button
              label="Procurar no Airbnb"
              icon={icons.casa}
              onPress={() => void Linking.openURL(linkDePesquisa).catch(() => undefined)}
            />
          </>
        ) : (
          <>
            <ThemedText style={styles.rotulo}>Quanto queres pagar, só tu?</ThemedText>
            <View style={styles.chips}>
              {ESCALOES_POR_PESSOA.map((opcao, indice) => (
                <Chip
                  key={`escalao-${opcao.minCentimos}`}
                  label={rotuloDoEscalao(opcao)}
                  selected={indice === escalao}
                  emCartao
                  onPress={() => setEscalao(indice)}
                />
              ))}
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Pela dormida toda.
            </ThemedText>
            <View style={styles.pesquisas}>
              {pesquisas.map((pesquisa) => (
                <Pressable
                  key={pesquisa.pessoas}
                  onPress={() => void Linking.openURL(pesquisa.link).catch(() => undefined)}
                  accessibilityRole="link"
                  accessibilityLabel={`Procurar no Airbnb casas para ${pesquisa.pessoas} pessoas, ${rotuloDoTotal(pesquisa.totalMinCentimos, pesquisa.totalMaxCentimos)}`}
                  style={({ pressed }) => [
                    styles.pesquisa,
                    { backgroundColor: theme.background, borderColor: theme.border },
                    pressed && styles.premido,
                  ]}>
                  <View style={[styles.azulejo, { backgroundColor: theme.successBackground }]}>
                    <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                      {String(pesquisa.pessoas)}
                    </ThemedText>
                  </View>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{`Casa para ${pesquisa.pessoas}`}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {rotuloDoTotal(pesquisa.totalMinCentimos, pesquisa.totalMaxCentimos)}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={{ color: theme.accentInk }}>
                    Airbnb
                  </ThemedText>
                  <Icon name={icons.seguinte} size={16} color={theme.accentInk} />
                </Pressable>
              ))}
            </View>
          </>
        )}
        <ThemedText type="small" themeColor="textMuted">
          Abre o Airbnb já com a cidade, as datas e o preço.
        </ThemedText>
      </Card>

      {/* Voos, para jogos do outro lado do mar ou da fronteira: as mesmas datas da casa. */}
      <VoosCard estadio={estadio} estadia={estadia} />

      {lista.length > 0 ? (
        <ThemedText style={styles.destaque}>
          {[
            `${plural(lista.length, 'casa proposta', 'casas propostas')}`,
            lugaresLivres > 0 ? `${plural(lugaresLivres, 'lugar livre', 'lugares livres')}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      ) : null}

      {lista.map((casa) => (
        <CasaProposta
          key={casa.id}
          casa={casa}
          deOutroGrupo={casa.groupId !== null && !(meusGrupos.data ?? []).some((grupo) => grupo.id === casa.groupId)}
          podeEntrar={podePartilhar}
          aTratar={aTratar}
          onPedir={() =>
            void tratar(async () => {
              await requestStayPlace(casa.id);
              await garantirVou(jogo.id).catch(() => undefined);
            })
          }
          onSair={() => void tratar(() => leaveStayPlace(casa.id))}
          onResponder={(profileId, aceitar) =>
            void tratar(() => answerStayPlace(casa.id, profileId, aceitar))
          }
          onReservar={(reservada) => void tratar(() => markStayHouse(casa.id, reservada))}
          onAbrir={(publica) => void tratar(() => setStayVisibility(casa.id, publica))}
          onMudar={abrirForm}
          onApagar={() => void tratar(() => removeStayHouse(jogo.id))}
        />
      ))}

      <Aviso
        tone="aviso"
        title="Dividir casa é entre vocês"
        message="A app não reserva nem trata de dinheiro. Paga pelo Airbnb e não transfiras nada antes de veres a reserva confirmada."
      />

      {/* Propor uma casa: cartão próprio, para não ser mais uma secção de uma parede. */}
      <Card style={styles.card}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          Viste uma casa?
        </ThemedText>
        {!userId ? (
          <LinkTexto
            label="Entra para propores uma casa ou pedires lugar"
            onPress={() => router.push('/conta/entrar')}
          />
        ) : !podePartilhar ? (
          <ThemedText type="small" themeColor="textSecondary">
            Para propor ou entrar numa casa, precisas de conta há mais de uma semana ou de já teres
            feito uma boleia.
          </ThemedText>
        ) : aberto ? (
          <View style={styles.form}>
            <Campo
              label="Quanto custa a casa ao todo"
              value={valor}
              onChangeText={setValor}
              placeholder="Ex.: 320"
              keyboardType="decimal-pad"
              ajuda="O valor que o Airbnb mostra pelas noites todas, para a casa inteira."
              erro={valor && centimos === null ? 'Escreve um valor como 320 ou 320,50' : null}
            />

            <ThemedText style={styles.rotulo}>Lugares para outras pessoas</ThemedText>
            <View style={styles.chips}>
              {LUGARES.map((numero) => (
                <Chip
                  key={numero}
                  label={String(numero)}
                  selected={numero === lugares}
                  emCartao
                  onPress={() => setLugares(numero)}
                />
              ))}
            </View>
            {precoPorPessoa !== null ? (
              <ThemedText style={styles.destaque}>
                {`Com a casa cheia ficam ${formatarCentimos(precoPorPessoa)} a cada um.`}
              </ThemedText>
            ) : null}

            <ThemedText style={styles.rotulo}>Quantas noites</ThemedText>
            <View style={styles.chips}>
              {NOITES.map((numero) => (
                <Chip
                  key={numero}
                  label={plural(numero, 'noite', 'noites')}
                  selected={numero === noites}
                  emCartao
                  onPress={() => setNoites(numero)}
                />
              ))}
            </View>

            <ThemedText style={styles.rotulo}>E se não se juntar ninguém?</ThemedText>
            <View style={styles.chips}>
              <Chip
                label="Reservo à mesma"
                selected={conviccao === 'certo'}
                emCartao
                onPress={() => setConviccao('certo')}
              />
              <Chip
                label="Só reservo se encher"
                selected={conviccao === 'se_houver'}
                emCartao
                onPress={() => setConviccao('se_houver')}
              />
            </View>

            {(meusGrupos.data ?? []).length > 0 ? (
              <>
                <ThemedText style={styles.rotulo}>De quem é esta casa?</ThemedText>
                <View style={styles.chips}>
                  <Chip
                    label="De ninguém em especial"
                    selected={grupoId === null}
                    emCartao
                    onPress={() => setGrupoId(null)}
                  />
                  {(meusGrupos.data ?? []).map((grupo) => (
                    <Chip
                      key={grupo.id}
                      label={grupo.name}
                      selected={grupoId === grupo.id}
                      emCartao
                      onPress={() => setGrupoId(grupo.id)}
                    />
                  ))}
                </View>
                {grupoId ? (
                  <>
                    <View style={styles.linhaSwitch}>
                      <ThemedText style={styles.flex}>Só para o grupo, por agora</ThemedText>
                      <Switch
                        value={soParaOGrupo}
                        onValueChange={setSoParaOGrupo}
                        trackColor={{ true: theme.accent, false: theme.border }}
                        thumbColor={theme.accentText}
                        ios_backgroundColor={theme.border}
                        accessibilityLabel="Só para o grupo, por agora"
                      />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {soParaOGrupo
                        ? 'Só a malta do grupo vê esta casa. Se sobrarem lugares, abres a toda a gente com um toque.'
                        : 'A casa aparece a qualquer adepto que vá a este jogo.'}
                    </ThemedText>
                  </>
                ) : null}
              </>
            ) : null}

            <Campo
              label="Link da casa no Airbnb (opcional)"
              value={link}
              onChangeText={setLink}
              placeholder="https://www.airbnb.pt/rooms/…"
              autoCapitalize="none"
              keyboardType="url"
              autoComplete="url"
              textContentType="URL"
              returnKeyType="done"
              maxLength={500}
            />
            <Campo
              label="Alguma nota (opcional)"
              value={nota}
              onChangeText={setNota}
              placeholder="Ex.: a 10 min do estádio, dois quartos e sofá-cama"
              maxLength={200}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
            {erro ? <MensagemErro>{erro}</MensagemErro> : null}
            <Button
              label={aTratar ? 'A guardar…' : 'Guardar'}
              disabled={aTratar}
              onPress={() => void guardar()}
            />
            <LinkTexto neutro label="Deixa estar" onPress={() => setAberto(false)} />
          </View>
        ) : minhaCasa ? (
          <ThemedText type="small" themeColor="textSecondary">
            A tua casa está aí em cima. Podes mudá-la, apagá-la ou marcá-la como reservada.
          </ThemedText>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Diz quanto custa e quantos lugares tem: a app mostra quanto paga cada um.
            </ThemedText>
            <Button
              label="Propor uma casa"
              icon={icons.casa}
              variant="secondary"
              onPress={abrirForm}
            />
          </>
        )}
        {erro && !aberto ? (
          <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  destaque: {
    fontWeight: 800,
  },
  casa: {
    gap: Spacing.two,
    paddingVertical: Spacing.twoAndHalf,
    paddingHorizontal: Spacing.twoAndHalf,
    borderWidth: 1.5,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  rotulo: {
    fontWeight: 700,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.two,
  },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pedido: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  nome: {
    flex: 1,
    fontWeight: 800,
  },
  preco: {
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  flex: {
    flex: 1,
  },
  pesquisas: {
    gap: Spacing.two,
  },
  pesquisa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
    padding: Spacing.twoAndHalf,
    borderWidth: 1.5,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  azulejo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premido: {
    opacity: 0.8,
  },
});
