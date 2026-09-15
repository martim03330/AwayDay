import { skipToken, useQuery } from '@tanstack/react-query';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  fetchStadiumParking,
  type ParkingKind,
  type ParkingSource,
  type ParkingSpot,
} from '@/features/parking/api';
import { useTheme } from '@/hooks/use-theme';
import { abrirDirecoes } from '@/lib/direcoes';
import { formatarDistancia } from '@/lib/formatos';
import { useAppState } from '@/state/app-state';
import { Aviso } from '@/ui/aviso';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const TIPOS: Record<ParkingKind, string> = {
  parque_oficial: 'Parque do estádio',
  parque_publico: 'Parque público',
  parque_gratuito: 'Gratuito',
  rua: 'Na rua',
  park_and_ride: 'Parque e transporte',
};

/** "placegar.com", so a source reads at a glance. */
function dominio(url: string) {
  return (
    url
      .replace(/^https:\/\//, '')
      .split('/')[0]
      ?.replace(/^www\./, '') ?? url
  );
}

function Fontes({ fontes }: { fontes: ParkingSource[] }) {
  const theme = useTheme();
  return (
    <View style={styles.fontes}>
      {fontes.map((fonte) => (
        <Pressable
          key={fonte.url}
          onPress={() => void Linking.openURL(fonte.url).catch(() => undefined)}
          accessibilityRole="link"
          accessibilityLabel={`Fonte: ${fonte.title}. Abre no navegador.`}>
          <ThemedText type="small" style={{ color: theme.accentInk }} numberOfLines={1}>
            {`Fonte: ${dominio(fonte.url)} · ${fonte.title}`}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function Parque({ parque, ultimo }: { parque: ParkingSpot; ultimo: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.parque,
        !ultimo && { borderBottomColor: theme.backgroundSelected, borderBottomWidth: 1 },
      ]}>
      <View style={styles.topo}>
        <Icon name={icons.carro} size={18} color={theme.textSecondary} />
        <ThemedText style={styles.nome}>{parque.name}</ThemedText>
      </View>
      <View style={styles.etiquetas}>
        <Etiqueta icon={icons.carro} label={TIPOS[parque.kind]} tone="neutro" />
        {parque.openOnMatchdays === false ? (
          <Etiqueta icon={icons.fechar} label="Fechado em dias de jogo" tone="negativo" />
        ) : parque.openOnMatchdays === true ? (
          <Etiqueta icon={icons.selecionado} label="Aberto em dias de jogo" tone="positivo" />
        ) : null}
        {parque.distanceM !== null ? (
          <Etiqueta
            icon={icons.aPe}
            label={`${formatarDistancia(parque.distanceM)} do estádio`}
            tone="neutro"
          />
        ) : null}
      </View>
      {parque.priceNote ? <ThemedText>{parque.priceNote}</ThemedText> : null}
      {parque.note ? <ThemedText themeColor="textSecondary">{parque.note}</ThemedText> : null}
      {parque.address || parque.operator ? (
        <ThemedText type="small" themeColor="textMuted">
          {[parque.address, parque.operator].filter(Boolean).join(' · ')}
        </ThemedText>
      ) : null}
      {parque.location ? (
        <LinkTexto
          label="Como chegar de carro"
          onPress={() => parque.location && abrirDirecoes(parque.location, 'carro')}
        />
      ) : null}
      <Fontes fontes={parque.sources} />
    </View>
  );
}

/**
 * Where fans leave the car on match day: a summary, match-day warnings (closures, towing) and the car parks, each
 * with its sources. What is known, not live occupancy: no free source publishes how full car parks are.
 */
export function EstacionamentoEstadio({ estadioId }: { estadioId: string }) {
  const { modoDemo } = useAppState();
  const dados = useQuery({
    queryKey: ['parking', estadioId],
    queryFn: modoDemo ? skipToken : () => fetchStadiumParking(estadioId),
    staleTime: ONE_DAY_MS,
  });

  if (modoDemo || dados.isLoading) return null;

  const info = dados.data;
  if (!info || (info.spots.length === 0 && !info.summary && info.warnings.length === 0)) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          Ainda não temos informação verificada sobre estacionamento neste estádio.
        </ThemedText>
      </Card>
    );
  }

  return (
    <View style={styles.coluna}>
      {info.warnings.map((aviso) => (
        <View key={aviso.text} style={styles.aviso}>
          <Aviso tone="aviso" title="Em dia de jogo" message={aviso.text} />
          <Fontes fontes={aviso.sources} />
        </View>
      ))}
      <Card style={styles.card}>
        {info.summary ? (
          <View style={styles.resumo}>
            <ThemedText>{info.summary}</ThemedText>
            <Fontes fontes={info.summarySources} />
          </View>
        ) : null}
        {info.spots.map((parque, indice) => (
          <Parque key={parque.id} parque={parque} ultimo={indice === info.spots.length - 1} />
        ))}
        <ThemedText type="small" themeColor="textMuted">
          Informação pesquisada em sites de clubes, câmaras, polícia e operadores. Não mostra
          lugares livres em tempo real: confirma no local.
        </ThemedText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  coluna: {
    gap: Spacing.two,
  },
  aviso: {
    gap: 4,
  },
  card: {
    gap: Spacing.three,
  },
  resumo: {
    gap: Spacing.one,
  },
  parque: {
    gap: 6,
    paddingBottom: Spacing.three,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nome: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 800,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  fontes: {
    gap: 2,
  },
});
