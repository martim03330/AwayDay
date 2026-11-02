import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { EscolherParagem, type ParagemEscolhida } from '@/features/casas/components/EscolherParagem';
import {
  LUGARES_POR_OMISSAO,
  NOMES_DOS_TRANSPORTES,
  instanteAntesDoJogo,
  lerHora,
  nomeDoTransporte,
  problemaDaViagem,
} from '@/features/casas/formulario';
import { useSupportersClub } from '@/features/casas/hooks/useCasas';
import { useCreateClubTrip } from '@/features/casas/hooks/useClubTrips';
import { mensagemDaGestao } from '@/features/casas/mensagens';
import type { ClubVehicleKind, NewClubTripVehicle } from '@/features/casas/types';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatarDiaCurto, formatarHora } from '@/lib/datas';
import { eJogoDosClubes } from '@/lib/jogos';
import { lerPrecoEmCentimos } from '@/lib/money';
import { vibrarErro, vibrarSucesso } from '@/lib/vibrar';
import { obterClube } from '@/mocks/clubes';
import { jogos } from '@/mocks/jogos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { CampoTexto } from '@/ui/campo-texto';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { EmptyState } from '@/ui/empty-state';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { LinhaGrupo } from '@/ui/linha-grupo';
import { LinkTexto } from '@/ui/link-texto';
import { MensagemErro } from '@/ui/mensagem-erro';
import { Quantidade } from '@/ui/quantidade';
import { SectionHeader } from '@/ui/section-header';
import { SkeletonCard } from '@/ui/skeleton';
import { ThemedText } from '@/ui/themed-text';

const TIPOS: ClubVehicleKind[] = ['autocarro', 'minibus', 'carrinha'];
const JOGOS_A_MOSTRAR = 8;
const MAXIMO_PARAGENS = 8;
const MAXIMO_TRANSPORTES = 10;

const PRAZOS = [
  { dias: 0, label: 'No dia do jogo' },
  { dias: 1, label: 'Na véspera' },
  { dias: 2, label: '2 dias antes' },
  { dias: 7, label: 'Uma semana antes' },
] as const;

/** «Porto x Benfica». */
function nomeDoJogo(casaId: string, foraId: string) {
  const casa = obterClube(casaId);
  const fora = obterClube(foraId);
  return casa && fora ? `${casa.nomeCurto} x ${fora.nomeCurto}` : null;
}

/**
 * A new trip of the Casa: the game (only its club's), name, price per person, the bookings deadline, «só sócios»,
 * the stops on a map and the vehicles. Times are typed in Lisbon and sent in UTC; the price in whole cents.
 */
export function NovaViagem({ casaId, onCriada }: { casaId: string; onCriada: (tripId: string) => void }) {
  const theme = useTheme();
  const agora = useNow(60 * 1000);
  const casa = useSupportersClub(casaId);
  const criar = useCreateClubTrip();
  const [jogoId, setJogoId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [diasDoPrazo, setDiasDoPrazo] = useState<number>(1);
  const [horaDoPrazo, setHoraDoPrazo] = useState('20:00');
  const [soSocios, setSoSocios] = useState(false);
  const [nota, setNota] = useState('');
  const [paragens, setParagens] = useState<ParagemEscolhida[]>([]);
  const [novaParagem, setNovaParagem] = useState(false);
  const [transportes, setTransportes] = useState<NewClubTripVehicle[]>([
    { kind: 'autocarro', label: nomeDoTransporte('autocarro', 1), seats: LUGARES_POR_OMISSAO.autocarro },
  ]);
  const [erro, setErro] = useState<string | null>(null);

  if (casa.isLoading) return <SkeletonCard lines={3} />;

  if (!casa.data || casa.data.myRole === null) {
    return (
      <EmptyState
        icon={icons.casa}
        title="Só para quem gere a Casa"
        message="Este ecrã não está disponível na tua conta."
      />
    );
  }

  if (casa.data.status !== 'verified') {
    return (
      <EmptyState
        icon={icons.casa}
        title="À espera de aprovação"
        message="Assim que confirmarmos a Casa, já podes publicar viagens."
      />
    );
  }

  const clubeId = casa.data.clubId;
  const proximos = jogos
    .filter((jogo) => eJogoDosClubes(jogo, [clubeId]) && Date.parse(jogo.inicio) > agora)
    .slice(0, JOGOS_A_MOSTRAR);
  const jogo = proximos.find((candidato) => candidato.id === jogoId) ?? null;

  function mudarTransporte(indice: number, mudanca: Partial<NewClubTripVehicle>) {
    setTransportes((atuais) =>
      atuais.map((transporte, outro) => (outro === indice ? { ...transporte, ...mudanca } : transporte))
    );
  }

  function acrescentarTransporte() {
    setTransportes((atuais) => [
      ...atuais,
      {
        kind: 'autocarro',
        label: nomeDoTransporte('autocarro', atuais.length + 1),
        seats: LUGARES_POR_OMISSAO.autocarro,
      },
    ]);
  }

  async function publicar() {
    if (!jogo) {
      setErro('Escolhe o jogo.');
      return;
    }
    const horaPrazo = lerHora(horaDoPrazo);
    const precoCentimos = lerPrecoEmCentimos(preco);
    const prazo = horaPrazo ? instanteAntesDoJogo(jogo.inicio, diasDoPrazo, horaPrazo) : null;
    const stops = paragens.map((paragem) => ({
      name: paragem.name,
      lat: paragem.latitude,
      lng: paragem.longitude,
      passesAt: instanteAntesDoJogo(jogo.inicio, paragem.diasAntes, paragem.hora),
    }));
    const problema = problemaDaViagem(
      {
        nome,
        precoCentimos,
        prazo,
        paragens: stops,
        transportes,
        kickoffAt: jogo.inicio,
      },
      agora
    );
    if (problema || precoCentimos === null || prazo === null) {
      setErro(problema);
      vibrarErro();
      return;
    }
    setErro(null);
    try {
      const tripId = await criar.mutateAsync({
        supportersClubId: casaId,
        fixtureId: jogo.id,
        name: nome.trim(),
        priceCents: precoCentimos,
        membersOnly: soSocios,
        bookingsCloseAt: prazo,
        note: nota.trim() === '' ? null : nota.trim(),
        stops,
        vehicles: transportes.map((transporte) => ({ ...transporte, label: transporte.label.trim() })),
      });
      vibrarSucesso();
      onCriada(tripId);
    } catch (falha) {
      vibrarErro();
      setErro(mensagemDaGestao(falha));
    }
  }

  return (
    <>
      <SectionHeader title="Jogo" />
      {proximos.length === 0 ? (
        <ThemedText themeColor="textSecondary">Não há jogos do clube marcados na app.</ThemedText>
      ) : (
        <Card style={styles.lista}>
          {proximos.map((candidato, indice) => {
            const titulo = nomeDoJogo(candidato.casaId, candidato.foraId) ?? 'Jogo';
            const escolhido = candidato.id === jogoId;
            return (
              <LinhaGrupo
                key={candidato.id}
                onPress={() => setJogoId(candidato.id)}
                accessibilityLabel={`${titulo}, ${formatarDiaCurto(new Date(candidato.inicio), agora)}${
                  escolhido ? ', escolhido' : ''
                }`}
                leading={<IconCircle name={icons.estadio} tone={escolhido ? 'green' : 'neutral'} />}
                title={titulo}
                valor={formatarDiaCurto(new Date(candidato.inicio), agora)}
                trailing={
                  escolhido ? <Icon name={icons.selecionado} size={18} color={theme.accentInk} /> : undefined
                }
                separador={indice < proximos.length - 1}
              />
            );
          })}
        </Card>
      )}

      <SectionHeader title="A viagem" />
      <Card style={styles.cartao}>
        <Campo
          label="Nome da viagem"
          value={nome}
          onChangeText={setNome}
          maxLength={60}
          placeholder="Ex.: Autocarro da sede"
        />
        <Campo
          label="Preço por pessoa (€)"
          value={preco}
          onChangeText={setPreco}
          maxLength={8}
          keyboardType="decimal-pad"
          placeholder="Ex.: 15"
          ajuda="0 se for gratuita."
        />
        <LinhaGrupo
          leading={<IconCircle name={icons.password} />}
          title="Só sócios"
          trailing={
            <Switch
              value={soSocios}
              onValueChange={setSoSocios}
              trackColor={{ true: theme.accent, false: theme.border }}
              thumbColor={theme.accentText}
              ios_backgroundColor={theme.border}
              accessibilityLabel="Só sócios"
            />
          }
        />
        {soSocios ? (
          <ThemedText type="small" themeColor="textSecondary">
            Quem se inscreve escreve o código de sócio da Casa. Vês o código no ecrã de gestão da viagem.
          </ThemedText>
        ) : null}
        <CampoTexto
          label="Nota (opcional)"
          value={nota}
          onChangeText={setNota}
          maxLength={300}
          placeholder="Ex.: Levem o cartão de sócio."
        />
      </Card>

      <SectionHeader title="Inscrições até" />
      <Card style={styles.cartao}>
        <View style={styles.chips}>
          {PRAZOS.map((prazo) => (
            <Chip
              key={prazo.dias}
              label={prazo.label}
              selected={diasDoPrazo === prazo.dias}
              emCartao
              onPress={() => setDiasDoPrazo(prazo.dias)}
            />
          ))}
        </View>
        <Campo
          label="Hora"
          value={horaDoPrazo}
          onChangeText={setHoraDoPrazo}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
          placeholder="Ex.: 20:00"
        />
      </Card>

      <SectionHeader title="Paragens" trailing={`${paragens.length}/${MAXIMO_PARAGENS}`} />
      {paragens.length > 0 ? (
        <Card style={styles.lista}>
          {paragens.map((paragem, indice) => (
            <LinhaGrupo
              key={`${paragem.name}-${indice}`}
              leading={<IconCircle name={icons.pontoEncontro} />}
              title={`${indice + 1}. ${paragem.name}`}
              valor={paragem.diasAntes > 0 ? `véspera, ${paragem.hora}` : paragem.hora}
              trailing={
                <LinkTexto
                  perigo
                  label="Tirar"
                  onPress={() => setParagens((atuais) => atuais.filter((_, outra) => outra !== indice))}
                />
              }
              separador={indice < paragens.length - 1}
            />
          ))}
        </Card>
      ) : null}
      {novaParagem ? (
        <EscolherParagem
          onAcrescentar={(paragem) => {
            setParagens((atuais) => [...atuais, paragem]);
            setNovaParagem(false);
          }}
          onCancelar={() => setNovaParagem(false)}
        />
      ) : paragens.length < MAXIMO_PARAGENS ? (
        <Button
          label="Acrescentar paragem"
          variant="secondary"
          icon={icons.pontoEncontro}
          onPress={() => setNovaParagem(true)}
        />
      ) : null}

      <SectionHeader title="Transportes" trailing={`${transportes.length}/${MAXIMO_TRANSPORTES}`} />
      {transportes.map((transporte, indice) => (
        <Card key={indice} style={styles.cartao}>
          <View style={styles.chips}>
            {TIPOS.map((tipo) => (
              <Chip
                key={tipo}
                label={NOMES_DOS_TRANSPORTES[tipo]}
                selected={transporte.kind === tipo}
                emCartao
                onPress={() =>
                  mudarTransporte(indice, {
                    kind: tipo,
                    label: nomeDoTransporte(tipo, indice + 1),
                    seats: LUGARES_POR_OMISSAO[tipo],
                  })
                }
              />
            ))}
          </View>
          <Campo
            label="Nome do transporte"
            value={transporte.label}
            onChangeText={(texto) => mudarTransporte(indice, { label: texto })}
            maxLength={40}
          />
          <Quantidade
            rotulo="Lugares"
            valor={transporte.seats}
            min={1}
            max={80}
            onChange={(seats) => mudarTransporte(indice, { seats })}
          />
          {transportes.length > 1 ? (
            <LinkTexto
              perigo
              label="Tirar este transporte"
              onPress={() => setTransportes((atuais) => atuais.filter((_, outro) => outro !== indice))}
            />
          ) : null}
        </Card>
      ))}
      {transportes.length < MAXIMO_TRANSPORTES ? (
        <Button
          label="Acrescentar transporte"
          variant="secondary"
          icon={icons.autocarro}
          onPress={acrescentarTransporte}
        />
      ) : null}

      {jogo ? (
        <ThemedText type="small" themeColor="textSecondary">
          {`O jogo começa às ${formatarHora(new Date(jogo.inicio))}, hora de Portugal continental.`}
        </ThemedText>
      ) : null}
      {erro ? <MensagemErro>{erro}</MensagemErro> : null}
      <Button
        label={criar.isPending ? 'A publicar…' : 'Publicar viagem'}
        icon={icons.autocarro}
        disabled={criar.isPending}
        onPress={() => void publicar()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  cartao: {
    gap: Spacing.three,
  },
  lista: {
    gap: 0,
    paddingVertical: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
