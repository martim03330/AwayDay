import { skipToken, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { EtiquetaFacilidade, LegendaFacilidade } from '@/components/facilidade-parque';
import { Spacing } from '@/constants/theme';
import {
  fetchStadiumParking,
  type ParkingKind,
  type ParkingSource,
  type ParkingSpot,
} from '@/features/parking/api';
import { useTheme } from '@/hooks/use-theme';
import { abrirDirecoes } from '@/lib/direcoes';
import { formatarHora } from '@/lib/datas';
import {
  facilidadeEstacionamento,
  minutosAPe,
  minutosExtraDoParque,
} from '@/lib/facilidade-estacionamento';
import { chegadaRecomendada } from '@/lib/hora-saida';
import { plural } from '@/lib/formatos';
import { useAppState } from '@/state/app-state';
import { Card } from '@/ui/card';
import { Etiqueta } from '@/ui/etiqueta';
import { Icon, icons } from '@/ui/icon';
import { LinkTexto } from '@/ui/link-texto';
import { SectionHeader } from '@/ui/section-header';
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

function Parque({
  parque,
  destaque,
  jogoGrande,
  inicio,
}: {
  parque: ParkingSpot;
  destaque: boolean;
  jogoGrande: boolean;
  /** Kick-off, when the game is known: then the car park also says by when to be there. */
  inicio: string | null;
}) {
  const theme = useTheme();
  const minutos = minutosAPe(parque.distanceM);
  const chegada =
    inicio && parque.openOnMatchdays !== false
      ? chegadaRecomendada({
          inicio,
          minutosAPeDoParque: minutos,
          minutosExtraDoParque: minutosExtraDoParque(parque, { jogoGrande }),
          jogoGrande,
        })
      : null;

  // Only what decides it: how far, whether it fills, and by when to be there. The why and the sources are once, at
  // the end of the card (testers found every car park repeating them too much).
  return (
    <View style={styles.parque}>
      <View style={styles.topo}>
        <View style={[styles.letraP, { backgroundColor: theme.info }]}>
          <ThemedText style={[styles.letraPTexto, { color: theme.backgroundElement }]}>P</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText style={destaque ? styles.nomeDestaque : styles.nome}>{parque.name}</ThemedText>
          {minutos !== null ? (
            <ThemedText type="small" themeColor="textSecondary">
              {`${minutos} min a pé`}
            </ThemedText>
          ) : null}
        </View>
      </View>
      <View style={styles.etiquetas}>
        {parque.openOnMatchdays === false ? (
          <Etiqueta icon={icons.fechar} label="Fechado em dias de jogo" tone="negativo" />
        ) : (
          <EtiquetaFacilidade parque={parque} jogoGrande={jogoGrande} />
        )}
        {chegada ? <Etiqueta icon={icons.horario} label={`Chega até às ${formatarHora(chegada)}`} tone="neutro" /> : null}
      </View>
      {parque.location ? (
        <LinkTexto
          label="Como chegar de carro"
          onPress={() => parque.location && abrirDirecoes(parque.location, 'carro')}
        />
      ) : null}
    </View>
  );
}

/** The first sentence of a warning: the part that matters at a glance. The rest is under «Porquê e fontes». */
function primeiraFrase(texto: string) {
  const fim = texto.search(/[.!?](\s|$)/);
  return fim === -1 ? texto : texto.slice(0, fim + 1);
}

/** Why each car park got its colour, the full warnings and every source: once, at the end. */
function PorqueEFontes({
  parques,
  avisos,
  jogoGrande,
}: {
  parques: readonly ParkingSpot[];
  avisos: readonly { text: string; sources: ParkingSource[] }[];
  jogoGrande: boolean;
}) {
  return (
    <View style={styles.detalhes}>
      <LegendaFacilidade />
      <ThemedText type="small" themeColor="textMuted">
        Uma estimativa pela distância, pelo tamanho e pelos avisos: ninguém publica lugares livres em tempo real.
        Confirma no local.
      </ThemedText>
      {parques.map((parque) => {
        const { motivo } = facilidadeEstacionamento(parque, { jogoGrande });
        return (
          <View key={parque.id} style={styles.porque}>
            <ThemedText type="smallBold">{parque.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                TIPOS[parque.kind],
                parque.capacity !== null ? `${parque.capacity} lugares` : null,
                motivo,
                parque.priceNote,
                parque.note,
                parque.location === null ? 'Sem sítio exato no mapa: só temos a morada.' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
            <Fontes fontes={parque.sources} />
          </View>
        );
      })}
      {avisos.map((aviso) => (
        <View key={aviso.text} style={styles.porque}>
          <ThemedText type="smallBold">Aviso</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {aviso.text}
          </ThemedText>
          <Fontes fontes={aviso.sources} />
        </View>
      ))}
    </View>
  );
}

/**
 * Where to leave the car on match day, kept short: the recommended car park first, the match-day warnings in one
 * sentence each, the other car parks behind a tap, and the why and the sources once at the end. Not live occupancy:
 * nobody publishes it free. Draws its own section title, so the title never sits over an empty section.
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
  const [todosAbertos, setTodosAbertos] = useState(false);
  const [porqueAberto, setPorqueAberto] = useState(false);
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
  const outros = info.spots.filter((parque) => parque.id !== recomendado?.id);

  return (
    <>
      {titulo}
      <Card style={styles.card}>
        {recomendado ? (
          <>
            <ThemedText type="eyebrow" themeColor="accentInk">
              Recomendado
            </ThemedText>
            <Parque parque={recomendado} destaque jogoGrande={jogoGrande} inicio={inicio} />
          </>
        ) : (
          <ThemedText themeColor="textSecondary">
            Nenhum parque com fonte abre em dias de jogo. Vê os avisos antes de ir de carro.
          </ThemedText>
        )}

        {/* The warnings stay in sight, but short: the first sentence of each. The rest is under «Porquê e fontes». */}
        {info.warnings.length > 0 ? (
          <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
            {info.warnings.map((aviso) => (
              <View key={aviso.text} style={styles.aviso}>
                <Icon name={icons.aviso} size={16} color={theme.warning} />
                <ThemedText type="small" style={styles.flex}>
                  {primeiraFrase(aviso.text)}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {outros.length > 0 ? (
          <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
            <Abrir
              rotulo={`Mais ${plural(outros.length, 'parque', 'parques')}`}
              aberto={todosAbertos}
              onPress={() => setTodosAbertos((atual) => !atual)}
            />
            {todosAbertos
              ? outros.map((parque) => (
                  <Parque
                    key={parque.id}
                    parque={parque}
                    destaque={false}
                    jogoGrande={jogoGrande}
                    inicio={inicio}
                  />
                ))
              : null}
          </View>
        ) : null}

        <View style={[styles.bloco, { borderTopColor: theme.backgroundSelected }]}>
          <Abrir
            rotulo="Porquê e fontes"
            aberto={porqueAberto}
            onPress={() => setPorqueAberto((atual) => !atual)}
          />
          {porqueAberto ? (
            <PorqueEFontes parques={info.spots} avisos={info.warnings} jogoGrande={jogoGrande} />
          ) : null}
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  parque: {
    gap: Spacing.two,
  },
  etiquetas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
    gap: Spacing.twoAndHalf,
    paddingTop: Spacing.threeAndHalf,
    borderTopWidth: 1,
  },
  aviso: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  porque: {
    gap: 2,
  },
  fontes: {
    gap: 2,
  },
  detalhes: {
    gap: Spacing.twoAndHalf,
  },
  pressed: {
    opacity: 0.7,
  },
});
