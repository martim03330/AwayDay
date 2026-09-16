import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { denyStay, fetchStays, reportStay, StayRefused } from '@/features/stays/api';
import { useTheme } from '@/hooks/use-theme';
import { formatarData } from '@/lib/datas';
import {
  datasDaEstadia,
  linkAirbnb,
  medianaCentimos,
  porPessoaPorNoite,
  totalDaEstadia,
} from '@/lib/dormida';
import { plural } from '@/lib/formatos';
import { formatarCentimos, lerPrecoEmCentimos } from '@/lib/money';
import { useUserId } from '@/lib/session';
import type { Jogo, Venue } from '@/mocks/tipos';
import { Button } from '@/ui/button';
import { Campo } from '@/ui/campo';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const NOITES = [1, 2, 3];
const PESSOAS = [1, 2, 3, 4, 5, 6];

function mensagemDeRecusa(erro: unknown) {
  if (!(erro instanceof StayRefused)) return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  switch (erro.reason) {
    case 'bad_stay':
      return 'Escreve um preço por noite entre 5 € e 1000 €, e quantas pessoas e noites foram.';
    case 'outside_window':
      return 'Este jogo já vai longe: os preços só valem desde uns meses antes até uns dias depois.';
    case 'own_report':
      return 'Este relato é teu. Para o mudar, corrige o preço.';
    case 'rate_limited':
      return 'Já escreveste muita coisa hoje. Volta amanhã.';
    default:
      return 'Não deu para guardar. Tenta outra vez daqui a pouco.';
  }
}

/**
 * Dormir fora, em jogos no estrangeiro e nas ilhas.
 *
 * O botão abre uma *pesquisa* no Airbnb com a cidade, as datas do jogo e as pessoas já preenchidas: o que aparece lá
 * é o que está mesmo disponível naquele momento. Os preços aqui em baixo são o que adeptos disseram ter pago, com o
 * nome e a data — nunca uma promessa de que ainda há casa por esse valor.
 */
export function DormidaCard({ jogo, estadio }: { jogo: Jogo; estadio: Venue }) {
  const theme = useTheme();
  const router = useRouter();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const [noites, setNoites] = useState(2);
  const [pessoas, setPessoas] = useState(2);
  const [formAberto, setFormAberto] = useState(false);
  const [preco, setPreco] = useState('');
  const [nota, setNota] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const relatos = useQuery({
    queryKey: ['stays', jogo.id],
    queryFn: userId ? () => fetchStays(jogo.id) : skipToken,
    meta: { persist: false },
  });

  const estadia = datasDaEstadia(jogo.inicio, noites);
  const link = linkAirbnb({ cidade: estadio.cidade, pais: estadio.pais, estadia, pessoas });
  const lista = relatos.data ?? [];
  const mediana = medianaCentimos(
    lista.map((relato) => porPessoaPorNoite(relato.centsPerNight, relato.people))
  );
  const meuRelato = lista.find((relato) => relato.isMine);
  const centimos = lerPrecoEmCentimos(preco);

  function atualizar() {
    void queryClient.invalidateQueries({ queryKey: ['stays', jogo.id] });
  }

  async function guardar() {
    if (centimos === null) {
      setErro('Escreve o preço por noite, por exemplo 85 ou 85,50.');
      return;
    }
    setErro(null);
    setAGuardar(true);
    try {
      await reportStay(jogo.id, {
        centsPerNight: centimos,
        people: pessoas,
        nights: noites,
        note: nota,
      });
      setFormAberto(false);
      setPreco('');
      setNota('');
      atualizar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    } finally {
      setAGuardar(false);
    }
  }

  async function desmentir(reportId: string) {
    setErro(null);
    try {
      await denyStay(reportId);
      atualizar();
    } catch (problema) {
      setErro(mensagemDeRecusa(problema));
    }
  }

  return (
    <Card style={styles.card}>
      <ThemedText themeColor="textSecondary">
        {`Jogo ${estadio.regiao === 'estrangeiro' ? 'fora do país' : 'numa ilha'}: a malta dorme em ${estadio.cidade}. Reservar cedo é onde se poupa mesmo.`}
      </ThemedText>

      <View>
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
      </View>

      <View>
        <ThemedText style={styles.rotulo}>Quantos vão</ThemedText>
        <View style={styles.chips}>
          {PESSOAS.map((numero) => (
            <Chip
              key={numero}
              label={String(numero)}
              selected={numero === pessoas}
              emCartao
              onPress={() => setPessoas(numero)}
            />
          ))}
        </View>
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {`Entrada a ${formatarData(new Date(estadia.checkin))}, saída a ${formatarData(new Date(estadia.checkout))}.`}
      </ThemedText>

      <Button
        label="Procurar casa no Airbnb"
        icon={icons.casa}
        onPress={() => void Linking.openURL(link).catch(() => undefined)}
      />

      {mediana !== null ? (
        <ThemedText style={styles.destaque}>
          {`Mediana: ${formatarCentimos(mediana)} por pessoa e por noite (${plural(lista.length, 'relato', 'relatos')})`}
        </ThemedText>
      ) : null}

      {lista.length > 0 ? (
        <View style={styles.relatos}>
          {lista.map((relato) => (
            <View key={relato.id} style={[styles.relato, { borderColor: theme.border }]}>
              <View style={styles.linha}>
                <ThemedText style={styles.nome} numberOfLines={1}>
                  {relato.isMine ? 'Tu' : relato.displayName}
                </ThemedText>
                <ThemedText style={styles.preco}>
                  {`${formatarCentimos(relato.centsPerNight)}/noite`}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {`${formatarCentimos(porPessoaPorNoite(relato.centsPerNight, relato.people))} por pessoa · ${plural(relato.people, 'pessoa', 'pessoas')} · ${plural(relato.nights, 'noite', 'noites')} · total ${formatarCentimos(totalDaEstadia(relato.centsPerNight, relato.nights))}`}
              </ThemedText>
              {relato.note ? <ThemedText>{relato.note}</ThemedText> : null}
              <View style={styles.linhaAcoes}>
                <ThemedText type="small" themeColor="textMuted">
                  {`Dito a ${formatarData(new Date(relato.reportedOn))}`}
                </ThemedText>
                {!relato.isMine && !relato.deniedByMe && userId ? (
                  <LinkTexto
                    label="Já não encontro assim"
                    onPress={() => void desmentir(relato.id)}
                  />
                ) : null}
                {relato.deniedByMe ? (
                  <ThemedText type="small" themeColor="textMuted">
                    Disseste que já não está
                  </ThemedText>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!userId ? (
        <LinkTexto
          label="Entra para dizer quanto pagaste"
          onPress={() => router.push('/conta/entrar')}
        />
      ) : formAberto ? (
        <View style={styles.form}>
          <Campo
            label="Preço por noite (a casa toda)"
            value={preco}
            onChangeText={setPreco}
            placeholder="Ex.: 85"
            keyboardType="decimal-pad"
            erro={preco && centimos === null ? 'Escreve um preço como 85 ou 85,50' : null}
          />
          <Campo
            label="Alguma dica (opcional)"
            value={nota}
            onChangeText={setNota}
            placeholder="Ex.: a 10 min do estádio, cozinha e máquina de lavar"
            maxLength={200}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Fica com o teu nome e a data. Serve de referência a quem vier a seguir, não é uma
            reserva.
          </ThemedText>
          {erro ? <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText> : null}
          <Button
            label={aGuardar ? 'A guardar…' : 'Guardar'}
            disabled={aGuardar}
            onPress={() => void guardar()}
          />
          <LinkTexto label="Deixa estar" onPress={() => setFormAberto(false)} />
        </View>
      ) : (
        <LinkTexto
          label={meuRelato ? 'Corrigir o que paguei' : 'Dizer quanto paguei'}
          onPress={() => setFormAberto(true)}
        />
      )}

      {erro && !formAberto ? (
        <ThemedText style={{ color: theme.dangerText }}>{erro}</ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textMuted">
        O botão abre uma pesquisa no Airbnb: o que estiver disponível é o que aparece lá. Os preços
        aqui são o que os adeptos disseram ter pago, com a data — podem já não existir.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  rotulo: {
    fontWeight: 700,
    marginBottom: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  destaque: {
    fontWeight: 800,
  },
  relatos: {
    gap: Spacing.two,
  },
  relato: {
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  linhaAcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  nome: {
    flex: 1,
    fontWeight: 700,
  },
  preco: {
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  form: {
    gap: Spacing.two,
  },
});
