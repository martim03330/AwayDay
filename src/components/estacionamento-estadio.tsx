import { skipToken, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { corFacilidade } from '@/components/facilidade-parque';
import { Radius, Spacing } from '@/constants/theme';
import { fetchStadiumParking, type ParkingSpot } from '@/features/parking/api';
import { useTheme } from '@/hooks/use-theme';
import { abrirDirecoes } from '@/lib/direcoes';
import { formatarHora } from '@/lib/datas';
import {
  facilidadeEstacionamento,
  minutosAPe,
  minutosExtraDoParque,
  ROTULO_FACILIDADE,
} from '@/lib/facilidade-estacionamento';
import { chegadaRecomendada } from '@/lib/hora-saida';
import { plural } from '@/lib/formatos';
import { useAppState } from '@/state/app-state';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Icon, icons } from '@/ui/icon';
import { SectionHeader } from '@/ui/section-header';
import { ThemedText } from '@/ui/themed-text';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const ORDEM_FACILIDADE = { facil: 0, media: 1, desconhecida: 2, dificil: 3 };

/**
 * The car park to suggest first: open on match days, where parking is most likely, and among equals the researched
 * one nearest the stadium. The closest car park is not the best advice — it is the first to fill.
 */
export function parqueRecomendado(parques: readonly ParkingSpot[], jogoGrande = false) {
  const candidatos = parques.filter((parque) => parque.openOnMatchdays !== false);
  return (
    [...candidatos].sort(
      (a, b) =>
        ORDEM_FACILIDADE[facilidadeEstacionamento(a, { jogoGrande }).nivel] -
          ORDEM_FACILIDADE[facilidadeEstacionamento(b, { jogoGrande }).nivel] ||
        Number(b.location !== null) - Number(a.location !== null) ||
        Number(a.source === 'osm') - Number(b.source === 'osm') ||
        (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER)
    )[0] ?? null
  );
}

/** «Enche cedo», «Fechado em dias de jogo»… and its colour: the one thing that decides a car park. */
function estadoDoParque(parque: ParkingSpot, jogoGrande: boolean) {
  if (parque.openOnMatchdays === false) return { texto: 'Fechado em dias de jogo', nivel: 'dificil' as const };
  const { nivel } = facilidadeEstacionamento(parque, { jogoGrande });
  return { texto: ROTULO_FACILIDADE[nivel], nivel };
}

/** The «P» tile, as on road signs. */
function LetraP({ grande = false }: { grande?: boolean }) {
  const theme = useTheme();
  const lado = grande ? 40 : 32;
  return (
    <View style={[styles.letraP, { width: lado, height: lado, backgroundColor: theme.info }]}>
      <ThemedText style={[styles.letraPTexto, { color: theme.backgroundElement, fontSize: grande ? 20 : 16 }]}>
        P
      </ThemedText>
    </View>
  );
}

/** A coloured dot and the state, then the walk: «● Enche cedo · 4 min a pé». */
function LinhaEstado({ parque, jogoGrande }: { parque: ParkingSpot; jogoGrande: boolean }) {
  const theme = useTheme();
  const estado = estadoDoParque(parque, jogoGrande);
  const minutos = minutosAPe(parque.distanceM);
  return (
    <View style={styles.estado}>
      <View style={[styles.bola, { backgroundColor: corFacilidade(theme, estado.nivel) }]} />
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
        {[estado.texto, minutos !== null ? `${minutos} min a pé` : null].filter(Boolean).join(' · ')}
      </ThemedText>
    </View>
  );
}

/** The recommended car park, on its own: name, state, by when to be there, and the way there. */
function Recomendado({
  parque,
  jogoGrande,
  inicio,
}: {
  parque: ParkingSpot;
  jogoGrande: boolean;
  inicio: string | null;
}) {
  const theme = useTheme();
  const minutos = minutosAPe(parque.distanceM);
  const chegada = inicio
    ? chegadaRecomendada({
        inicio,
        minutosAPeDoParque: minutos,
        minutosExtraDoParque: minutosExtraDoParque(parque, { jogoGrande }),
        jogoGrande,
      })
    : null;

  return (
    <View style={styles.recomendado}>
      <ThemedText type="eyebrow" themeColor="accentInk">
        Recomendado
      </ThemedText>
      <View style={styles.linha}>
        <LetraP grande />
        <View style={styles.flex}>
          <ThemedText style={styles.nomeDestaque}>{parque.name}</ThemedText>
          <LinhaEstado parque={parque} jogoGrande={jogoGrande} />
        </View>
      </View>
      {chegada ? (
        <View style={[styles.chegada, { backgroundColor: theme.successBackground }]}>
          <Icon name={icons.horario} size={18} color={theme.accentInk} />
          <ThemedText style={[styles.chegadaTexto, { color: theme.accentInk }]}>
            {`Chega até às ${formatarHora(chegada)}`}
          </ThemedText>
        </View>
      ) : null}
      {parque.location ? (
        <Button
          label="Como chegar de carro"
          variant="secondary"
          icon={icons.rota}
          onPress={() => parque.location && abrirDirecoes(parque.location, 'carro')}
        />
      ) : null}
    </View>
  );
}

/** Another car park: one tidy line, with a round button for the way there. */
function OutroParque({
  parque,
  jogoGrande,
  separador,
}: {
  parque: ParkingSpot;
  jogoGrande: boolean;
  separador: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.linha,
        styles.outro,
        separador && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}>
      <LetraP />
      <View style={styles.flex}>
        <ThemedText style={styles.nome} numberOfLines={2}>
          {parque.name}
        </ThemedText>
        <LinhaEstado parque={parque} jogoGrande={jogoGrande} />
      </View>
      {parque.location ? (
        <Pressable
          onPress={() => parque.location && abrirDirecoes(parque.location, 'carro')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Como chegar de carro a ${parque.name}`}
          style={({ pressed }) => [
            styles.caminho,
            { backgroundColor: theme.successBackground },
            pressed && styles.pressed,
          ]}>
          <Icon name={icons.rota} size={18} color={theme.accentInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A line that opens to show more: keeps the section short until someone wants the detail. */
function Abrir({ rotulo, aberto, onPress }: { rotulo: string; aberto: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      hitSlop={6}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberto }}
      style={({ pressed }) => [styles.abrir, pressed && styles.pressed]}>
      <ThemedText style={[styles.abrirTexto, { color: theme.accentInk }]}>{rotulo}</ThemedText>
      <Icon name={aberto ? icons.fechar : icons.seguinte} size={14} color={theme.accentInk} />
    </Pressable>
  );
}

/**
 * Where to leave the car on match day: the recommended car park on its own, then the match-day warnings and the other
 * car parks each behind a tap. Every car park says only what decides it (whether it fills, and how far it is on foot).
 * An estimate, not live occupancy: nobody publishes it free. Draws its own section title, so the title never sits over
 * an empty section.
 */
export function EstacionamentoEstadio({
  estadioId,
  jogoGrande = false,
  inicio = null,
}: {
  estadioId: string;
  jogoGrande?: boolean;
  inicio?: string | null;
}) {
  const theme = useTheme();
  const { modoDemo } = useAppState();
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const [todosAbertos, setTodosAbertos] = useState(false);
  const dados = useQuery({
    queryKey: ['parking', estadioId],
    queryFn: modoDemo ? skipToken : () => fetchStadiumParking(estadioId),
    staleTime: ONE_DAY_MS,
  });

  if (!modoDemo && dados.isLoading) return null;

  const titulo = <SectionHeader title="Estacionamento" />;
  const info = modoDemo ? undefined : dados.data;
  if (!info || (info.spots.length === 0 && info.warnings.length === 0)) {
    return (
      <>
        {titulo}
        <Card>
          <ThemedText themeColor="textSecondary">
            {modoDemo
              ? 'No modo demo não mostramos parques.'
              : 'Ainda sem informação verificada sobre parques neste estádio.'}
          </ThemedText>
        </Card>
      </>
    );
  }

  const recomendado = parqueRecomendado(info.spots, jogoGrande);
  // Open ones first, nearest first; the ones closed on match days at the end.
  const outros = info.spots
    .filter((parque) => parque.id !== recomendado?.id)
    .sort(
      (a, b) =>
        Number(a.openOnMatchdays === false) - Number(b.openOnMatchdays === false) ||
        (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER)
    );

  return (
    <>
      {titulo}
      <Card style={styles.card}>
        {recomendado ? (
          <Recomendado parque={recomendado} jogoGrande={jogoGrande} inicio={inicio} />
        ) : (
          <ThemedText themeColor="textSecondary">
            Nenhum parque conhecido abre em dias de jogo. Vê os avisos antes de ir de carro.
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
                  <View key={aviso.text} style={[styles.aviso, { backgroundColor: theme.warningBackground }]}>
                    <Icon name={icons.aviso} size={16} color={theme.warningText} />
                    <ThemedText type="small" style={[styles.flex, { color: theme.warningText }]}>
                      {aviso.text}
                    </ThemedText>
                  </View>
                ))
              : null}
          </View>
        ) : null}

        {outros.length > 0 ? (
          <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
            <Abrir
              rotulo={`Mais ${plural(outros.length, 'parque', 'parques')}`}
              aberto={todosAbertos}
              onPress={() => setTodosAbertos((atual) => !atual)}
            />
            {todosAbertos ? (
              <View>
                {outros.map((parque, indice) => (
                  <OutroParque
                    key={parque.id}
                    parque={parque}
                    jogoGrande={jogoGrande}
                    separador={indice < outros.length - 1}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <ThemedText type="small" themeColor="textMuted">
          Estimativa, não lugares em tempo real. Confirma no local.
        </ThemedText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  recomendado: {
    gap: Spacing.twoAndHalf,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.twoAndHalf,
  },
  outro: {
    paddingVertical: Spacing.twoAndHalf,
  },
  letraP: {
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraPTexto: {
    fontWeight: 900,
    lineHeight: 22,
  },
  nome: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 700,
  },
  nomeDestaque: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: 800,
  },
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  bola: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chegada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
  },
  chegadaTexto: {
    fontWeight: 700,
  },
  caminho: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloco: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
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
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.twoAndHalf,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
  },
  pressed: {
    opacity: 0.7,
  },
});
