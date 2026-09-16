import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  fetchStayPlans,
  removeStayPlan,
  setStayPlan,
  StayRefused,
  type StayCommitment,
  type StayKind,
  type StayPlan,
} from '@/features/stays/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import { datasDaEstadia, linkAirbnb, medianaCentimos, totalDaEstadia } from '@/lib/dormida';
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
const LUGARES = [1, 2, 3, 4, 5, 6];
const PESSOAS_PESQUISA = [1, 2, 3, 4, 5, 6];

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof StayRefused)) return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  switch (erro.reason) {
    case 'bad_stay':
      return 'Escreve um valor por pessoa e por noite entre 3 € e 500 €.';
    case 'outside_window':
      return 'Este jogo já passou: não vale a pena tratar de dormida.';
    case 'rate_limited':
      return 'Já mudaste isto muitas vezes hoje. Volta amanhã.';
    case 'stay_not_needed':
      return 'Neste jogo ninguém precisa de dormir fora.';
    default:
      return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  }
}

/** Uma linha que diz o que cada um vai fazer, sem obrigar a ler tudo. */
function resumoDoPlano(plano: StayPlan) {
  if (plano.kind === 'tem_casa') {
    return `Já tem casa · ${plural(plano.sparePlaces ?? 0, 'lugar livre', 'lugares livres')} a ${formatarCentimos(plano.centsPerPerson)} por pessoa/noite`;
  }
  return `Procura casa · paga até ${formatarCentimos(plano.centsPerPerson)} por pessoa/noite · ${plural(plano.nights, 'noite', 'noites')}`;
}

function Convicao({ plano }: { plano: StayPlan }) {
  if (plano.kind === 'tem_casa') {
    return <Etiqueta icon={icons.casa} label="Já tem casa" tone="info" />;
  }
  return plano.commitment === 'certo' ? (
    <Etiqueta icon={icons.selecionado} label="Reserva de qualquer maneira" tone="positivo" />
  ) : (
    <Etiqueta icon={icons.perfil} label="Só se dividir com alguém" tone="aviso" />
  );
}

/**
 * Onde dormir, em jogos no estrangeiro e nas ilhas.
 *
 * Três coisas, por esta ordem: o que **tu** vais fazer (procuras casa e pagas até tanto, ou já tens casa com lugares
 * a sobrar), quem mais vai e com que convicção, e só depois a pesquisa no Airbnb. A app nunca guarda anúncios nem
 * disponibilidade: isso vê-se lá, sempre atual.
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
  const meuPlano = lista.find((plano) => plano.isMine) ?? null;
  const outros = lista.filter((plano) => !plano.isMine);
  const procuram = lista.filter((plano) => plano.kind === 'procura');
  const lugaresEmCasas = lista
    .filter((plano) => plano.kind === 'tem_casa')
    .reduce((soma, plano) => soma + (plano.sparePlaces ?? 0), 0);
  const orcamentoTipico = medianaCentimos(procuram.map((plano) => plano.centsPerPerson));

  // Form
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<StayKind>('procura');
  const [valor, setValor] = useState('');
  const [noites, setNoites] = useState(2);
  const [conviccao, setConviccao] = useState<StayCommitment>('se_houver');
  const [lugares, setLugares] = useState(2);
  const [nota, setNota] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pesquisa: começa pelas noites que tu escolheste e pela gente que já disse que procura casa.
  const [noitesPesquisa, setNoitesPesquisa] = useState<number | null>(null);
  const [pessoasPesquisa, setPessoasPesquisa] = useState<number | null>(null);
  const noitesUsadas = noitesPesquisa ?? meuPlano?.nights ?? 2;
  const pessoasUsadas = pessoasPesquisa ?? Math.min(6, Math.max(2, procuram.length || 2));

  const estadia = datasDaEstadia(jogo.inicio, noitesUsadas);
  const link = linkAirbnb({
    cidade: estadio.cidade,
    pais: estadio.pais,
    estadia,
    pessoas: pessoasUsadas,
  });
  const centimos = lerPrecoEmCentimos(valor);

  function abrirForm(comTipo: StayKind) {
    setTipo(comTipo);
    setValor(meuPlano ? String(Math.round(meuPlano.centsPerPerson / 100)) : '');
    setNoites(meuPlano?.nights ?? 2);
    setConviccao(meuPlano?.commitment ?? 'se_houver');
    setLugares(meuPlano?.sparePlaces ?? 2);
    setNota(meuPlano?.note ?? '');
    setErro(null);
    setAberto(true);
  }

  function atualizar() {
    void queryClient.invalidateQueries({ queryKey: ['stays', jogo.id] });
  }

  async function guardar() {
    if (centimos === null) {
      setErro('Escreve um valor por pessoa e por noite, por exemplo 35.');
      return;
    }
    setErro(null);
    setAGuardar(true);
    try {
      await setStayPlan(jogo.id, {
        kind: tipo,
        centsPerPerson: centimos,
        nights: noites,
        commitment: tipo === 'procura' ? conviccao : null,
        sparePlaces: tipo === 'tem_casa' ? lugares : null,
        note: nota,
      });
      setAberto(false);
      atualizar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setAGuardar(false);
    }
  }

  async function apagar() {
    setErro(null);
    try {
      await removeStayPlan(jogo.id);
      atualizar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    }
  }

  return (
    <Card style={styles.card}>
      <ThemedText themeColor="textSecondary">
        {`Jogo ${estadio.regiao === 'estrangeiro' ? 'fora do país' : 'numa ilha'}: quem vai dorme em ${estadio.cidade}. Digam aqui o que pensam gastar e juntem-se para dividir casa.`}
      </ThemedText>

      {lista.length > 0 ? (
        <ThemedText style={styles.destaque}>
          {[
            procuram.length > 0
              ? `${plural(procuram.length, 'adepto procura', 'adeptos procuram')} casa`
              : null,
            orcamentoTipico !== null
              ? `orçamento típico ${formatarCentimos(orcamentoTipico)} por pessoa/noite`
              : null,
            lugaresEmCasas > 0
              ? `${plural(lugaresEmCasas, 'lugar livre', 'lugares livres')} em casas já tratadas`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </ThemedText>
      ) : null}

      {/* 1. O que tu vais fazer. */}
      <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
        <ThemedText type="eyebrow" themeColor="accentInk">
          A tua ideia
        </ThemedText>
        {!userId ? (
          <LinkTexto
            label="Entra para dizeres o que pensas gastar"
            onPress={() => router.push('/conta/entrar')}
          />
        ) : aberto ? (
          <View style={styles.form}>
            <View style={styles.chips}>
              <Chip
                label="Procuro casa"
                selected={tipo === 'procura'}
                emCartao
                onPress={() => setTipo('procura')}
              />
              <Chip
                label="Já tenho casa"
                selected={tipo === 'tem_casa'}
                emCartao
                onPress={() => setTipo('tem_casa')}
              />
            </View>

            <Campo
              label={
                tipo === 'procura'
                  ? 'Até quanto pagas, por pessoa e por noite'
                  : 'Quanto fica a cada um, por noite'
              }
              value={valor}
              onChangeText={setValor}
              placeholder="Ex.: 35"
              keyboardType="decimal-pad"
              erro={valor && centimos === null ? 'Escreve um valor como 35 ou 35,50' : null}
            />

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

            {tipo === 'procura' ? (
              <>
                <ThemedText style={styles.rotulo}>E se não aparecer ninguém?</ThemedText>
                <View style={styles.chips}>
                  <Chip
                    label="Reservo à mesma"
                    selected={conviccao === 'certo'}
                    emCartao
                    onPress={() => setConviccao('certo')}
                  />
                  <Chip
                    label="Só se dividirmos"
                    selected={conviccao === 'se_houver'}
                    emCartao
                    onPress={() => setConviccao('se_houver')}
                  />
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {conviccao === 'certo'
                    ? 'Os outros ficam a saber que podem contar contigo, apareça quem aparecer.'
                    : 'Fica claro que só avanças se houver com quem dividir.'}
                </ThemedText>
              </>
            ) : (
              <>
                <ThemedText style={styles.rotulo}>Lugares que sobram</ThemedText>
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
              </>
            )}

            <Campo
              label="Alguma nota (opcional)"
              value={nota}
              onChangeText={setNota}
              placeholder={
                tipo === 'procura'
                  ? 'Ex.: chego na véspera, saio no domingo à tarde'
                  : 'Ex.: a 10 min do estádio, dois quartos e sofá-cama'
              }
              maxLength={200}
            />
            {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
            <Button
              label={aGuardar ? 'A guardar…' : 'Guardar'}
              disabled={aGuardar}
              onPress={() => void guardar()}
            />
            <LinkTexto label="Deixa estar" onPress={() => setAberto(false)} />
          </View>
        ) : meuPlano ? (
          <>
            <ThemedText>{resumoDoPlano(meuPlano)}</ThemedText>
            <Convicao plano={meuPlano} />
            {meuPlano.note ? (
              <ThemedText type="small" themeColor="textSecondary">
                {meuPlano.note}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textMuted">
              {`${plural(meuPlano.nights, 'noite', 'noites')} · ${formatarCentimos(totalDaEstadia(meuPlano.centsPerPerson, meuPlano.nights))} no total, por pessoa`}
            </ThemedText>
            <View style={styles.acoes}>
              <LinkTexto label="Mudar" onPress={() => abrirForm(meuPlano.kind)} />
              <LinkTexto label="Já não preciso" onPress={() => void apagar()} />
            </View>
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Diz o que pensas gastar. Serve para a malta se juntar e dividir uma casa.
            </ThemedText>
            <View style={styles.chips}>
              <Chip
                label="Procuro casa"
                selected={false}
                emCartao
                onPress={() => abrirForm('procura')}
              />
              <Chip
                label="Já tenho casa"
                selected={false}
                emCartao
                onPress={() => abrirForm('tem_casa')}
              />
            </View>
          </>
        )}
        {erro && !aberto ? (
          <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText>
        ) : null}
      </View>

      {/* 2. Quem mais vai. */}
      {outros.length > 0 ? (
        <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
          <ThemedText type="eyebrow" themeColor="accentInk">
            {plural(outros.length, 'adepto', 'adeptos')}
          </ThemedText>
          {outros.map((plano) => (
            <View key={plano.id} style={[styles.pessoa, { borderColor: theme.border }]}>
              <ThemedText style={styles.nome} numberOfLines={1}>
                {plano.displayName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {resumoDoPlano(plano)}
              </ThemedText>
              <Convicao plano={plano} />
              {plano.note ? <ThemedText type="small">{plano.note}</ThemedText> : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* 3. Procurar casa. As noites e as pessoas são só para esta pesquisa. */}
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
          onPress={() => void Linking.openURL(link).catch(() => undefined)}
        />
        <ThemedText type="small" themeColor="textMuted">
          Abre a pesquisa do Airbnb com a cidade e as datas já preenchidas: o que estiver disponível
          é o que aparece lá. A app não guarda anúncios nem preços de casas.
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
  pessoa: {
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  nome: {
    fontWeight: 700,
  },
});
