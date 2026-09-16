import { skipToken, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import {
  corDoNivel,
  MedidorBarulho,
  MostradorBarulho,
  tintaDoNivel,
} from '@/components/medidor-barulho';
import { Spacing } from '@/constants/theme';
import { useNoiseRanking } from '@/features/presence/hooks/usePresence';
import { fetchMyStamps } from '@/features/stamps/api';
import { useTheme } from '@/hooks/use-theme';
import {
  degrauDoNivel,
  ESCALA_BARULHO,
  estadoDoBarulhometro,
  melhorMedicao,
  rankingBarulho,
} from '@/lib/barulhometro';
import { useUserId } from '@/lib/session';
import { medicoesAdeptosMock } from '@/mocks/barulhometro';
import { obterClube } from '@/mocks/clubes';
import { obterLocal } from '@/mocks/locais';
import type { Jogo } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';
import { Aviso } from '@/ui/aviso';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { Icon, IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

const MINUTO_MS = 60 * 1000;
/** Gold for first place, as in the design's leaderboards. */
const OURO = '#B07A00';

type BarulhometroCardProps = {
  jogo: Jogo;
  agora: number;
};

function ResultadoNivel({ nivel }: { nivel: number }) {
  const degrau = degrauDoNivel(nivel);
  return (
    <View
      style={styles.resultado}
      accessible
      accessibilityLabel={`A tua melhor medição neste jogo: ${nivel} em 100, ${degrau.nome}. ${degrau.frase}`}>
      <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.centro}>
        A tua melhor medição neste jogo
      </ThemedText>
      <MostradorBarulho nivel={nivel} />
      <ThemedText type="score" style={styles.numero}>
        {nivel}
      </ThemedText>
      <View style={styles.linhaDegrau}>
        <Icon name={degrau.icone} size={26} color={tintaDoNivel(nivel)} />
        <ThemedText type="title" style={styles.nomeDegrau}>
          {degrau.nome}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary" style={[styles.frase, styles.centro]}>
        {degrau.frase}
      </ThemedText>
    </View>
  );
}

function EscalaBarulho({ nivelAtual }: { nivelAtual: number | null }) {
  const theme = useTheme();
  const atual = nivelAtual === null ? null : degrauDoNivel(nivelAtual);
  const degraus = [...ESCALA_BARULHO].reverse();

  return (
    <Card style={styles.escala}>
      {degraus.map((degrau, indice) => {
        const eAtual = degrau === atual;
        return (
          <View
            key={degrau.minimo}
            accessible
            accessibilityLabel={`${degrau.minimo} ou mais: ${degrau.nome}. ${degrau.frase}${eAtual ? ' O teu nível.' : ''}`}
            style={[
              styles.degrau,
              indice < degraus.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: theme.backgroundSelected,
              },
              eAtual && [styles.degrauAtual, { backgroundColor: theme.warningBackground }],
            ]}>
            <View style={[styles.barraDegrau, { backgroundColor: corDoNivel(degrau.minimo) }]} />
            <ThemedText type="score" style={styles.minimo}>
              {`${degrau.minimo}+`}
            </ThemedText>
            <Icon name={degrau.icone} size={20} color={tintaDoNivel(degrau.minimo)} />
            <View style={styles.flex}>
              <ThemedText style={styles.nomeEscala}>{degrau.nome}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.fraseEscala}>
                {degrau.frase}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export function BarulhometroCard({ jogo, agora }: BarulhometroCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const { desvioMs } = useRelogio();
  const { visitasLocais, medicoesBarulho, registarMedicao, clubeFavoritoId, fonte } = useAppState();
  const userId = useUserId();
  const rankingDaConta = useNoiseRanking(fonte === 'conta' ? userId : null, jogo.id);

  // Carimbar o estádio já prova que lá estás: não é preciso ter passado por um tasco.
  const carimbos = useQuery({
    queryKey: ['stamps', userId],
    queryFn: userId ? fetchMyStamps : skipToken,
    meta: { persist: false },
  });
  const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon' }).format(new Date());
  const carimbou = (carimbos.data ?? []).some(
    (carimbo) => carimbo.venueId === jogo.estadioId && carimbo.lastVisit === hoje
  );

  const estado = estadoDoBarulhometro({
    jogo,
    agora,
    visitas: visitasLocais,
    obterLocal,
    medicoes: medicoesBarulho,
    carimbou,
  });
  const melhor = melhorMedicao(jogo.id, medicoesBarulho);
  // Demo: sample fans. With an account: the server's ranking (others only if they opted in). Without: just you.
  const ranking =
    fonte === 'conta' && rankingDaConta.data
      ? rankingDaConta.data.map((linha) => ({
          id: linha.isMe ? 'tu' : `adepto-${linha.position}`,
          nome: linha.isMe ? 'Tu' : linha.displayName,
          clubeId: linha.isMe ? clubeFavoritoId : linha.clubId,
          nivel: linha.value,
          eTu: linha.isMe,
          posicao: linha.position,
        }))
      : rankingBarulho(jogo, fonte === 'demo' ? medicoesAdeptosMock : [], {
          clubeId: clubeFavoritoId,
          nivel: melhor,
        });

  function registar(nivel: number) {
    void registarMedicao({
      jogoId: jogo.id,
      estadioId: jogo.estadioId,
      medidaEm: new Date(Date.now() + desvioMs).toISOString(),
      nivel,
    }).then((resultado) => {
      if (resultado === 'cedo-demais') {
        Alert.alert(
          'Ainda é cedo',
          'Só dá para medir outra vez uns minutos depois da última medição.'
        );
      } else if (resultado === 'fora-do-jogo') {
        Alert.alert('O jogo não está a decorrer', 'Só contam medições feitas durante o jogo.');
      } else if (resultado === 'sem-presenca') {
        Alert.alert(
          'Falta provar que estás lá',
          'Carimba o estádio aqui no jogo, ou faz check-in num tasco perto. Sem isso, a medição não conta.'
        );
      } else if (resultado === 'erro') {
        Alert.alert('Não deu para guardar', 'Verifica a ligação e tenta outra vez.');
      }
    });
  }

  return (
    <>
      <Card style={styles.card}>
        {melhor !== null ? <ResultadoNivel nivel={melhor} /> : null}

        {estado.tipo === 'antes' ? (
          <ListRow
            leading={<IconCircle name={icons.microfone} />}
            title="Abre com o apito inicial"
            subtitle="Durante o jogo, ouve a bancada 10 segundos e vê até onde chega o barulho."
          />
        ) : null}

        {estado.tipo === 'sem-presenca' ? (
          <>
            <ListRow
              leading={<IconCircle name={icons.checkIn} tone="yellow" />}
              title="Primeiro, prova que estás lá"
              subtitle="Carimba o estádio no cartão aqui em cima, ou faz check-in num tasco perto. É o que impede que se meça o barulho do sofá."
            />
            <Button
              label="Ver tascos perto"
              variant="secondary"
              icon={icons.locais}
              onPress={() =>
                router.navigate({ pathname: '/locais', params: { estadio: jogo.estadioId } })
              }
            />
          </>
        ) : null}

        {estado.tipo === 'espera' ? (
          <>
            <Aviso
              tone="sucesso"
              title="Medição registada"
              message={`Próxima daqui a ${Math.max(1, Math.ceil((estado.disponivelEm - agora) / MINUTO_MS))} min. Assim ninguém mede até sair o número que quer.`}
            />
            <Button
              label="Medir o barulho (10 s)"
              icon={icons.microfone}
              disabled
              onPress={() => {}}
            />
          </>
        ) : null}

        {estado.tipo === 'pode-medir' ? <MedidorBarulho onMedicaoValida={registar} /> : null}
      </Card>

      {estado.tipo !== 'antes' ? (
        <>
          <SectionHeader title="A escala" />
          <EscalaBarulho nivelAtual={melhor} />

          <SectionHeader title="Os mais barulhentos neste jogo" />
          {ranking.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              Ainda ninguém mediu o barulho neste jogo.
            </ThemedText>
          ) : null}
          <Card style={[styles.ranking, ranking.length === 0 && styles.escondido]}>
            {ranking.map((entrada) => {
              const clube = entrada.clubeId ? obterClube(entrada.clubeId) : undefined;
              return (
                <View
                  key={entrada.id}
                  accessible
                  accessibilityLabel={`${entrada.posicao}.º lugar, ${entrada.eTu ? 'tu' : entrada.nome}, nível ${entrada.nivel}`}
                  style={[
                    styles.linha,
                    entrada.eTu && { backgroundColor: theme.warningBackground },
                  ]}>
                  <ThemedText
                    type="score"
                    style={[
                      styles.posicao,
                      {
                        color: entrada.eTu
                          ? theme.warning
                          : entrada.posicao === 1
                            ? OURO
                            : theme.textMuted,
                      },
                    ]}>
                    {entrada.posicao}
                  </ThemedText>
                  {clube ? <Escudo clube={clube} size={22} /> : null}
                  <ThemedText
                    style={[styles.flex, styles.nome, entrada.eTu && styles.nomeTu]}
                    numberOfLines={1}>
                    {entrada.nome}
                  </ThemedText>
                  <ThemedText type="score" style={styles.nivelRanking}>
                    {entrada.nivel}
                  </ThemedText>
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      <ThemedText themeColor="textMuted" style={[styles.privacidade, styles.centro]}>
        {`O som não é gravado nem guardado: só fica o número. A escala é relativa, não são decibéis. ${
          fonte === 'demo'
            ? 'Os outros adeptos são fictícios na demo.'
            : fonte === 'conta'
              ? 'No ranking só aparecem adeptos que aceitaram mostrar o nome.'
              : 'Cria conta para entrares no ranking com os outros adeptos.'
        }`}
      </ThemedText>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    paddingVertical: 20,
  },
  escondido: {
    display: 'none',
  },
  resultado: {
    alignItems: 'center',
    gap: 6,
  },
  centro: {
    textAlign: 'center',
  },
  numero: {
    fontSize: 80,
    lineHeight: 86,
    fontVariant: ['tabular-nums'],
  },
  linhaDegrau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nomeDegrau: {
    flexShrink: 1,
    fontSize: 36,
    lineHeight: 40,
  },
  frase: {
    fontSize: 15,
    lineHeight: 21,
  },
  flex: {
    flex: 1,
  },
  escala: {
    gap: 0,
    paddingVertical: 6,
  },
  degrau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  degrauAtual: {
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  barraDegrau: {
    width: 12,
    height: 32,
    borderRadius: 6,
  },
  minimo: {
    width: 40,
    fontSize: 18,
    lineHeight: 22,
  },
  nomeEscala: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: 800,
  },
  fraseEscala: {
    fontSize: 12,
    lineHeight: 16,
  },
  ranking: {
    gap: 2,
    padding: Spacing.two,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  posicao: {
    minWidth: 18,
    fontSize: 20,
    lineHeight: 24,
  },
  nome: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 700,
  },
  nomeTu: {
    fontWeight: 800,
  },
  nivelRanking: {
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  privacidade: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 12,
  },
});
