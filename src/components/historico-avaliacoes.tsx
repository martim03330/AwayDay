import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDia } from '@/lib/datas';
import { formatarNota } from '@/lib/formatos';
import { notaMedia } from '@/lib/jogos';
import { obterClube } from '@/mocks/clubes';
import { obterEstadio } from '@/mocks/estadios';
import { obterJogo } from '@/mocks/jogos';
import type { AvaliacaoVisita } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Escudo } from '@/ui/escudo';
import { icons } from '@/ui/icon';
import { ThemedText } from '@/ui/themed-text';

type HistoricoAvaliacoesProps = {
  avaliacoes: readonly AvaliacaoVisita[];
  onEditar: (jogoId: string) => void;
};

/** Todas as visitas avaliadas, da mais recente para a mais antiga; tocar abre a edição. */
export function HistoricoAvaliacoes({ avaliacoes, onEditar }: HistoricoAvaliacoesProps) {
  const theme = useTheme();

  if (avaliacoes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={icons.estrela}
          title="Ainda não deste nota a nenhuma bancada"
          message="Depois do apito final, dá nota ao estádio, ao ambiente e aos acessos."
        />
      </Card>
    );
  }

  const ordenadas = [...avaliacoes].sort((a, b) => b.dataVisita.localeCompare(a.dataVisita));

  return (
    <>
      {ordenadas.map((avaliacao) => {
        const jogo = obterJogo(avaliacao.jogoId);
        const casa = jogo ? obterClube(jogo.casaId) : undefined;
        const fora = jogo ? obterClube(jogo.foraId) : undefined;
        if (!casa || !fora) return null;

        const estadio = obterEstadio(avaliacao.estadioId);
        const dia = formatarDia(new Date(avaliacao.dataVisita));
        const media = formatarNota(notaMedia(avaliacao));

        return (
          <Card
            key={avaliacao.id}
            onPress={() => onEditar(avaliacao.jogoId)}
            accessibilityLabel={`${estadio?.nome ?? 'Estádio'}, visita de ${dia}, ${casa.nomeCurto} contra ${fora.nomeCurto}, nota ${media} de 5. Toca para editar.`}>
            <View style={styles.linha}>
              <View style={styles.escudos}>
                <Escudo clube={casa} size={28} />
                <Escudo clube={fora} size={28} />
              </View>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {estadio?.nome ?? 'Estádio'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {`${dia} · ${casa.nomeCurto} x ${fora.nomeCurto}`}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {`Estádio ${avaliacao.estadio} · Ambiente ${avaliacao.ambiente} · Acessos ${avaliacao.acessos}`}
                </ThemedText>
              </View>
              <View style={styles.direita}>
                <ThemedText style={[styles.nota, { color: theme.accent }]}>★ {media}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Editar
                </ThemedText>
              </View>
            </View>
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  escudos: {
    flexDirection: 'row',
    gap: Spacing.half,
  },
  flex: {
    flex: 1,
  },
  direita: {
    alignItems: 'flex-end',
  },
  nota: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
});
