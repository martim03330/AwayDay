import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  answerStayPlace,
  fetchStayPlacePeople,
  fetchStayPlans,
  leaveStayPlace,
  markStayHouse,
  removeStayPlan,
  requestStayPlace,
  setStayPlan,
  StayRefused,
  type StayCommitment,
  type StayKind,
  type StayPlan,
} from '@/features/stays/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import { datasDaEstadia, linkAirbnb, porPessoaNaCasa } from '@/lib/dormida';
import { plural } from '@/lib/formatos';
import { formatarCentimos, lerPrecoEmCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import type { Jogo, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Etiqueta } from '@/ui/etiqueta';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const NOITES = [1, 2, 3];
const LUGARES = [1, 2, 3, 4, 5, 6, 7, 8];
const PESSOAS_PESQUISA = [1, 2, 3, 4, 5, 6];

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof StayRefused)) return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  switch (erro.reason) {
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
      return 'Esta casa já ficou cheia.';
    case 'not_owner':
      return 'Só quem propôs a casa é que responde aos pedidos.';
    default:
      return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  }
}

/** Os pedidos de lugar numa casa, para quem a propôs. */
function PedidosDaCasa({
  casa,
  aTratar,
  onResponder,
}: {
  casa: StayPlan;
  aTratar: boolean;
  onResponder: (profileId: string, aceitar: boolean) => void;
}) {
  const pessoas = useQuery({
    queryKey: ['stays', 'places', casa.id],
    queryFn: casa.isMine ? () => fetchStayPlacePeople(casa.id) : skipToken,
    meta: { persist: false },
  });

  const lista = pessoas.data ?? [];
  const pedidos = lista.filter((pessoa) => pessoa.status === 'pedido');
  const dentro = lista.filter((pessoa) => pessoa.status === 'aceite');

  return (
    <>
      {dentro.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`Vão contigo: ${dentro.map((pessoa) => pessoa.displayName).join(', ')}`}
        </ThemedText>
      ) : null}
      {pedidos.map((pedido) => (
        <View key={pedido.profileId} style={styles.pedido}>
          <ThemedText style={styles.flex} numberOfLines={1}>
            {`${pedido.displayName} quer entrar`}
          </ThemedText>
          <LinkTexto
            label="Aceitar"
            onPress={() => !aTratar && onResponder(pedido.profileId, true)}
          />
          <LinkTexto
            label="Recusar"
            onPress={() => !aTratar && onResponder(pedido.profileId, false)}
          />
        </View>
      ))}
    </>
  );
}

/** Uma casa proposta: o que custa, quanto fica a cada um agora, e como se entra. */
function CasaProposta({
  casa,
  aTratar,
  onPedir,
  onSair,
  onResponder,
  onReservar,
  onMudar,
  onApagar,
}: {
  casa: StayPlan;
  aTratar: boolean;
  onPedir: () => void;
  onSair: () => void;
  onResponder: (profileId: string, aceitar: boolean) => void;
  onReservar: (reservada: boolean) => void;
  onMudar: () => void;
  onApagar: () => void;
}) {
  const theme = useTheme();
  const livres = (casa.sparePlaces ?? 0) - casa.taken;
  const reservada = casa.status === 'reservada';

  return (
    <View style={[styles.casa, { borderColor: reservada ? theme.success : theme.border }]}>
      <View style={styles.linha}>
        <ThemedText style={styles.nome} numberOfLines={1}>
          {casa.isMine ? 'A tua casa' : `Casa de ${casa.displayName}`}
        </ThemedText>
        {casa.shareNowCents !== null ? (
          <ThemedText
            style={styles.preco}>{`${formatarCentimos(casa.shareNowCents)} cada`}</ThemedText>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {`${formatarCentimos(casa.totalCents ?? 0)} a casa toda · ${plural(casa.nights, 'noite', 'noites')} · ${plural(1 + casa.taken, 'pessoa dentro', 'pessoas dentro')}`}
      </ThemedText>
      {!reservada && casa.shareFullCents !== null && livres > 0 ? (
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

      {casa.isMine ? (
        <>
          <PedidosDaCasa casa={casa} aTratar={aTratar} onResponder={onResponder} />
          <View style={styles.acoes}>
            <LinkTexto
              label={reservada ? 'Voltar a juntar gente' : 'Já reservei a casa'}
              onPress={() => onReservar(!reservada)}
            />
            <LinkTexto label="Mudar" onPress={onMudar} />
            <LinkTexto label="Apagar" onPress={onApagar} />
          </View>
        </>
      ) : casa.myStatus === 'aceite' ? (
        <>
          <Etiqueta icon={icons.selecionado} label="Tens lugar nesta casa" tone="positivo" />
          <LinkTexto label="Sair da casa" onPress={onSair} />
        </>
      ) : casa.myStatus === 'pedido' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Pedido enviado. Quem propôs a casa é que decide.
          </ThemedText>
          <LinkTexto label="Retirar o pedido" onPress={onSair} />
        </>
      ) : livres > 0 && !reservada ? (
        <Button
          label="Pedir lugar nesta casa"
          icon={icons.casa}
          variant="secondary"
          disabled={aTratar}
          onPress={onPedir}
        />
      ) : (
        <ThemedText type="small" themeColor="textMuted">
          {reservada ? 'Esta casa já está fechada.' : 'Esta casa já não tem lugares.'}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * Onde dormir, em jogos no estrangeiro e nas ilhas.
 *
 * Funciona como as boleias: alguém encontra uma casa, propõe-na com o custo total, e quem quiser pede lugar. O preço
 * por pessoa desce a cada um que entra e é sempre o servidor a fazer a conta. A app não guarda disponibilidade: o
 * link é de quem o viu, com a data, e a pesquisa do Airbnb mostra o que há neste momento.
 */
export function DormidaCard({ jogo, estadio }: { jogo: Jogo; estadio: Venue }) {
  const theme = useTheme();
  const router = useRouter();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const planos = useQuery({
    queryKey: ['stays', jogo.id],
    queryFn: userId ? () => fetchStayPlans(jogo.id) : skipToken,
    meta: { persist: false },
  });

  const lista = planos.data ?? [];
  const casas = lista.filter((plano) => plano.kind === 'tem_casa');
  const precisam = lista.filter((plano) => plano.kind === 'procura');
  const meuPlano = lista.find((plano) => plano.isMine) ?? null;
  const lugaresLivres = casas
    .filter((casa) => casa.status === 'a_juntar')
    .reduce((soma, casa) => soma + Math.max(0, (casa.sparePlaces ?? 0) - casa.taken), 0);

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<StayKind>('tem_casa');
  const [valor, setValor] = useState('');
  const [noites, setNoites] = useState(2);
  const [lugares, setLugares] = useState(3);
  const [conviccao, setConviccao] = useState<StayCommitment>('se_houver');
  const [link, setLink] = useState('');
  const [nota, setNota] = useState('');
  const [aTratar, setATratar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [noitesPesquisa, setNoitesPesquisa] = useState<number | null>(null);
  const [pessoasPesquisa, setPessoasPesquisa] = useState<number | null>(null);
  const noitesUsadas = noitesPesquisa ?? meuPlano?.nights ?? 2;
  const pessoasUsadas = pessoasPesquisa ?? Math.min(6, Math.max(2, precisam.length + 1));

  const estadia = datasDaEstadia(jogo.inicio, noitesUsadas);
  const linkDePesquisa = linkAirbnb({
    cidade: estadio.cidade,
    pais: estadio.pais,
    estadia,
    pessoas: pessoasUsadas,
  });
  const centimos = lerPrecoEmCentimos(valor);

  function atualizar() {
    void queryClient.invalidateQueries({ queryKey: ['stays'] });
  }

  async function tratar(acao: () => Promise<void>) {
    setErro(null);
    setATratar(true);
    try {
      await acao();
      atualizar();
      return true;
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
      return false;
    } finally {
      setATratar(false);
    }
  }

  function abrirForm(comTipo: StayKind) {
    setTipo(comTipo);
    setValor(meuPlano?.totalCents ? String(Math.round(meuPlano.totalCents / 100)) : '');
    setNoites(meuPlano?.nights ?? 2);
    setLugares(meuPlano?.sparePlaces ?? 3);
    setConviccao(meuPlano?.commitment ?? 'se_houver');
    setLink(meuPlano?.listingUrl ?? '');
    setNota(meuPlano?.note ?? '');
    setErro(null);
    setAberto(true);
  }

  async function guardar() {
    if (tipo === 'tem_casa' && centimos === null) {
      setErro('Escreve quanto custa a casa ao todo, por exemplo 320.');
      return;
    }
    const guardado = await tratar(() =>
      setStayPlan(jogo.id, {
        kind: tipo,
        nights: noites,
        totalCents: tipo === 'tem_casa' ? centimos : null,
        sparePlaces: tipo === 'tem_casa' ? lugares : null,
        commitment: tipo === 'tem_casa' ? conviccao : null,
        listingUrl: tipo === 'tem_casa' ? link : null,
        note: nota,
      })
    );
    if (guardado) setAberto(false);
  }

  const precoPorPessoa = centimos !== null ? porPessoaNaCasa(centimos, 1 + lugares) : null;

  return (
    <Card style={styles.card}>
      <ThemedText themeColor="textSecondary">
        {`Jogo ${estadio.regiao === 'estrangeiro' ? 'fora do país' : 'numa ilha'}: quem vai dorme em ${estadio.cidade}. Quem encontrar uma casa propõe-na aqui, e a malta junta-se — quantos mais entram, menos cada um paga.`}
      </ThemedText>

      {lista.length > 0 ? (
        <ThemedText style={styles.destaque}>
          {[
            casas.length > 0 ? `${plural(casas.length, 'casa proposta', 'casas propostas')}` : null,
            lugaresLivres > 0 ? `${plural(lugaresLivres, 'lugar livre', 'lugares livres')}` : null,
            precisam.length > 0
              ? `${plural(precisam.length, 'adepto precisa', 'adeptos precisam')} de cama`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      ) : null}

      {casas.map((casa) => (
        <CasaProposta
          key={casa.id}
          casa={casa}
          aTratar={aTratar}
          onPedir={() => void tratar(() => requestStayPlace(casa.id))}
          onSair={() => void tratar(() => leaveStayPlace(casa.id))}
          onResponder={(profileId, aceitar) =>
            void tratar(() => answerStayPlace(casa.id, profileId, aceitar))
          }
          onReservar={(reservada) => void tratar(() => markStayHouse(casa.id, reservada))}
          onMudar={() => abrirForm('tem_casa')}
          onApagar={() => void tratar(() => removeStayPlan(jogo.id))}
        />
      ))}

      {precisam.length > 0 ? (
        <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            Precisam de cama
          </ThemedText>
          {precisam.map((pessoa) => (
            <ThemedText key={pessoa.id} type="small" themeColor="textSecondary">
              {`${pessoa.isMine ? 'Tu' : pessoa.displayName} · ${plural(pessoa.nights, 'noite', 'noites')}${pessoa.note ? ` · ${pessoa.note}` : ''}`}
            </ThemedText>
          ))}
        </View>
      ) : null}

      {/* O que tu vais fazer. */}
      <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          A tua ideia
        </ThemedText>
        {!userId ? (
          <LinkTexto
            label="Entra para propores uma casa ou pedires lugar"
            onPress={() => router.push('/conta/entrar')}
          />
        ) : aberto ? (
          <View style={styles.form}>
            <View style={styles.chips}>
              <Chip
                label="Proponho uma casa"
                selected={tipo === 'tem_casa'}
                emCartao
                onPress={() => setTipo('tem_casa')}
              />
              <Chip
                label="Só preciso de cama"
                selected={tipo === 'procura'}
                emCartao
                onPress={() => setTipo('procura')}
              />
            </View>

            {tipo === 'tem_casa' ? (
              <>
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
              </>
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

            {tipo === 'tem_casa' ? (
              <>
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
                <Campo
                  label="Link da casa no Airbnb (opcional)"
                  value={link}
                  onChangeText={setLink}
                  placeholder="https://www.airbnb.pt/rooms/…"
                  autoCapitalize="none"
                  maxLength={500}
                />
              </>
            ) : null}

            <Campo
              label="Alguma nota (opcional)"
              value={nota}
              onChangeText={setNota}
              placeholder={
                tipo === 'tem_casa'
                  ? 'Ex.: a 10 min do estádio, dois quartos e sofá-cama'
                  : 'Ex.: chego na véspera, saio no domingo'
              }
              maxLength={200}
            />
            {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
            <Button
              label={aTratar ? 'A guardar…' : 'Guardar'}
              disabled={aTratar}
              onPress={() => void guardar()}
            />
            <LinkTexto label="Deixa estar" onPress={() => setAberto(false)} />
          </View>
        ) : meuPlano && meuPlano.kind === 'procura' ? (
          <>
            <ThemedText>{`Disseste que precisas de cama, ${plural(meuPlano.nights, 'noite', 'noites')}.`}</ThemedText>
            <View style={styles.acoes}>
              <LinkTexto label="Propor uma casa" onPress={() => abrirForm('tem_casa')} />
              <LinkTexto
                label="Já não preciso"
                onPress={() => void tratar(() => removeStayPlan(jogo.id))}
              />
            </View>
          </>
        ) : meuPlano ? (
          <ThemedText type="small" themeColor="textSecondary">
            A tua casa está aí em cima. Podes mudá-la ou apagá-la lá.
          </ThemedText>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Viste uma casa que serve? Propõe-na. Ainda não viste nada? Diz que precisas de cama,
              para os outros saberem que há mais gente.
            </ThemedText>
            <View style={styles.chips}>
              <Chip
                label="Proponho uma casa"
                selected={false}
                emCartao
                onPress={() => abrirForm('tem_casa')}
              />
              <Chip
                label="Só preciso de cama"
                selected={false}
                emCartao
                onPress={() => abrirForm('procura')}
              />
            </View>
          </>
        )}
        {erro && !aberto ? (
          <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText>
        ) : null}
      </View>

      {/* Procurar casa: as noites e as pessoas são só para esta pesquisa. */}
      <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          Procurar casa
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`Para a pesquisa: ${plural(noitesUsadas, 'noite', 'noites')} para ${plural(pessoasUsadas, 'pessoa', 'pessoas')} · entrada a ${formatarData(new Date(estadia.checkin))}, saída a ${formatarData(new Date(estadia.checkout))}.`}
        </ThemedText>
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
        <ThemedText type="small" themeColor="textMuted">
          Abre a pesquisa com a cidade e as datas já preenchidas. Encontraste uma boa? Volta aqui e
          propõe-na à malta.
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  destaque: {
    fontWeight: 800,
  },
  bloco: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  casa: {
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    gap: Spacing.one,
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
});
