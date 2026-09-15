import { skipToken, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
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
import { formatarDistancia, plural } from '@/lib/formatos';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { ThemedText } from '@/ui/themed-text';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DETOUR_FACTOR = 1.3;
const METROS_POR_MINUTO = 80;

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

/** The car park to suggest first: open on match days (or unknown), with a location, nearest to the stadium. */
export function parqueRecomendado(parques: readonly ParkingSpot[]) {
  const candidatos = parques.filter((parque) => parque.openOnMatchdays !== false);
  return (
    [...candidatos].sort(
      (a, b) =>
        Number(b.openOnMatchdays === true) - Number(a.openOnMatchdays === true) ||
        Number(b.location !== null) - Number(a.location !== null) ||
        (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER)
    )[0] ?? null
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
            {`${dominio(fonte.url)} · ${fonte.title}`}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

/** A line that opens to show more: keeps the section short until someone wants the detail. */
function Abrir({
  rotulo,
  aberto,
  onPress,
}: {
  rotulo: string;
  aberto: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberto }}
      style={({ pressed }) => [styles.abrir, pressed && styles.pressed]}>
      <ThemedText style={[styles.abrirTexto, { color: theme.accentInk }]}>{rotulo}</ThemedText>
      <Icon name={aberto ? icons.fechar : icons.seguinte} size={14} color={theme.accentInk} />
    </Pressable>
  );
}

function Parque({ parque, destaque }: { parque: ParkingSpot; destaque: boolean }) {
  const theme = useTheme();
  const [fontesAbertas, setFontesAbertas] = useState(false);
  const minutos =
    parque.distanceM !== null
      ? Math.round((parque.distanceM * DETOUR_FACTOR) / METROS_POR_MINUTO)
      : null;

  return (
    <View style={styles.parque}>
      <View style={styles.topo}>
        <View style={[styles.letraP, { backgroundColor: theme.info }]}>
          <ThemedText style={styles.letraPTexto}>P</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText style={destaque ? styles.nomeDestaque : styles.nome}>
            {parque.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {[TIPOS[parque.kind], minutos !== null ? `${minutos} min a pé do estádio` : null]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
      </View>
      {parque.openOnMatchdays === false ? (
        <Etiqueta icon={icons.fechar} label="Fechado em dias de jogo" tone="negativo" />
      ) : parque.openOnMatchdays === true ? (
        <Etiqueta icon={icons.selecionado} label="Aberto em dias de jogo" tone="positivo" />
      ) : null}
      {parque.priceNote ? <ThemedText>{parque.priceNote}</ThemedText> : null}
      {destaque && parque.note ? (
        <ThemedText themeColor="textSecondary">{parque.note}</ThemedText>
      ) : null}
      <View style={styles.acoes}>
        {parque.location ? (
          <LinkTexto
            label="Como chegar de carro"
            onPress={() => parque.location && abrirDirecoes(parque.location, 'carro')}
          />
        ) : null}
        <Abrir
          rotulo={fontesAbertas ? 'Esconder fontes' : 'Ver fontes'}
          aberto={fontesAbertas}
          onPress={() => setFontesAbertas((atual) => !atual)}
        />
      </View>
      {fontesAbertas ? <Fontes fontes={parque.sources} /> : null}
    </View>
  );
}

/**
 * Where to leave the car on match day, kept short: the recommended car park first, then the match-day warnings and the
 * other car parks behind a tap. Sources are one tap away on every item. Not live occupancy: nobody publishes it free.
 */
export function EstacionamentoEstadio({ estadioId }: { estadioId: string }) {
  const theme = useTheme();
  const { modoDemo } = useAppState();
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [todosAbertos, setTodosAbertos] = useState(false);
  const dados = useQuery({
    queryKey: ['parking', estadioId],
    queryFn: modoDemo ? skipToken : () => fetchStadiumParking(estadioId),
    staleTime: ONE_DAY_MS,
  });

  if (modoDemo || dados.isLoading) return null;

  const info = dados.data;
  if (!info || (info.spots.length === 0 && info.warnings.length === 0)) {
    return (
      <Card>
        <ThemedText themeColor="textSecondary">
          Ainda não temos informação verificada sobre estacionamento neste estádio.
        </ThemedText>
      </Card>
    );
  }

  const recomendado = parqueRecomendado(info.spots);
  const outros = info.spots.filter((parque) => parque.id !== recomendado?.id);

  return (
    <Card style={styles.card}>
      {recomendado ? (
        <>
          <ThemedText type="eyebrow" themeColor="accentInk">
            Recomendado
          </ThemedText>
          <Parque parque={recomendado} destaque />
        </>
      ) : (
        <ThemedText themeColor="textSecondary">
          Não encontrámos um parque aberto em dias de jogo com fonte. Vê os avisos antes de ir de
          carro.
        </ThemedText>
      )}

      {info.warnings.length > 0 ? (
        <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
          <Abrir
            rotulo={`${plural(info.warnings.length, 'aviso', 'avisos')} para dia de jogo`}
            aberto={avisosAbertos}
            onPress={() => setAvisosAbertos((atual) => !atual)}
          />
          {avisosAbertos
            ? info.warnings.map((aviso) => (
                <View
                  key={aviso.text}
                  style={[styles.aviso, { backgroundColor: theme.warningBackground }]}>
                  <ThemedText style={{ color: theme.warningText }}>{aviso.text}</ThemedText>
                  <Fontes fontes={aviso.sources} />
                </View>
              ))
            : null}
        </View>
      ) : null}

      {outros.length > 0 ? (
        <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
          <Abrir
            rotulo={`Ver os outros ${plural(outros.length, 'parque', 'parques')}`}
            aberto={todosAbertos}
            onPress={() => setTodosAbertos((atual) => !atual)}
          />
          {todosAbertos
            ? outros.map((parque) => <Parque key={parque.id} parque={parque} destaque={false} />)
            : null}
        </View>
      ) : null}

      <ThemedText type="small" themeColor="textMuted">
        {`Pesquisado em sites de clubes, câmaras, polícia e operadores${recomendado?.distanceM != null ? ` · ${formatarDistancia(recomendado.distanceM)} em linha reta` : ''}. Sem lugares livres em tempo real: confirma no local.`}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  parque: {
    gap: 6,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  letraP: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraPTexto: {
    color: '#FFFFFF',
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 20,
  },
  flex: {
    flex: 1,
  },
  nome: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 700,
  },
  nomeDestaque: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 800,
  },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },
  abrir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
  },
  abrirTexto: {
    fontWeight: 700,
  },
  bloco: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  aviso: {
    gap: 4,
    padding: 10,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  fontes: {
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
