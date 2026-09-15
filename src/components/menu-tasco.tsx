import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { plural } from '@/lib/formatos';
import { formatarCentimos } from '@/lib/money';
import { contagemDoPrato } from '@/lib/pratos';
import type { Prato } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { Chip } from '@/ui/chip';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinhaDetalhes } from '@/ui/linha-detalhes';
import { ThemedText } from '@/ui/themed-text';

type MenuTascoProps = {
  pratos: readonly Prato[];
  recomendados: ReadonlySet<string>;
  /** Recommendations the dish counts already include (see contagemDoPrato). */
  jaContados?: ReadonlySet<string>;
  onAlternarRecomendacao: (pratoId: string) => void;
};

export function MenuTasco({
  pratos,
  recomendados,
  jaContados,
  onAlternarRecomendacao,
}: MenuTascoProps) {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      {pratos.map((prato) => {
        const recomendado = recomendados.has(prato.id);
        const total = contagemDoPrato(prato, recomendados, jaContados);
        return (
          <View
            key={prato.id}
            style={[styles.prato, { borderBottomColor: theme.backgroundSelected }]}>
            {/* The text column shrinks and wraps; the button keeps its size on the right. */}
            <View style={styles.textos}>
              <View style={styles.titulo}>
                <ThemedText style={styles.nome}>{prato.nome}</ThemedText>
                {prato.especialidade ? <Etiqueta label="Especialidade" tone="aviso" /> : null}
              </View>
              <LinhaDetalhes
                partes={[
                  prato.precoCentimos === null
                    ? 'preço por confirmar'
                    : formatarCentimos(prato.precoCentimos),
                  prato.minutosPreparacao === null
                    ? null
                    : `pronto em ${prato.minutosPreparacao} min`,
                  plural(total, 'recomendação', 'recomendações'),
                ]}
              />
            </View>
            <Chip
              label={recomendado ? 'Recomendado' : 'Recomendo'}
              selected={recomendado}
              onPress={() => onAlternarRecomendacao(prato.id)}
              leading={
                recomendado ? (
                  <Icon
                    name={icons.selecionado}
                    size={13}
                    color={theme.accentText}
                    strokeWidth={3}
                  />
                ) : undefined
              }
              accessibilityLabel={
                recomendado
                  ? `Retirar a tua recomendação de ${prato.nome}`
                  : `Recomendar ${prato.nome}`
              }
            />
          </View>
        );
      })}
      <ThemedText themeColor="textMuted" style={styles.rodape}>
        As recomendações são dos adeptos, não do dono. Recomenda só o que provaste.
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    paddingTop: Spacing.one,
    paddingBottom: 14,
  },
  prato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  textos: {
    flex: 1,
    gap: Spacing.one,
  },
  titulo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  nome: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  rodape: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 16,
  },
});
