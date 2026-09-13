import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MedidorBarulho } from '@/components/medidor-barulho';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  degrauDoNivel,
  estadoDoBarulhometro,
  melhorMedicao,
  rankingBarulho,
} from '@/lib/barulhometro';
import { medicoesAdeptosMock } from '@/mocks/barulhometro';
import { obterClube } from '@/mocks/clubes';
import { obterLocal } from '@/mocks/locais';
import type { Jogo } from '@/mocks/tipos';
import { useAppState } from '@/state/app-state';
import { useRelogio } from '@/state/relogio';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Escudo } from '@/ui/escudo';
import { IconCircle, icons } from '@/ui/icon';
import { ListRow } from '@/ui/list-row';
import { ProgressBar } from '@/ui/progress-bar';
import { ThemedText } from '@/ui/themed-text';

const MINUTO_MS = 60 * 1000;

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
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rotulo}>
        A tua melhor medição neste jogo
      </ThemedText>
      <View style={styles.linhaNivel}>
        <ThemedText style={styles.numero}>{nivel}</ThemedText>
        <View style={styles.flex}>
          <ThemedText type="smallBold">{`${degrau.emoji} ${degrau.nome}`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {degrau.frase}
          </ThemedText>
        </View>
      </View>
      <ProgressBar progress={nivel / 100} />
    </View>
  );
}

export function BarulhometroCard({ jogo, agora }: BarulhometroCardProps) {
  const router = useRouter();
  const theme = useTheme();
  const { desvioMs } = useRelogio();
  const { visitasLocais, medicoesBarulho, registarMedicao, clubeFavoritoId } = useAppState();

  const estado = estadoDoBarulhometro({
    jogo,
    agora,
    visitas: visitasLocais,
    obterLocal,
    medicoes: medicoesBarulho,
  });
  const melhor = melhorMedicao(jogo.id, medicoesBarulho);
  const ranking = rankingBarulho(jogo, medicoesAdeptosMock, { clubeId: clubeFavoritoId, nivel: melhor });

  function registar(nivel: number) {
    registarMedicao({
      jogoId: jogo.id,
      estadioId: jogo.estadioId,
      medidaEm: new Date(Date.now() + desvioMs).toISOString(),
      nivel,
    });
  }

  return (
    <Card style={styles.card}>
      {melhor !== null ? <ResultadoNivel nivel={melhor} /> : null}

      {estado.tipo === 'antes' ? (
        <ListRow
          leading={<IconCircle name={icons.microfone} />}
          title="Abre com o apito inicial"
          subtitle="Durante o jogo, ouve a bancada 10 segundos e vê até onde chega o barulho."
        />
      ) : null}

      {estado.tipo === 'sem-check-in' ? (
        <>
          <ListRow
            leading={<IconCircle name={icons.checkIn} />}
            title="Falta o check-in"
            subtitle="Para a medição contar, faz check-in hoje num tasco perto do estádio."
          />
          <Button
            label="Ver tascos perto"
            variant="secondary"
            icon={icons.locais}
            onPress={() => router.navigate({ pathname: '/locais', params: { estadio: jogo.estadioId } })}
          />
        </>
      ) : null}

      {estado.tipo === 'espera' ? (
        <ListRow
          leading={<IconCircle name={icons.horario} />}
          title="Medição registada"
          subtitle={`Próxima daqui a ${Math.max(1, Math.ceil((estado.disponivelEm - agora) / MINUTO_MS))} min. Assim ninguém mede até sair o número que quer.`}
        />
      ) : null}

      {estado.tipo === 'pode-medir' ? <MedidorBarulho onMedicaoValida={registar} /> : null}

      {estado.tipo !== 'antes' ? (
        <View style={styles.ranking}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rotulo}>
            Os mais barulhentos neste jogo
          </ThemedText>
          {ranking.map((entrada) => {
            const clube = obterClube(entrada.clubeId);
            return (
              <View
                key={entrada.id}
                accessible
                accessibilityLabel={`${entrada.posicao}.º lugar, ${entrada.eTu ? 'tu' : entrada.nome}, nível ${entrada.nivel}`}
                style={[styles.linha, entrada.eTu && { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.posicao}>
                  {entrada.posicao}.
                </ThemedText>
                {clube ? <Escudo clube={clube} size={22} /> : null}
                <ThemedText
                  type={entrada.eTu ? 'smallBold' : 'small'}
                  style={styles.flex}
                  numberOfLines={1}>
                  {entrada.nome}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.nivelRanking}>
                  {entrada.nivel}
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary">
        O som não é gravado nem guardado: só fica o número. A escala é relativa, não são decibéis. Os
        outros adeptos são fictícios na demo.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  resultado: {
    gap: Spacing.two,
  },
  rotulo: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linhaNivel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  numero: {
    fontSize: 44,
    lineHeight: 50,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  flex: {
    flex: 1,
  },
  ranking: {
    gap: Spacing.one,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
  },
  posicao: {
    width: 24,
  },
  nivelRanking: {
    fontVariant: ['tabular-nums'],
  },
});
