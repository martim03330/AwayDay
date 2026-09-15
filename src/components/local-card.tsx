import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatarDistancia } from '@/lib/formatos';
import { nomesTipoLocal } from '@/mocks/locais';
import type { Local } from '@/mocks/tipos';
import { Card } from '@/ui/card';
import { ContadorPessoas } from '@/ui/contador-pessoas';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { Medidor } from '@/ui/medidor';
import { ThemedText } from '@/ui/themed-text';

type LocalCardProps = {
  local: Local;
  pessoas: number | null;
  checkedIn: boolean;
  onPress: () => void;
};

/** Dashed divider. A dashed border on a single side does not render on iOS, so the box is clipped. */
function Tracejado() {
  const theme = useTheme();
  return (
    <View style={styles.tracejado}>
      <View style={[styles.tracejadoLinha, { borderColor: theme.border }]} />
    </View>
  );
}

export function LocalCard({ local, pessoas, checkedIn, onPress }: LocalCardProps) {
  const theme = useTheme();
  const distancia = `${local.minutosAPe} min a pé (${formatarDistancia(local.distanciaMetros)})`;

  return (
    <Card
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={[
        local.nome,
        nomesTipoLocal[local.tipo],
        `${distancia} do estádio`,
        local.cervejometro === null ? null : `cervejómetro ${local.cervejometro} de 5`,
        local.petiscometro === null ? null : `petiscómetro ${local.petiscometro} de 5`,
        pessoas === null ? null : `${pessoas} pessoas aqui`,
        local.especialidade ? `especialidade ${local.especialidade}` : null,
      ]
        .filter(Boolean)
        .join(', ')}>
      <View style={styles.topo}>
        <View style={styles.textos}>
          <ThemedText style={styles.nome}>{local.nome}</ThemedText>
          <View style={styles.meta}>
            <ThemedText style={[styles.metaTexto, { color: theme.textSecondary }]}>
              {`${[nomesTipoLocal[local.tipo], local.precoMedio ? '€'.repeat(local.precoMedio) : null].filter(Boolean).join(' · ')} ·`}
            </ThemedText>
            <Icon name={icons.aPe} size={15} color={theme.textSecondary} />
            <ThemedText style={[styles.metaTexto, { color: theme.textSecondary }]}>
              {distancia}
            </ThemedText>
          </View>
          {checkedIn || local.rapidoEBarato || local.confirmacao === 'sugerido' ? (
            <View style={styles.estasAqui}>
              {checkedIn ? (
                <Etiqueta icon={icons.selecionado} label="Estás aqui" tone="positivo" />
              ) : null}
              {local.rapidoEBarato ? (
                <Etiqueta icon={icons.preco} label="Rápido e barato" tone="destaque" />
              ) : null}
              {local.confirmacao === 'sugerido' ? (
                <Etiqueta icon={icons.porVerificar} label="Por confirmar" tone="aviso" />
              ) : null}
            </View>
          ) : null}
        </View>
        {pessoas === null ? null : <ContadorPessoas count={pessoas} variant="tile" />}
      </View>

      <Tracejado />

      <View style={styles.rodape}>
        <Medidor
          compact
          label="Cervejómetro"
          icon={icons.tasco}
          tone="amarelo"
          value={local.cervejometro}
        />
        <Medidor
          compact
          label="Petiscómetro"
          icon={icons.especialidade}
          tone="verde"
          value={local.petiscometro}
        />
        {local.especialidade ? (
          <ThemedText
            numberOfLines={1}
            style={[styles.especialidade, { color: theme.textSecondary }]}>
            {local.especialidade}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  textos: {
    flex: 1,
    gap: 6,
  },
  nome: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: 800,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaTexto: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600,
  },
  estasAqui: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tracejado: {
    height: 1.5,
    overflow: 'hidden',
  },
  tracejadoLinha: {
    height: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  especialidade: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 700,
    textAlign: 'right',
  },
});
