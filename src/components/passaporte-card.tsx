import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useCarimbosNovos } from '@/hooks/use-carimbos-novos';
import { useTheme } from '@/hooks/use-theme';
import { notaDoEstadio } from '@/lib/avaliacoes';
import { formatarNota } from '@/lib/formatos';
import { DIVISOES, nomesDivisao, obterClube } from '@/mocks/clubes';
import { estadiosNacionais } from '@/mocks/estadios';
import type { AvaliacaoVisita } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Carimbo } from '@/ui/carimbo';
import { Escudo } from '@/ui/escudo';
import { Icon, icons } from '@/ui/icon';
import { ProgressBar } from '@/ui/progress-bar';
import { ThemedText } from '@/ui/themed-text';

type PassaporteCardProps = {
  estadiosVisitados: readonly string[];
  avaliacoes: readonly AvaliacaoVisita[];
};

export function PassaporteCard({ estadiosVisitados, avaliacoes }: PassaporteCardProps) {
  const theme = useTheme();
  const eNovo = useCarimbosNovos(estadiosVisitados);

  const visitado = (estadioId: string) => estadiosVisitados.includes(estadioId);
  const totalVisitados = estadiosNacionais.filter((estadio) => visitado(estadio.id)).length;

  const grupos = DIVISOES.map((divisao) => {
    const lista = estadiosNacionais
      .filter((estadio) => obterClube(estadio.clubeId)?.divisao === divisao)
      .sort((a, b) => Number(visitado(b.id)) - Number(visitado(a.id)));
    return { divisao, lista, visitados: lista.filter((estadio) => visitado(estadio.id)).length };
  });

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText style={styles.contagem}>
          {totalVisitados} de {estadiosNacionais.length}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          estádios visitados
        </ThemedText>
      </View>
      <ProgressBar
        progress={totalVisitados / estadiosNacionais.length}
        accessibilityLabel={`${totalVisitados} de ${estadiosNacionais.length} estádios visitados`}
      />

      {grupos.map((grupo) => (
        <View key={grupo.divisao} style={styles.grupo}>
          <View style={styles.cabecalhoGrupo}>
            <ThemedText type="smallBold">{nomesDivisao[grupo.divisao]}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {grupo.visitados} de {grupo.lista.length}
            </ThemedText>
          </View>
          <View style={styles.carimbos}>
            {grupo.lista.map((estadio) => {
              const dono = obterClube(estadio.clubeId);
              const foiVisitado = visitado(estadio.id);
              const nota = notaDoEstadio(avaliacoes, estadio.id);
              const novo = eNovo(estadio.id);
              return (
                <Carimbo
                  key={estadio.id}
                  novo={novo}
                  accessibilityLabel={[
                    estadio.nome,
                    foiVisitado ? 'visitado' : 'por visitar',
                    novo ? 'carimbo novo' : null,
                    nota ? `a tua nota: ${formatarNota(nota.media)} de 5` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  style={[
                    styles.carimbo,
                    { backgroundColor: theme.background },
                    !foiVisitado && styles.porVisitar,
                  ]}>
                  {dono ? <Escudo clube={dono} size={28} /> : null}
                  <ThemedText type="small" numberOfLines={2} style={styles.carimboNome}>
                    {estadio.nome}
                  </ThemedText>
                  {foiVisitado ? (
                    <View style={styles.estado}>
                      <Icon name={icons.visitado} size={14} color={theme.success} />
                      {nota ? (
                        <ThemedText type="smallBold" style={[styles.nota, { color: theme.accent }]}>
                          ★ {formatarNota(nota.media)}
                        </ThemedText>
                      ) : null}
                    </View>
                  ) : null}
                </Carimbo>
              );
            })}
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  contagem: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  grupo: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cabecalhoGrupo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  carimbos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  carimbo: {
    width: '32%',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: 14,
  },
  porVisitar: {
    opacity: 0.35,
  },
  carimboNome: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  nota: {
    fontSize: 12,
    lineHeight: 16,
  },
});
